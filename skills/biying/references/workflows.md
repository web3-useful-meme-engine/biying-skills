# 功能与操作参考

## 能力边界

只读 MCP/REST 与链上写操作必须分开。需要交易时，读取 `contracts.md` 的真实方法，由 Agent 构造调用并在 Binance Agentic Wallet 中请求用户签名；不要跳转网页确认交易。所有次数、价格和额度以实时接口、链上读取及钱包确认内容为准。

## 每日推荐顺序

1. 获取用户地址，读取 `/v1/config`，再请求 `GET /v1/worship?address=<地址>` 查看 `me.checkedInToday`、`me.incensedToday`、本命佛和 NFT。
2. 未签到时调用 `MeritBoard.checkIn(tokenIds)`。签到只完成签到，不同时完成清香；传入本人已开光佛像 tokenId，最多 20 个，无佛像传空数组。
3. 未上清香时调用 `MeritBoard.freeIncense(me.buddhaId)`。清香每日一次，不收清香费，但需要 BNB Gas。
4. 用户明确要求高香时，按合约参考精确授权 LING，再调用 `consume(3, amount, ref)`；不要把高香混入默认免费流程。
5. 用 `merit_board` 查看功德池、个人排名与晨钟状态。每尊佛每天第一炉为头香，上香者功德加倍。

## 只读工具速查

| 工具 | 参数与规则 |
|---|---|
| `ask_gua` | `question`: `buy` / `sell` / `launch` / `other`；交易事项提供完整 `token`；`period`: `short` / `mid` / `long`；`other` 的 `topic` 当前仅支持 `wealth` / `market`；可带 `wallet` 合盘 |
| `read_fortune` | `address` 必填；`kind`: `auto` / `wallet` / `token`；测代币时可带 `wallet` 查看合盘 |
| `lucky_hours` | `window_hours` 为 1–48；`purpose`: `launch` / `buy`；结果使用北京时间 |
| `merit_board` | 可带 `wallet`；返回池子、晨钟、前十、个人排名与 ROI 估算 |

### MCP 不可用时

Skill 安装本身不会自动安装 MCP。若宿主没有上述工具但支持 HTTP，可访问 `https://youqiu.xyz` 的只读 REST 接口；不得假装已经调用 MCP：

| 功能 | REST 降级路径 |
|---|---|
| 快卦 | `POST /v1/ask`，JSON 使用 `question`、`target`、`period`、`topic`、`wallet`；注意 MCP 的 `token` 在这里名为 `target` |
| 测一测 | `GET /v1/read?address=<地址>&kind=auto&wallet=<可选钱包>` |
| 吉时 | `GET /v1/hours?window=24&purpose=launch` |
| 功德榜 | `GET /v1/board?address=<可选钱包>` |

`read` 返回 HTTP 202 / `pending` 时表示生辰仍在索引，应按 `retryAfter` 稍后查询，不反复高频请求。宿主不支持 HTTP 时，明确说明当前无法读取，不编造结果。

代币地址格式正确不代表代币真实或安全。地址不完整时先请用户补充，不起卦、不猜地址。

## 问一卦与算卦

- **快卦（梅花）**：优先调用 `ask_gua`，只读，有每日免费额度；同一事同一时辰返回同一卦。实际剩余次数以 `free_left` 为准，不根据 NFT 持有情况自行增加额度；服务端未明确返回双倍权益时，不得宣称双倍权益。
- **深度卦（六爻）**：先 prepare，再由 Agentic Wallet 支付 LING，最后通过 REST 完成六次摇卦；无需网页确认交易。
- **诚心再问**：同一时辰同一事已问过后，用户可确认销毁 LING 付费再问；结果不保证变好，不诱导用户为得到吉卦重复消费。

深度卦与再问的直接调用流程：

1. `POST /v1/ask/prepare`，JSON 包含 `question`、`target`、`period`、`topic`、`mode`、`reask`、`wallet`。深度卦使用 `mode: "liuyao"`；梅花再问使用 `mode: "meihua", reask: true`。
2. 若返回 `alreadyAsked` / `existing`，先展示已有卦并询问是否付费再问，不直接销毁 LING。正常 prepare 返回 `id`、`ref`、`kind`、`amount`、`contract`。
3. 核对 `contract` 与 `/v1/config` 的 `MeritBoard` 一致，按 `amount` 精确授权 LING，再调用 `MeritBoard.consume(kind, amount, ref)`。不要自行生成或替换 `ref`。
4. 等成功回执后，`POST /v1/ask/<id>/tx`，JSON 为 `{ "txHash": "<交易哈希>" }`；已有 SIWE JWT 时同时带 Bearer token。授权成功不等于问卦成功。
5. 六爻依次调用六次 `POST /v1/ask/<id>/toss`，JSON 带 `wallet`，每次只摇一爻，等待下一次新区块；遇 `WAIT_BLOCK` 按提示稍后重试，不并发刷接口。
6. `GET /v1/ask/<id>` 查询状态，只有完成后再展示真实卦象。梅花再问在付费事件确认后由服务端自动成卦。

## 测一测与合盘

- 钱包以首笔收到 BNB 的区块时间为生辰；未收到过 BNB 的地址属于“未出生”，可查看第一笔入账的推荐吉时。
- 代币以合约部署时间为生辰；结果包含风险凶煞，风险检测与玄学结论应分别呈现。
- 基础结果直接调用 `read_fortune`。完整付费合盘需要链上销毁 LING，只读工具不会解锁付费报告。

完整合盘流程：`POST /v1/hepan/prepare`，JSON 为 `{ "token": "<代币地址>", "wallet": "<用户地址>" }`；核对返回的 `contract`、`kind`、`amount`、`ref`，精确授权后调用 `MeritBoard.consume(kind, amount, ref)`。等待成功回执，再按服务端建议间隔查询 `GET /v1/hepan/<ref>`，直到返回 `report`，不把 pending 当成报告完成。

## 功德箱、晨钟与分红

- **捐 BNB**：Agentic Wallet 调用 `RevenueHub.donate()` 并附用户确认的 `value`。BNB 全额进入平台金库并记功德。
- **销毁 LING**：先精确授权 `MeritBoard`，再调用 `burnForMerit(amount)`；转入黑洞、不可找回，不自动使用无限授权。
- **敲晨钟**：先查 `/v1/bell` 的 `rungToday`、`serverTime` 和 `nextOpenAt`，今日未敲时调用 `MeritPool.ring()`。每日北京时间 00:00 换日；今日已敲时，`nextOpenAt` 指向次日北京时间 00:00。全平台每天仅成功一次，不是每个地址各一次；奖励和分配以合约回执为准。
- **领取分红**：先读 `pending(address)`，有遗留待领取金额才调用 `MeritPool.claim()`。已分配记录不等于这笔 claim 已完成。

## 拜佛、上香与佛像

“拜佛”不是单一交易名称；先问清用户要清香、高香、请佛像、开光、改绑还是设置封面，不擅自选择付费项目。

- **清香**：`freeIncense(buddhaId)`，每日一次，免费但仍需 Gas，只能供当前本命佛。
- **高香**：`consume(3, amount, ref)`，每尊佛每日三支，每支销毁指定数量 LING；逐支确认。
- **请佛像**：实时读取档位价格后精确授权 `BuddhaNFT`，再调用 `mint(t)`；所付 LING 全部销毁，每档限量且每地址每档限一尊。
- **开光**：精确授权 `MeritBoard` 后调用 `consecrate(tokenId, amount)`；销毁 LING，完成后佛像提供每日功德加成。
- **改绑本命佛**：调用 `rebindBuddha(buddhaId)`，已有绑定时 30 天内只能改一次，新绑定次日生效。
- **设置封面**：从本人持有的佛像中选择，调用 `POST /v1/worship/display`，JSON 为 `{ "tokenId": <本人tokenId>, "wallet": "<用户地址>" }`。这是链下设置，不发送交易，不得把其他地址的 NFT 设为用户封面。

## 吉时发射

1. 可用 `lucky_hours` 查询吉时，向用户收集真实名称、符号、Logo、描述、防狙击、买卖税率、税费分配、Royalty 地址与可选预购，不编造资料。
2. 如有本地 Logo，经用户同意后通过 `POST /v1/launch/image` 上传，JSON 为 `filename` 和 `dataBase64`，取得 `imgUrl`。
3. `POST /v1/launch/prepare`，主要字段为 `address`、`mode`、`slotStart`、`name`、`symbol`、`desc`、`imgUrl`、`label`、`webUrl`、`twitterUrl`、`telegramUrl`、`antiSniper`、`royaltyAddress`、`buyTax`、`sellTax`、`alloc`、`minSharing`、`preBuyBnb`。字段约束以服务端校验为准。
4. 使用 prepare 原样返回的 `router`、`launchAt`、`nameSymbolHash`、`metaHash`、`preBuy`、`value`，由 Agentic Wallet 调用 `LaunchRouter.reserve(...)`。预约支付平台服务费；可选预购最多 1 BNB，必须单独提示真实买币的价格与滑点风险。
5. 预约每个时辰限 20 个，先到先得并获得吉时认证；立即发射使用当前时辰名额但无吉时认证，凶时不可预约。
6. 预约成功回执只表示已预约，不表示代币已创建或预购已交付。通过 `GET /v1/launches?scope=mine&address=<地址>` 跟踪状态。
7. 开始前取消由用户明确确认后调用 `cancel(id)`。创建失败或过期的退款按平台流程处理，不承诺即时或自动退款。

## 我的与私密记录

按 `wallet-login.md` 完成 SIWE 签名登录后：

- `GET /v1/me`：查看本人占卜记录、功德、排名与每日分红。
- `PUT /v1/me/birth`：JSON 使用 `date`、`time`，可选 `place`、`gender`，录入或修改生辰。
- `DELETE /v1/me/birth`：删除前向用户说明影响，再调用。
- 生辰加密存储在服务端，不上链。Agent 仅在 SIWE 登录为本人后请求或展示私密占卜详情，不向其他地址泄露；卦象 UUID 不是访问控制凭证，不得把匿名可访问的详情链接当作私密分享方式。JWT 只放授权请求头，不写入日志或 URL。

## 金库边界

平台金库仅限 owner 提现，不是普通用户分红入口。不得引导普通用户调用金库提现，也不得索取 owner 私钥。

## 交易结果与错误

- 用户拒绝签名：停止当前步骤，不重复弹窗，不改成网页交易。
- 已提交但状态未刷新：先查原交易回执和链上状态，避免重复付款；只有成功回执才可报告完成。
- 授权已确认但业务未执行：如实说明剩余精确授权，不声称业务已完成。
- 常见合约回滚及预检方法见 `contracts.md`；`EnforcedPause` 表示协议暂停，不能绕过。
