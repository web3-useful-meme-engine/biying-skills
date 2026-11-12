# 钱包登录（SIWE）

## 选择路径

- **宿主有钱包与签名能力**：`youqiu.mjs login-message --address <用户地址>` 生成 SIWE 消息 → 宿主钱包对**完整原消息** `personal_sign` → `youqiu.mjs login --sig <签名> --message <原消息>`（或 `--message @消息文件`）。登录身份即用户真实地址。
- **宿主没有钱包或无法签名**：直接 `youqiu.mjs login`。脚本首次运行会在本地生成一把 Agent 身份钥（`$BIYING_HOME/identity.json`，默认 `~/.biying`，权限 0600），仅用于 SIWE 登录，不持有资产、绝不等同用户钱包，之后静默复用。
- 两条路径都是「正常登录用户」：与网页同路径、同额度（JWT 7 天有效，脚本在 401 时自动重登）。
- 持有官方指定 NFT 可认定为 Binance Agentic Wallet，但仍须验证钱包签名。不得仅凭地址、用户自述或 NFT 持有情况建立登录会话。

## 登录机制（脚本内部流程，无需手工执行）

1. `GET /v1/config` 读取 `chainId`（本地联调时以环境变量 `YOUQIU_API` 覆盖，如 `http://localhost:8787`）。
2. `GET /v1/auth/nonce` 获取一次性 nonce（10 分钟内有效、只能用一次）。
3. 按以下格式构造消息；域名字段来自 API 站点 URL，地址使用校验和格式，时间使用 ISO 8601：

```text
<host> wants you to sign in with your Ethereum account:
<checksummed-address>

登录有求必应（只签名，不发交易、不消耗 Gas）

URI: <origin>
Version: 1
Chain ID: <chainId>
Nonce: <nonce>
Issued At: <current-ISO-time>
```

4. 对**完整原消息**做 EIP-191 `personal_sign`。不得修改 nonce、域名或 Chain ID，不得要求用户签 `approve`、Permit 或转账。
5. `POST /v1/auth/verify`，JSON body 为 `{ "message": "...", "signature": "0x..." }`。
6. 仅在后端验证成功后称“登录成功”。返回的 JWT 保存在 `$BIYING_HOME/session.json`（0600），只随 `Authorization: Bearer` 请求头发送，不写入日志、聊天记录或公开文件。
7. nonce 失效或 401 时重新走完整流程，不复用旧签名。

## 登录后可用

- `youqiu.mjs me`（或带 Bearer 的 `GET /v1/me`）：本人占卜记录、功德、排名与每日分红。
- `youqiu.mjs read`：测一测未缓存地址的首查（2026-11 起须登录；已缓存地址不受限）。
- `PUT /v1/me/birth`：JSON 使用 `date`、`time`，可选 `place`、`gender`，录入或修改生辰（须带 Bearer）。
- `DELETE /v1/me/birth`：删除前向用户说明影响，再调用。
- 生辰加密存储在服务端，不上链。Agent 仅在登录为本人后请求或展示私密占卜详情，不向其他地址泄露。
- `logout` 只删除本地会话，不撤销已发出的链上授权或交易。

## 签名依赖

脚本需要 `@noble/curves` / `@noble/hashes` 做 EIP-191 签名：优先复用技能目录或 `BIYING_HOME` 下已有的 `node_modules`，都没有时自动 `npm install` 装入 `BIYING_HOME`（需要网络与 npm）。装不上时按上面消息格式自构造签名亦可，不得因此编造登录成功。
