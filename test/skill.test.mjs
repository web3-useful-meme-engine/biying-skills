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
  for (const tool of ['ask_gua', 'read_fortune', 'lucky_hours', 'merit_board']) {
    assert.ok(skill.includes(tool), `缺少 MCP 工具：${tool}`);
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
  assert.match(workflows, /签到只完成签到，不同时完成清香/);
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
    'checkIn(uint256[] tokenIds)',
    'freeIncense(uint8 buddhaId)',
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

test('没有安装 MCP 时仍可使用只读 REST 降级路径', () => {
  const workflows = read('skills/biying/references/workflows.md');
  assert.match(workflows, /MCP 不可用/);
  for (const endpoint of ['/v1/ask', '/v1/read', '/v1/hours', '/v1/board']) {
    assert.ok(workflows.includes(endpoint), `缺少降级接口：${endpoint}`);
  }
});
