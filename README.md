# biying-skills

有求必应（Biying）的 Binance Agentic Wallet Skill。安装后，Agent 可以引导钱包登录、每日签到、清香、高香、拜佛、问卦、测一测、吉时、功德、佛像与吉时发射等功能。

## 安装

需要 Node.js 22.20.0 或更高版本（`skills` 安装器要求）。

```bash
npx skills add web3-useful-meme-engine/biying-skills -g
```

## 只读查询：youqiu.mjs（REST + SIWE 登录）

Agent 以**正常登录用户**身份调用 REST 接口，与网页用户同路径、同额度（不再依赖 MCP）：

```bash
SKILL=skills/biying/scripts/youqiu.mjs   # 安装后在技能目录下
node $SKILL config                        # chainId、合约地址、费率
node $SKILL login                         # 本地 Agent 身份钥登录（首次自动生成）
node $SKILL login-message --address 0x..  # 或：宿主钱包签名登录（真实用户地址）
node $SKILL read 0x..                     # 测一测（未缓存首查须先 login）
node $SKILL ask buy 0x..                  # 快卦
node $SKILL hours --window 24             # 吉时
node $SKILL board                         # 功德榜
node $SKILL me                            # 我的记录（须登录）
```

环境变量：`YOUQIU_API`（默认 `https://youqiu.xyz`，本地联调设为 `http://localhost:8787`）、`BIYING_HOME`（默认 `~/.biying`，存身份钥与会话，0600）。签名依赖 `@noble/*` 缺失时脚本会自动装入 `BIYING_HOME`。

## 使用示例

- “帮我完成今天的签到和清香。”
- “测一测我的钱包命盘。”
- “这个代币现在买入吉不吉？合约地址是 …”
- “查未来 24 小时的发射吉时。”
- “帮我开光佛像，先模拟并说明费用，再让我直接在 Agentic Wallet 确认。”

## 能力与边界

- 快卦、测一测、吉时和功德榜走 REST；测一测未缓存首查与私密记录须 SIWE 登录。
- 登录优先由 Agent 管理的钱包完成 SIWE 签名；无钱包宿主用脚本本地身份钥（仅登录用，不含资产）。
- 签到、上香、付费问卦、功德箱、佛像与发射由 Agent 直接构造合约调用，用户在 Agent 控制的钱包中逐项确认，不跳转网页交易。
- 不接收或保存用户的私钥、助记词；脚本自生成的身份钥仅用于登录、由脚本自持。
- 所有命理与卦象仅供文化娱乐，不构成投资建议。

## 目录

```text
skills/biying/
├── SKILL.md
├── scripts/
│   └── youqiu.mjs        # REST + SIWE 登录 CLI
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
