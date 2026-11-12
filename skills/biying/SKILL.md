---
name: biying
description: Use when a Binance Agentic Wallet user asks about 有求必应, 必应, Biying, wallet login, check-in, incense, worship, fortune reading, divination, auspicious hours, merit, Buddha NFTs, or token launches.
---

# 有求必应

## Overview

在 Binance Agentic Wallet 中使用有求必应。官方 API 与入口为 `https://youqiu.xyz`。Agent 通过 `scripts/youqiu.mjs` 以**正常登录用户**身份调用 REST 接口（SIWE 签名登录 → JWT），与网页用户同路径、同额度，没有 MCP 或特殊通道；签到、上香、付费问卦、功德、佛像和发射仍由 Agent 直接构造合约调用，并在用户 Agent 控制的钱包中请求交易签名，不跳转网页确认交易。

## 先判断操作类型

| 用户意图 | 做法 |
|---|---|
| 问买入、卖出、发射或交易类事项 | `youqiu.mjs ask`（快卦）；深度卦见 workflows |
| 测钱包、测代币、查看合盘 | 先 `login` 再 `youqiu.mjs read` |
| 查询未来吉时 | `youqiu.mjs hours` |
| 查功德池、排名、晨钟状态 | `youqiu.mjs board` |
| 钱包登录、私密命盘、占卜记录 | 按 `references/wallet-login.md`（`login-message` / `login --sig` / `me`） |
| 签到、上香、拜佛、付费问卦、捐赠、佛像、发射 | 先读 `references/contracts.md`，再按 `references/workflows.md` 直接调用合约 |

## 核心规则

1. 只读查询全部走 REST（`config` / `read` / `ask` / `hours` / `board`），本身**只读**、不发交易；测一测的未缓存首查须登录（无 JWT 返回 401），先用脚本完成 SIWE 登录再查。
2. 接口返回 `action_required` 时表示还需执行相应步骤，不表示失败或已经完成；需要链上写操作时读取合约参考，不引导网页确认。
3. Binance NFT 身份和双倍额度必须由服务端识别并明确返回，不能替代钱包签名。不得猜测或硬编码 NFT 地址；服务端未明确返回该权益时，不得宣称双倍权益或自行增加额度。
4. 不得索取、接收或保存**用户的**私钥、助记词、钱包恢复码；所有资金相关签名必须通过用户钱包完成。唯一例外：`youqiu.mjs login` 在本地生成的 Agent 身份钥——它仅用于 SIWE 登录、由脚本自持（`~/.biying/identity.json`，0600）、不含任何资产，绝不等同或接触用户钱包。
5. 每次交易前说明网络、目标合约、方法、关键参数、资产、数量、是否授权及是否永久销毁。先模拟并取得用户确认，再由 Agentic Wallet 请求签名。
6. LING 默认只授权本次精确金额；授权与业务交易分别确认。授权成功不等于业务成功。
7. 有哈希只能称“已提交”；成功交易回执（receipt）后才能称“已完成”。回滚不得报告成功，不自动重复付款。
8. 宿主没有钱包或交易能力时：只读与登录仍可用（脚本本地身份钥）；链上写操作不假装已调用，也不把网页交易作为替代路径，说明需要可签名的 Agentic Wallet。
9. 所有卦象、命盘和吉时仅作文化娱乐，不构成投资建议，不包装成收益承诺或代币安全审计。

## 标准流程

1. 获取用户公开地址并校验格式，运行 `youqiu.mjs config`，核对 `chainId`、`rpcUrl` 和本次目标合约。
2. 需要「测一测 / 我的」等须登录的功能时先 `login`（宿主有钱包则 `login-message` → 宿主签名 → `login --sig`，用用户真实地址；否则脚本本地身份钥），会话保存在本地，401 自动重登。
3. 查询今日状态、余额、授权和业务前提，已完成或不可执行时不发送交易。
4. 按 `references/contracts.md` 构造调用并执行 `simulateContract` 或等价模拟；展示方法、参数、资产和 Gas，取得用户确认。
5. 用 Agentic Wallet 的 `writeContract` / `eth_sendTransaction` 请求用户签名并提交。
6. 用 `waitForTransactionReceipt` / `eth_getTransactionReceipt` 查询结果；只有 `status === 'success'` 才报告完成。
7. 日常操作按“签到 → 清香 → 功德状态”执行，每一步分别确认；高香、深度卦、开光和发射额外提示 LING 销毁或 BNB 费用。

详细命令、业务编排、REST prepare 和链下步骤见 `references/workflows.md`；SIWE 登录细节见 `references/wallet-login.md`。
