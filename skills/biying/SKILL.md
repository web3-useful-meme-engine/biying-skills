---
name: biying
description: Use when a Binance Agentic Wallet user asks about 有求必应, 必应, Biying, wallet login, check-in, incense, worship, fortune reading, divination, auspicious hours, merit, Buddha NFTs, or token launches.
---

# 有求必应

## Overview

在 Binance Agentic Wallet 中使用有求必应。官方 API 与入口为 `https://youqiu.xyz`。只读功能走 MCP/REST；签到、上香、付费问卦、功德、佛像和发射由 Agent 直接构造合约调用，并在用户 Agent 控制的钱包中请求交易签名，不跳转网页确认交易。

## 先判断操作类型

| 用户意图 | 首选能力 |
|---|---|
| 问买入、卖出、发射或交易类事项 | `ask_gua` |
| 测钱包、测代币、查看合盘 | `read_fortune` |
| 查询未来吉时 | `lucky_hours` |
| 查功德池、排名、晨钟状态 | `merit_board` |
| 钱包登录、私密命盘、占卜记录 | 按 `references/wallet-login.md` |
| 签到、上香、拜佛、付费问卦、捐赠、佛像、发射 | 先读 `references/contracts.md`，再按 `references/workflows.md` 直接调用合约 |

## 核心规则

1. 当前 MCP 的 `ask_gua`、`read_fortune`、`lucky_hours`、`merit_board` 均为**只读**。它们本身不能完成钱包登录或链上写操作，但这不妨碍 Agentic Wallet 直接调用合约。
2. 工具返回 `action_required` 时表示还需执行相应步骤，不表示失败或已经完成；需要链上写操作时读取合约参考，不引导网页确认。
3. 持有官方指定 NFT 的地址视为 Binance Agentic Wallet；NFT 只用于身份与权益识别，不能替代签名。NFT 地址由服务端配置，不得猜测或硬编码。
4. 不得索取、接收、生成或保存用户私钥、助记词、钱包恢复码。所有签名必须通过用户钱包完成。
5. 每次交易前说明网络、目标合约、方法、关键参数、资产、数量、是否授权及是否永久销毁。先模拟并取得用户确认，再由 Agentic Wallet 请求签名。
6. LING 默认只授权本次精确金额；授权与业务交易分别确认。授权成功不等于业务成功。
7. 有哈希只能称“已提交”；成功交易回执（receipt）后才能称“已完成”。回滚不得报告成功，不自动重复付款。
8. 宿主没有钱包或交易能力时，不假装已调用，也不把网页交易作为替代路径；说明需要可签名的 Agentic Wallet。仅 SIWE 登录可按钱包登录参考使用浏览器降级。
9. 所有卦象、命盘和吉时仅作文化娱乐，不构成投资建议，不包装成收益承诺或代币安全审计。

## 标准交易流程

1. 获取用户公开地址并校验格式，读取 `GET /v1/config`，核对 `chainId`、`rpcUrl` 和本次目标合约。
2. 查询今日状态、余额、授权和业务前提，已完成或不可执行时不发送交易。
3. 按 `references/contracts.md` 构造调用并执行 `simulateContract` 或等价模拟；展示方法、参数、资产和 Gas，取得用户确认。
4. 用 Agentic Wallet 的 `writeContract` / `eth_sendTransaction` 请求用户签名并提交。
5. 用 `waitForTransactionReceipt` / `eth_getTransactionReceipt` 查询结果；只有 `status === 'success'` 才报告完成。
6. 日常操作按“签到 → 清香 → 功德状态”执行，每一步分别确认；高香、深度卦、开光和发射额外提示 LING 销毁或 BNB 费用。

详细业务编排、REST prepare 和链下步骤见 `references/workflows.md`。
