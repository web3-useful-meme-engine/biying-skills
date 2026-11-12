# 功能与操作参考

## 能力边界

只读 REST（经 `scripts/youqiu.mjs`，SIWE 登录后同网页用户）与链上写操作必须分开。需要交易时，读取 `contracts.md` 的真实方法，由 Agent 构造调用并在 Binance Agentic Wallet 中请求用户签名；不要跳转网页确认交易。所有次数、价格和额度以实时接口、链上读取及钱包确认内容为准。

## 命令速查（scripts/youqiu.mjs）

环境变量：`YOUQIU_API`（默认 `https://youqiu.xyz`）、`BIYING_HOME`（默认 `~/.biying`）。成功输出 JSON；失败输出 `{ "error": { "code", "message" } }` 并非零退出。

| 命令 | 说明 |
|---|---|
| `config` | `GET /v1/config`：chainId、rpcUrl、合约地址、费率、免费额度 |
| `login` | 本地 Agent 身份钥登录（首次自动生成）；`login-message` + `login --sig` 用宿主钱包真实地址登录 |
| `read <address> [--kind auto\|wallet\|token] [--wallet 0x..] [--wait]` | `GET /v1/read` 测一测；未缓存首查须登录；202 = 生辰索引中，`--wait` 按提示轮询 |
| `ask <buy\|sell\|launch\|other> [target] [--period short\|mid\|long] [--topic wealth\|market] [--wallet 0x..]` | `POST /v1/ask` 快卦；不传 `--wallet` 时默认用登录地址 |
| `hours [--window 1-48] [--purpose launch\|buy]` | `GET /v1/hours` 吉时（北京时间）。**默认 purpose=launch；查买入吉时必须显式 `--purpose buy`**（响应不回显口径，自行记住请求参数） |
| `board [--address 0x..]` | `GET /v1/board` 功德池、晨钟、前十、个人排名与 ROI 估算 |
| `me` / `logout` | `GET /v1/me` 私密记录 / 删除本地会话 |

宿主支持 HTTP 但不运行脚本时，可直接调 REST：`POST /v1/ask`（JSON 用 `question`、`target`、`period`、`topic`、`wallet`）、`GET /v1/read?address=<地址>&kind=auto&wallet=<可选>`、`GET /v1/hours?window=24&purpose=launch`、`GET /v1/board?address=<可选钱包>`；须登录的接口带 `Authorization: Bearer <JWT>`。不得假装已经调用。

`read` 返回 HTTP 202 / `pending` 时表示生辰仍在索引，应按 `retryAfter` 稍后查询，不反复高频请求。偶发网络瞬断（fetch failed / 连接拒绝）时等几秒重试同一命令即可；脚本已处理 202 与 401 自动重登，其余失败按错误信息处理，不编造结果。

代币地址格式正确不代表代币真实或安全。地址不完整时先请用户补充，不起卦、不猜地址。

## 返回字段速览（读结果时用）

- **`read` 的 `kind`**：`unborn`（未收到过 BNB，附首笔入账推荐吉时）/ `wallet`（已出生钱包）/ `token`（代币，含四项风险检测，风险与玄学分开转述）。代币/合盘结果体积大（完整八字 + 紫微十二宫），**向用户转述时摘要等级、分数、生辰与风险，不要全文粘贴**。
- **`board`**：`top`（前十榜）/ `sum`（当前池总量）/ `cut`（已封盘待下次分配）/ `me`（本人 merit、rank、onBoard）/ `pool`（池子代币与状态）/ `roi`（ROI 估算）/ `bellsLeft`（今日剩余敲钟窗口）/ `perMeritYesterday`（昨日每功德单价）。
- **`me`**：`birth`（本人录入的生辰，未录为 null）/ `birthLocked`（已请佛像后锁定）/ `chart`（命盘）/ `history`（近期卦象列表）/ `accuracy`（30 天验证命中率）/ `dividends`（分红记录，带 token 单位）/ `ledger`（功德流水）。
- **`ask`（快卦）**：`gua.main.name`（本卦）/ `gua.changed`（变卦）/ `grade`（等级）/ `score` / `freeLeft`（今日剩余免费次数）；同一事同一时辰重复 `ask` 返回同一 `id`、不扣次数。

## 每日推荐顺序

1. 获取用户地址，运行 `config`，再请求 `GET /v1/worship?address=<地址>` 查看 `me.checkedInToday`、`me.incensedToday`、本命佛和 NFT。
2. 未签到时调用 `MeritBoard.checkIn()`（无参数）。签到只给基础签到功德；已开光佛像的每日加成改随清香发放。
3. 未上清香时调用 `MeritBoard.freeIncense(me.buddhaId, tokenIds)`，tokenIds 为本人已开光佛像 tokenId（最多 20 个，无佛像传空数组）。清香每日一次，不收清香费，但需要 BNB Gas；佛像每日加成随清香一并结算，同材质档位多尊每日只计一尊。
4. 用户明确要求高香时，按合约参考精确授权 LING，再调用 `highIncense(buddhaId, amount, tokenIds)`（tokenIds 传用户已开光佛像，可空）；不要把高香混入默认免费流程。
5. 用 `board` 查看功德池、个人排名与晨钟状态。每尊佛每天第一炉为头香，上香者功德加倍。

## 问一卦与算卦

- **快卦（梅花）**：`ask` 命令，只读，有每日免费额度；同一事同一时辰返回同一卦。实际剩余次数以 `free_left` 为准，不根据 NFT 持有情况自行增加额度；服务端未明确返回双倍权益时，不得宣称双倍权益。
- **深度卦（六爻）**：先 prepare，再由 Agentic Wallet 支付 LING，最后通过 REST 完成六次摇卦；无需网页确认交易。
- **诚心再问**：同一时辰同一事已问过后，用户可确认销毁 LING 付费再问；结果不保证变好，不诱导用户为得到吉卦重复消费。

深度卦与再问的直接调用流程：

1. `POST /v1/ask/prepare`，JSON 包含 `question`、`target`、`period`、`topic`、`mode`、`reask`、`wallet`。深度卦使用 `mode: "liuyao"`；梅花再问使用 `mode: "meihua", reask: true`。`buy` / `sell` / `launch` 的 `target` 必填；`other` 选择 `topic: "wealth" / "market"` 时 `target` 也必填，只有不带 `topic` 的 `other` 才可留空。不得使用零地址，不知道目标时先向用户确认。
2. 若返回 `alreadyAsked` / `existing`，先展示已有卦并询问是否付费再问，不直接销毁 LING。正常 prepare 返回 `id`、`ref`、`kind`、`amount`、`contract`。
3. 核对 `contract` 与 `/v1/config` 的 `MeritBoard` 一致，按 `amount` 精确授权 LING，再调用 `MeritBoard.consume(kind, amount, ref)`。不要自行生成或替换 `ref`。
4. 等成功回执后，`POST /v1/ask/<id>/tx`，JSON 为 `{ "txHash": "<交易哈希>" }`；已登录时同时带 Bearer token。授权成功不等于问卦成功。
5. 六爻依次调用六次 `POST /v1/ask/<id>/toss`，JSON 带 `wallet`，每次只摇一爻，等待下一次新区块；遇 `WAIT_BLOCK` 按提示稍后重试，不并发刷接口。
6. `GET /v1/ask/<id>` 查询状态，只有完成后再展示真实卦象。梅花再问在付费事件确认后由服务端自动成卦。

## 测一测与合盘

- 测一测须登录（2026-11 起）：先用脚本 `login`，未登录对未缓存地址首查会返回 401 `AUTH_REQUIRED`；已缓存地址不受限。
- 钱包以首笔收到 BNB 的区块时间为生辰；未收到过 BNB 的地址属于“未出生”，可查看第一笔入账的推荐吉时。
- 代币以合约部署时间为生辰；结果包含风险凶煞，风险检测与玄学结论应分别呈现。
- 基础结果直接 `read`。完整付费合盘需要链上销毁 LING，只读接口不会解锁付费报告。

完整合盘流程：`POST /v1/hepan/prepare`，JSON 为 `{ "token": "<代币地址>", "wallet": "<用户地址>" }`；核对返回的 `contract`、`kind`、`amount`、`ref`，精确授权后调用 `MeritBoard.consume(kind, amount, ref)`。等待成功回执，再按服务端建议间隔查询 `GET /v1/hepan/<ref>`，直到返回 `report`，不把 pending 当成报告完成。

## 功德箱、晨钟与分红

- **捐 BNB**：Agentic Wallet 调用 `RevenueHub.donate()` 并附用户确认的 `value`。BNB 全额进入平台金库并记功德。
- **销毁 LING**：先精确授权 `MeritBoard`，再调用 `burnForMerit(amount)`；转入黑洞、不可找回，不自动使用无限授权。
- **敲晨钟**：先查 `/v1/bell` 的 `rungToday`、`serverTime` 和 `nextOpenAt`，今日未敲时调用 `MeritPool.ring()`。每日北京时间 00:00 换日；今日已敲时，`nextOpenAt` 指向次日北京时间 00:00。全平台每天仅成功一次，不是每个地址各一次；奖励和分配以合约回执为准。
- **领取分红**：先读 `pending(address)`，有遗留待领取金额才调用 `MeritPool.claim()`。已分配记录不等于这笔 claim 已完成。

## 拜佛、上香与佛像

“拜佛”不是单一交易名称；先问清用户要清香、高香、请佛像、开光、改绑还是设置封面，不擅自选择付费项目。

- **清香**：`freeIncense(buddhaId, tokenIds)`，每日一次，免费但仍需 Gas，只能供当前本命佛；随清香一并结算佛像每日加成。
- **高香**：`highIncense(buddhaId, amount, tokenIds)`，每尊佛每日三支，每支销毁指定数量 LING 并结算这一炉的佛像加成（每炉独立、同档去重）；逐支确认。
- **请佛像**：实时读取档位价格后精确授权 `BuddhaNFT`，再调用 `mint(t)`；所付 LING 全部销毁，每档限量且每地址每档限一尊。
- **开光**：精确授权 `MeritBoard` 后调用 `consecrate(tokenId, amount)`；销毁 LING，完成后佛像提供每日功德加成。
- **改绑本命佛**：调用 `rebindBuddha(buddhaId)`，已有绑定时 30 天内只能改一次，新绑定次日生效。
- **设置封面**：从本人持有的佛像中选择，调用 `POST /v1/worship/display`，JSON 为 `{ "tokenId": <本人tokenId>, "wallet": "<用户地址>" }`。这是链下设置，不发送交易，不得把其他地址的 NFT 设为用户封面。

## 吉时发射

1. 可用 `hours` 查询吉时，向用户收集真实名称、符号、Logo、描述、防狙击、买卖税率、税费分配、Royalty 地址与可选预购，不编造资料。
2. 如有本地 Logo，经用户同意后通过 `POST /v1/launch/image` 上传，JSON 为 `filename` 和 `dataBase64`，取得 `imgUrl`。
3. `POST /v1/launch/prepare`，主要字段为 `address`、`mode`、`slotStart`、`name`、`symbol`、`desc`、`imgUrl`、`label`、`webUrl`、`twitterUrl`、`telegramUrl`、`antiSniper`、`royaltyAddress`、`buyTax`、`sellTax`、`alloc`、`minSharing`、`preBuyBnb`。`buyTax` 与 `sellTax` 只能选 `1% / 3% / 5% / 10%` 且买卖税率必须相同；`alloc` 必须是 `{ "recipient": number, "divide": number, "burn": number, "liquidity": number }`，四项均为 0–100 的整数且四项之和为 100%。`minSharing` 是 `d×10ⁿ`（`d=1–9`、`n≥5`）的代币数量字符串，例如 `"100000"`。
4. 使用 prepare 原样返回的 `router`、`launchAt`、`nameSymbolHash`、`metaHash`、`preBuy`、`value`，由 Agentic Wallet 调用 `LaunchRouter.reserve(...)`。预约支付平台服务费；可选预购最多 1 BNB，必须单独提示真实买币的价格与滑点风险。
5. 预约每个时辰限 20 个，先到先得并获得吉时认证；立即发射使用当前时辰名额但无吉时认证，凶时不可预约。
6. 预约成功回执只表示已预约，不表示代币已创建或预购已交付。通过 `GET /v1/launches?scope=mine&address=<地址>` 跟踪状态。
7. 开始前取消由用户明确确认后调用 `cancel(id)`。创建失败或过期的退款按平台流程处理，不承诺即时或自动退款。

## 我的与私密记录

按 `wallet-login.md` 完成登录后：

- `me`（`GET /v1/me`，带 Bearer）：查看本人占卜记录、功德、排名与每日分红。
- `PUT /v1/me/birth`：JSON 使用 `date`、`time`，可选 `place`、`gender`，录入或修改生辰。
- `DELETE /v1/me/birth`：删除前向用户说明影响，再调用。
- 生辰加密存储在服务端，不上链。Agent 仅在登录为本人后请求或展示私密占卜详情，不向其他地址泄露；卦象 UUID 不是访问控制凭证，不得把匿名可访问的详情链接当作私密分享方式。JWT 只放授权请求头，不写入日志或 URL。

## 金库边界

平台金库仅限 owner 提现，不是普通用户分红入口。不得引导普通用户调用金库提现，也不得索取 owner 私钥。

## 交易结果与错误

- 用户拒绝签名：停止当前步骤，不重复弹窗，不改成网页交易。
- 已提交但状态未刷新：先查原交易回执和链上状态，避免重复付款；只有成功回执才可报告完成。
- 授权已确认但业务未执行：如实说明剩余精确授权，不声称业务已完成。
- 常见合约回滚及预检方法见 `contracts.md`；`EnforcedPause` 表示协议暂停，不能绕过。
