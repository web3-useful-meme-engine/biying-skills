# biying-skills

有求必应（Biying）的 Binance Agentic Wallet Skill。安装后，Agent 可以引导钱包登录、每日签到、清香、高香、拜佛、问卦、测一测、吉时、功德、佛像与吉时发射等功能。

## 安装

需要 Node.js 22.20.0 或更高版本（`skills` 安装器要求）。

```bash
npx skills add web3-useful-meme-engine/biying-skills -g
```

## 使用示例

- “帮我完成今天的签到和清香。”
- “测一测我的钱包命盘。”
- “这个代币现在买入吉不吉？合约地址是 …”
- “查未来 24 小时的发射吉时。”
- “帮我开光佛像，先模拟并说明费用，再让我直接在 Agentic Wallet 确认。”

## 能力与边界

- 快卦、测一测、吉时和功德榜优先使用只读 MCP 工具；未安装 MCP 时可使用只读 REST 接口。
- 登录优先由 Agent 管理的钱包完成 SIWE 签名；无钱包时才使用浏览器。
- 签到、上香、付费问卦、功德箱、佛像与发射由 Agent 直接构造合约调用，用户在 Agent 控制的钱包中逐项确认，不跳转网页交易。
- 不需要独立 CLI，不接收或保存私钥、助记词。
- 所有命理与卦象仅供文化娱乐，不构成投资建议。

## 目录

```text
skills/biying/
├── SKILL.md
└── references/
    ├── wallet-login.md
    ├── contracts.md
    └── workflows.md
test/
└── skill.test.mjs
```

## 本地校验

```bash
npm test
npx skills add . --list
```
