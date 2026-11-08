# Binance Agentic Wallet 登录

## 选择路径

- **Agent 有钱包与签名能力**：读取公开地址，构造 SIWE 消息，请求钱包签名，再提交验证。
- **Agent 没有钱包、无法签名或用户拒绝签名**：不反复催促，返回 `https://youqiu.xyz/#me`，让用户在浏览器连接钱包。
- 持有官方指定 NFT 可认定为 Binance Agentic Wallet，但仍须验证钱包签名。不得仅凭地址、用户自述或 NFT 持有情况建立登录会话。

## Agent 原生签名流程

仅在宿主同时提供钱包签名与 HTTP 请求能力时使用；否则走浏览器路径。

1. 从 `https://youqiu.xyz/v1/config` 读取 `chainId`。
2. `GET /v1/auth/nonce` 获取一次性 nonce。
3. 按以下格式构造消息；域名字段来自站点 URL，地址使用校验和格式，时间使用 ISO 8601：

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

4. 请求 Binance Agentic Wallet 对**完整原消息**签名。不得修改 nonce、域名或 Chain ID，不得要求用户签 `approve`、Permit 或转账。
5. `POST /v1/auth/verify`，JSON body 为 `{ "message": "...", "signature": "0x..." }`。
6. 仅在后端验证成功后称“登录成功”。返回的 token 只能放入宿主的安全会话，不写入 Skill、日志、聊天记录或公开文件。
7. nonce 失效时重新执行完整流程，不复用旧签名。

此 JWT 用于网页“我的”私密数据。当前四个 MCP 只读工具不等于已经实现钱包会话登录，不得把传入 `wallet` 参数描述成签名验证。

## 登录后可用

- 查看和管理“我的命盘”；生辰加密保存在服务端，不上链。
- 查看本人占卜记录、功德、排名和分红记录。
- 断开连接只清除网页连接状态，不撤销已发出的链上授权或交易。
