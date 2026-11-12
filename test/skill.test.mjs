import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('仓库提供标准 Skill 目录和统一安装命令', () => {
  const skillPath = 'skills/biying/SKILL.md';
  assert.ok(existsSync(new URL(skillPath, root)), `${skillPath} 不存在`);
  const skill = read(skillPath);
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter, '缺少 YAML frontmatter');
  const fields = [...frontmatter[1].matchAll(/^([a-z]+):/gm)].map((match) => match[1]);
  assert.deepEqual(fields, ['name', 'description']);
  assert.match(frontmatter[1], /^name: biying$/m);
  assert.match(frontmatter[1], /^description: Use when /m);
  assert.match(read('README.md'), /npx skills add web3-useful-meme-engine\/biying-skills -g/);
});

test('Skill 覆盖登录、日常操作、问卦测命及全部产品功能', () => {
  const skill = read('skills/biying/SKILL.md');
  const workflows = read('skills/biying/references/workflows.md');
  for (const term of ['Binance Agentic Wallet', '钱包登录', '签到', '清香', '高香', '拜佛', '算卦', '测一测', '吉时', '功德', '晨钟', '佛像', '开光', '吉时发射', '占卜记录']) {
    assert.ok(`${skill}\n${workflows}`.includes(term), `缺少功能：${term}`);
  }
  for (const cmd of ['youqiu.mjs', 'login', 'read', 'ask', 'hours', 'board', 'me', 'config']) {
    assert.ok(`${skill}\n${workflows}`.includes(cmd), `缺少脚本命令：${cmd}`);
  }
});

test('Skill 不伪造交易能力并保护钱包和用户资金', () => {
  const content = `${read('skills/biying/SKILL.md')}\n${read('skills/biying/references/workflows.md')}`;
  assert.match(content, /只读/);
  assert.match(content, /不得.*私钥|私钥.*不得/);
  assert.match(content, /交易确认|确认交易/);
  assert.match(content, /交易回执|receipt/);
  assert.match(content, /不构成投资建议/);
  assert.match(content, /action_required/);
  assert.doesNotMatch(content, /0x[a-fA-F0-9]{64}/, '不得包含硬编码私钥');
});

test('Skill 准确区分动态费用、链下封面和全平台晨钟', () => {
  const workflows = read('skills/biying/references/workflows.md');
  assert.match(workflows, /诚心再问[^\n]*销毁 LING/);
  assert.match(workflows, /改绑本命佛[^\n]*30 天/);
  assert.match(workflows, /设置封面[^\n]*(链下|不发送交易)/);
  assert.match(workflows, /晨钟[^\n]*全平台/);
  assert.match(workflows, /签到只给基础签到功德.*加成改随清香发放/);
});

test('写操作直接由 Agentic Wallet 调用真实合约，不跳转网页确认', () => {
  const skill = read('skills/biying/SKILL.md');
  const workflows = read('skills/biying/references/workflows.md');
  const contracts = read('skills/biying/references/contracts.md');
  const content = `${skill}\n${workflows}\n${contracts}`;
  for (const term of ['/v1/config', 'chainId', 'rpcUrl', 'simulateContract', 'writeContract', 'waitForTransactionReceipt', '用户确认']) {
    assert.ok(content.includes(term), `缺少 Agent Wallet 交易步骤：${term}`);
  }
  for (const signature of [
    'checkIn()',
    'freeIncense(uint8 buddhaId,uint256[] tokenIds)',
    'consume(uint8 kind, uint256 amount, bytes32 ref)',
    'burnForMerit(uint256 amount)',
    'donate()',
    'ring()',
    'claim()',
    'mint(uint8 t)',
    'consecrate(uint256 tokenId, uint256 amount)',
    'rebindBuddha(uint8 buddhaId)',
    'reserve(uint64 launchAt, bytes32 nameSymbolHash, bytes32 metaHash, uint256 preBuy)',
    'cancel(uint256 id)',
    'approve(address spender, uint256 amount)',
  ]) {
    assert.ok(contracts.includes(signature), `缺少真实合约方法：${signature}`);
  }
  assert.match(contracts, /checkIn[\s\S]*?MeritBoard/);
  assert.match(contracts, /mint[\s\S]*?BuddhaNFT/);
  assert.match(contracts, /approve[\s\S]*?MeritBoard[\s\S]*?BuddhaNFT/);
  assert.doesNotMatch(contracts, /0x[a-fA-F0-9]{40}/, '合约地址必须从 /v1/config 动态读取');
  assert.doesNotMatch(`${skill}\n${workflows}`, /在网页确认交易|通过网页确认交易|网页写操作|引导网页操作|网页销毁|点击“签到上香”|打开 `https:\/\/youqiu\.xyz\/#/);
});

test('安装器要求的 Node 版本与 package engines 一致', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.engines.node, '>=22.20.0');
  assert.match(read('README.md'), /Node\.js 22\.20\.0/);
});

test('脚本提供 CLI、依赖可自动安装且不含硬编码密钥', async () => {
  const scriptPath = 'skills/biying/scripts/youqiu.mjs';
  assert.ok(existsSync(new URL(scriptPath, root)), `${scriptPath} 不存在`);
  const script = read(scriptPath);
  for (const cmd of ['config', 'login', 'loginMessage', 'read', 'ask', 'hours', 'board', 'me', 'logout']) {
    assert.ok(script.includes(`  ${cmd}(`) || script.includes(`async ${cmd}(`) || script.includes(`  async ${cmd}()`), `缺少命令实现：${cmd}`);
  }
  assert.match(script, /YOUQIU_API/);
  assert.match(script, /BIYING_HOME/);
  assert.match(script, /npm/, '应支持依赖自动安装');
  assert.match(script, /AUTH_REQUIRED/, '未登录应返回明确错误码');
  assert.match(script, /status === 401/, '应处理 401 自动重登');
  assert.match(script, /202/, '应处理 202 pending');
  assert.doesNotMatch(script, /0x[a-fA-F0-9]{64}/, '脚本不得内置私钥');
});

test('脚本签名与 viem/钱包结果一致（确定性向量）', async () => {
  const mod = await import('../skills/biying/scripts/youqiu.mjs');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const home = mkdtempSync(join(tmpdir(), 'biying-noble-'));
  const noble = await mod.loadNoble(home);
  const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  const addr = await mod.addressOf(KEY, noble);
  assert.equal(addr.checksummed, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '地址推导与 viem 一致（EIP-55）');
  const message = mod.buildSiweMessage({
    host: 'localhost', origin: 'http://localhost:8787', address: addr.checksummed,
    chainId: 31337, nonce: 'abc123', issuedAt: '2026-11-12T00:00:00.000Z',
  });
  assert.equal(message,
    'localhost wants you to sign in with your Ethereum account:\n0x70997970C51812dc3A010C7d01b50e0d17dc79C8\n\n'
    + '登录有求必应（只签名，不发交易、不消耗 Gas）\n\n'
    + 'URI: http://localhost:8787\nVersion: 1\nChain ID: 31337\nNonce: abc123\nIssued At: 2026-11-12T00:00:00.000Z',
    'SIWE 消息与服务端 / 网页前端格式一致');
  const sig = await mod.personalSign(KEY, message, noble);
  assert.equal(sig,
    '0x67a2ed1f3d12b17ef78d096dab34ef73962ef52da9aa58dba6101c1c843f2aa16e19af9e878b4d454a2cf1a210d68f4bf2f1d443c9be074f9226ed7f90f37c131c',
    'EIP-191 签名与 viem signMessage 一致（RFC6979 确定性）');
});

test('晨钟使用北京时间 00:00 日界和 nextOpenAt，不错误等待到 08:00', () => {
  const content = `${read('skills/biying/references/contracts.md')}\n${read('skills/biying/references/workflows.md')}`;
  assert.match(content, /nextOpenAt/);
  assert.match(content, /北京时间 00:00/);
  assert.doesNotMatch(content, /08:00/);
});

test('Skill 不把尚未实现的 NFT 双倍权益描述为已生效', () => {
  const content = `${read('skills/biying/SKILL.md')}\n${read('skills/biying/references/workflows.md')}`;
  assert.match(content, /不得宣称双倍权益/);
  assert.doesNotMatch(content, /持有官方指定 NFT.*视为 Binance Agentic Wallet/);
});

test('Skill 不把卦象 UUID 描述成服务端访问控制凭证', () => {
  const workflows = read('skills/biying/references/workflows.md');
  assert.match(workflows, /UUID/);
  assert.match(workflows, /匿名/);
  assert.doesNotMatch(workflows, /占卜详情只允许本人登录后查看/);
});

test('只读能力以 REST + SIWE 登录为主路径，不再依赖 MCP', () => {
  const workflows = read('skills/biying/references/workflows.md');
  const skill = read('skills/biying/SKILL.md');
  assert.match(workflows, /scripts\/youqiu\.mjs/);
  assert.match(workflows, /Authorization: Bearer/);
  for (const endpoint of ['/v1/ask', '/v1/read', '/v1/hours', '/v1/board']) {
    assert.ok(workflows.includes(endpoint), `缺少只读接口：${endpoint}`);
  }
  for (const doc of [skill, workflows, read('skills/biying/references/wallet-login.md')]) {
    assert.doesNotMatch(doc, /read_fortune|ask_gua|lucky_hours|merit_board|\/mcp/, 'MCP 已下线，不得再引导使用');
  }
});

test('发射引导包含服务端实际校验的税率与四项分配结构', () => {
  const workflows = read('skills/biying/references/workflows.md');
  for (const field of ['recipient', 'divide', 'burn', 'liquidity']) {
    assert.match(workflows, new RegExp(`alloc[\\s\\S]*${field}`), `alloc 缺少 ${field}`);
  }
  assert.match(workflows, /四项.*100|100.*四项/);
  assert.match(workflows, /buyTax.*sellTax.*相同|买卖.*税率.*相同/);
  assert.match(workflows, /1%.*3%.*5%.*10%/);
  assert.match(workflows, /minSharing/);
});

test('付费问卦引导准确说明 target 的条件必填规则', () => {
  const workflows = read('skills/biying/references/workflows.md');
  assert.match(workflows, /buy.*sell.*launch.*target.*必填|target.*buy.*sell.*launch.*必填/);
  assert.match(workflows, /other.*topic.*target.*必填|topic.*other.*target.*必填/);
  assert.match(workflows, /不得.*零地址|不要.*零地址/);
});

test('功德操作在签名前预检最小功德，避免小额交易模拟回滚', () => {
  const contracts = read('skills/biying/references/contracts.md');
  assert.match(contracts, /previewLingMerit/);
  assert.match(contracts, /MeritTooSmall/);
  assert.match(contracts, /meritPerBnb/);
  assert.match(contracts, /1e18/);
  assert.doesNotMatch(contracts, /burnForMerit[^\n]*minAmount\(4\)/);
});
