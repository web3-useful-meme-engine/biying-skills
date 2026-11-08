# Agentic Wallet 合约调用参考

所有写操作都由 Agent 构造合约调用，并在用户自己的 Binance Agentic Wallet 中请求交易签名。不要跳转到网页确认交易，不要把只读 MCP 的 `action_required` 当成无法上链。

## 1. 动态配置与执行模板

先请求 `GET https://youqiu.xyz/v1/config`，读取并校验：

- `chainId`：钱包和 RPC 必须与此链一致；当前产品使用 BSC，但不要硬编码部署地址。
- `rpcUrl`：用于读取、模拟和查询回执；RPC 失败时停止，不切换到来源不明的节点。
- `contracts.MeritBoard`、`MeritPool`、`BuddhaNFT`、`LaunchRouter`、`LING`、`RevenueHub`。
- `minAmount`、`platformFee`、`nftTiers` 可用于展示，但发送前仍以 prepare 响应或链上实时读取为准。

下面的 viem 片段说明宿主钱包适配器应执行的顺序，不要求用户安装 CLI。`walletClient` 必须使用用户已授权的 Agentic Wallet 账户，不能由 Agent 导入私钥创建。

```js
// call 已包含 address、abi、functionName、args，以及可选的 value。
const { request } = await publicClient.simulateContract({ ...call, account });
// 此处向用户展示模拟结果、合约方法、参数、资产数量和 Gas，并取得用户确认。
const hash = await walletClient.writeContract({ ...request, account });
// 此时只能说“交易已提交”，不能说业务已经完成。
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== 'success') throw new Error('交易已回滚，业务未完成');
```

若宿主使用 EIP-1193，则依次执行等价的 `eth_call` / 估算 Gas、`eth_sendTransaction`、`eth_getTransactionReceipt`。不得跳过模拟，不得把授权成功当作业务成功。同一笔 pending 交易先查哈希和回执，不重复发送。

所有 `uint256` 金额使用十进制整数 wei 字符串或 `bigint`，不要用 JavaScript 浮点数累加。用户拒绝签名、模拟失败或回执为 `reverted` 时立即停止。

## 2. LING 精确授权

消耗 LING 的业务通常有两笔独立交易：

1. 在 `contracts.LING` 调用 `approve(address spender, uint256 amount)`。
2. 等业务授权交易回执成功后，再调用实际业务方法。

先用 ERC-20 `allowance(owner, spender)` 检查额度。不足时只授权本次所需的 `amount`，默认不使用无限授权，不擅自提高金额。授权与业务交易都要分别模拟、展示并由用户在 Agentic Wallet 确认。

| 业务 | 合约 | `spender` | `amount` 来源 |
|---|---|---|---|
| 高香、深度卦、诚心再问、完整合盘 | `consume` | `contracts.MeritBoard` | 实时 `minAmount(kind)` 或 prepare 返回的 `amount` |
| 销毁 LING 得功德 | `burnForMerit` | `contracts.MeritBoard` | 用户明确确认的数量 |
| 佛像开光 | `consecrate` | `contracts.MeritBoard` | 实时 `minAmount(5)` |
| 请佛像 | `mint` | `contracts.BuddhaNFT` | 发送前实时读取 `priceOf(t)` |

授权后用户可能拒绝第二笔交易；此时只能报告“授权已完成，业务未执行”，并说明仍存在该精确额度授权。

## 3. 用户写方法速查

| 功能 | 目标合约 | 方法与参数 | `value` |
|---|---|---|---|
| 每日签到 | `contracts.MeritBoard` | `checkIn(uint256[] tokenIds)` | `0` |
| 领取额外佛像加成 | `contracts.MeritBoard` | `claimNftBonus(uint256[] tokenIds)` | `0` |
| 免费清香 | `contracts.MeritBoard` | `freeIncense(uint8 buddhaId)` | `0` |
| 高香、付费问卦、再问、完整合盘 | `contracts.MeritBoard` | `consume(uint8 kind, uint256 amount, bytes32 ref)` | `0` |
| 销毁 LING 得功德 | `contracts.MeritBoard` | `burnForMerit(uint256 amount)` | `0` |
| 改绑本命佛 | `contracts.MeritBoard` | `rebindBuddha(uint8 buddhaId)` | `0` |
| 佛像开光 | `contracts.MeritBoard` | `consecrate(uint256 tokenId, uint256 amount)` | `0` |
| 捐 BNB | `contracts.RevenueHub` | `donate()` | 用户确认的 BNB wei |
| 敲晨钟 | `contracts.MeritPool` | `ring()` | `0` |
| 领取旧版待领取分红 | `contracts.MeritPool` | `claim()` | `0` |
| 请佛像 | `contracts.BuddhaNFT` | `mint(uint8 t)` | `0`，但须先授权 LING |
| 预约或立即发射 | prepare 返回的 `router` | `reserve(uint64 launchAt, bytes32 nameSymbolHash, bytes32 metaHash, uint256 preBuy)` | prepare 返回的 `value` |
| 开始前取消发射 | `contracts.LaunchRouter` | `cancel(uint256 id)` | `0` |
| 标记已过期预约 | `contracts.LaunchRouter` | `refundExpired(uint256 id)` | `0` |

`consumeFrom`、`recordDonation`、`addRingerMerit`、`complete`、`markRefunded`、金库提现和 owner 管理方法不是普通用户入口，不得引导调用。

## 4. 签到与上香

### 签到

1. `GET /v1/worship?address=<用户地址>` 读取 `me.checkedInToday` 与 `me.nfts`。
2. 已签到则不发送交易。未签到时，从本人 `nfts` 中筛选 `consecrated === true` 的 `token_id`，转为 `bigint`，最多取 20 个。
3. 调用 `MeritBoard.checkIn(tokenIds)`；无佛像时传 `[]`。签到只完成签到，不会自动执行清香。
4. 超过 20 尊且当天已签到，可对剩余本人已开光佛像另行调用 `claimNftBonus(tokenIds)`；不要重复提交当天已结算的 tokenId。

可用 `GET /v1/today?address=<地址>` 或链上 `lastCheckIn(address)` 复核。`lastCheckIn` 存的是北京时间 `dayId + 1`，不要把它直接当日期展示。

### 清香

1. 从 `/v1/worship` 读取 `me.incensedToday` 和 `me.buddhaId`；已上过则停止。
2. 只能使用当前生效的本人本命佛编号 `0–7`；未绑定时先询问用户要选哪尊，不擅自选择。
3. 调用 `MeritBoard.freeIncense(buddhaId)`。清香不收 LING，但需要 BNB Gas。

### 高香

1. 读取 `me.buddhaId` 和 `me.highLeft[buddhaId]`，剩余为 0 则不发送。
2. `kind = 3`，`amount = minAmount(3)`。
3. `ref` 必须是 32 字节且最低 8 位为佛编号。viem 可用 `toHex(buddhaId, { size: 32 })` 生成；不要拿问题文本哈希替代。
4. 先精确授权 `MeritBoard`，再调用 `MeritBoard.consume(3, amount, ref)`。每支单独确认，每地址每尊佛每日最多 3 支。

### 改绑本命佛

调用 `MeritBoard.rebindBuddha(buddhaId)` 前明确展示新旧佛编号。首次绑定立即生效；已有绑定时每 30 天只能改一次，新绑定次日生效。不得把改绑交易当作上香交易。

## 5. 功德与晨钟

- 捐 BNB：调用 `RevenueHub.donate()`，`value` 是用户确认的 BNB wei。BNB 全额转入平台金库并记功德，不是投资或保本理财。
- 销毁 LING：先授权 `MeritBoard`，再调用 `burnForMerit(amount)`；销毁不可找回。
- 晨钟：先查 `GET /v1/bell`，按产品规则在北京时间 08:00 后且今日未敲时调用 `MeritPool.ring()`。全平台每天仅成功一次，不是每个地址一次；奖励以 `Rung` 事件和实际回执为准。
- 领取：先读取 `MeritPool.pending(address)`，大于 0 才调用 `claim()`。它只领取升级前遗留的 pending；新版敲钟直接转账，不保证每次都有可领取金额。

## 6. 请佛像、开光与封面

- 请佛像：档位 `t = 0–4`。先读 `ownedTierOf(address, t)`、`tiers(t)` 和 `priceOf(t)`，避免重复档位、售罄或使用过期价格；再精确授权 `BuddhaNFT` 并调用 `mint(t)`。成功回执中的 `NftMinted.tokenId` 才是新佛像编号。
- 开光：从本人 `/v1/worship` 的 NFT 列表取得 `token_id`，链上核对 `ownerOf(tokenId)` 与 `consecrated(tokenId)`。`amount = minAmount(5)`，先授权 `MeritBoard`，再调用 `consecrate(tokenId, amount)`。开光永久有效，不重复发送。
- 设置封面：这是链下服务端设置，不发送交易。按 `workflows.md` 调用 `/v1/worship/display`，不得伪造一笔 NFT 交易。

## 7. 吉时发射

必须先调用 `POST /v1/launch/prepare` 让服务端校验资料、保存发射草稿并生成哈希；不要自行编造 `nameSymbolHash` 或 `metaHash`，否则服务端无法执行后续创建。

核对 prepare 返回的 `router === contracts.LaunchRouter`（忽略大小写），然后调用：

```js
const call = {
  address: prepared.router,
  abi: launchAbi,
  functionName: 'reserve',
  args: [
    BigInt(prepared.launchAt),
    prepared.nameSymbolHash,
    prepared.metaHash,
    BigInt(prepared.preBuy),
  ],
  value: BigInt(prepared.value),
};
```

`value` 必须等于 `platformFee + preBuy`，单位为 wei；预购最多 1 BNB。预约成功只表示已登记，不表示代币已创建，也不表示预购代币已交付。用 `GET /v1/launches?scope=mine&address=<地址>` 跟踪后续状态。开始前取消才调用 `cancel(id)`；服务费退款走平台链下流程，不承诺自动即时退款。

## 8. 参数校验与常见回滚

- 地址必须是 `0x` 加 40 位十六进制字符；合约地址来自 `/v1/config` 或对应 prepare 响应，并与配置交叉核对。
- `buddhaId` 为 `0–7`，NFT 档位为 `0–4`，tokenId 和 launch id 必须属于当前用户且状态允许。
- `AlreadyCheckedIn`：今日已签到；`AlreadyOffered`：今日清香已完成；`HighIncenseLimit`：高香次数已满。
- `NotYourBuddha`：佛编号不是当前本命佛；`RebindTooSoon`：30 天改绑冷却未结束。
- `BelowMinimum`：LING 数量低于实时最低值；`DuplicateTier`：同档佛像已持有；`AlreadyConsecrated`：佛像已开光。
- `SlotFull`：该时辰名额已满；`BadValue`：BNB `value` 与费用不符；`BadTime`：预约或取消时间不允许。
- `EnforcedPause`：协议暂停。不得绕过合约限制，不得因回滚反复自动付款。
