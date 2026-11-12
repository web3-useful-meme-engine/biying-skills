#!/usr/bin/env node
// 有求必应 CLI：Agent 以「正常登录用户」身份调用 REST 接口（SIWE 签名登录 → JWT）。
// 与网页用户同路径、同额度；不再依赖 MCP。用法见 HELP。
// 环境变量：YOUQIU_API（默认 https://youqiu.xyz）、BIYING_HOME（默认 ~/.biying）
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NOBLE_CURVES_VERSION = '1.9.1';
export const NOBLE_HASHES_VERSION = '1.8.0';

const HELP = `有求必应 CLI（Agent 用，REST + SIWE 登录）

用法：node youqiu.mjs <命令> [参数]

  config                                  读取 /v1/config（chainId、合约地址、参数）
  login                                   用本地 Agent 身份钥登录（首次自动生成；之后静默复用）
  login-message --address 0x..            生成给宿主钱包签名的 SIWE 消息（配合 login --sig）
  login --sig 0x.. --message <文本|@文件>  用宿主钱包的签名完成登录
  me                                      我的占卜记录/功德/排名（须登录）
  read <address> [--kind auto|wallet|token] [--wallet 0x..] [--wait]
                                          测一测（未缓存首查须登录；202 表示生辰索引中）
  ask <buy|sell|launch|other> [target] [--period short|mid|long] [--topic wealth|market] [--wallet 0x..]
                                          快卦（每日免费额度以 free_left 为准）
  hours [--window 1-48] [--purpose launch|buy]   查询吉时（北京时间）
  board [--address 0x..]                  功德榜/晨钟/个人排名
  logout                                  删除本地会话（不撤销链上授权）

登录身份：宿主有钱包签名能力时优先 login-message → 宿主签名 → login --sig（用户真实地址）；
没有钱包的宿主用 login 生成本地 Agent 身份钥（仅用于 SIWE 登录，不持有资产，绝不等同用户钱包）。

输出：成功为 JSON；失败在 stderr 输出 { "error": { "code", "message" } } 并以非零码退出。
401 时若有本地身份钥会自动重登一次再重试。`;

// ---------------- noble 依赖装载（技能目录通常无 node_modules，必要时装入 BIYING_HOME）
let nobleCache = null;
export async function loadNoble(home) {
  if (nobleCache) return nobleCache;
  const bases = [home];
  for (let d = dirname(fileURLToPath(import.meta.url)); d && d !== '/'; d = dirname(d)) {
    bases.push(d);
    if (bases.length > 6) break;
  }
  const tryImport = async (base) => {
    try {
      const curves = await import(pathToFileURL(join(base, 'node_modules/@noble/curves/secp256k1.js')).href);
      const sha3 = await import(pathToFileURL(join(base, 'node_modules/@noble/hashes/sha3.js')).href);
      const utils = await import(pathToFileURL(join(base, 'node_modules/@noble/hashes/utils.js')).href);
      return { secp256k1: curves.secp256k1, keccak_256: sha3.keccak_256, bytesToHex: utils.bytesToHex };
    } catch { return null; }
  };
  for (const base of bases) {
    const found = await tryImport(base);
    if (found) { nobleCache = found; return found; }
  }
  mkdirSync(home, { recursive: true });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const install = spawnSync(npm, ['install', '--prefix', home, '--no-save', '--no-audit', '--no-fund',
    `@noble/curves@${NOBLE_CURVES_VERSION}`, `@noble/hashes@${NOBLE_HASHES_VERSION}`], { encoding: 'utf8' });
  if (install.status !== 0) throw new Error(`自动安装签名依赖失败（需要 npm 与网络）：${install.stderr ?? ''}`.trim());
  const installed = await tryImport(home);
  if (!installed) throw new Error('签名依赖安装后仍无法加载，请检查 node 版本（需 >= 20）');
  nobleCache = installed;
  return installed;
}

// ---------------- 纯密码学函数（导出供测试）
export function checksumAddress(address, keccak_256, bytesToHex) {
  const low = String(address).toLowerCase().replace(/^0x/, '');
  const hash = bytesToHex(keccak_256(low)); // hash 为无前缀 hex（64 字符）
  let out = '0x';
  for (let i = 0; i < low.length; i++) out += parseInt(hash[i], 16) >= 8 ? low[i].toUpperCase() : low[i];
  return out;
}

export function buildSiweMessage({ host, origin, address, chainId, nonce, issuedAt }) {
  return `${host} wants you to sign in with your Ethereum account:\n${address}\n\n`
    + `登录有求必应（只签名，不发交易、不消耗 Gas）\n\n`
    + `URI: ${origin}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
}

/** noble 接受不带 0x 前缀的 hex 或字节作私钥 */
const privToHex = (privHex) => (privHex.startsWith('0x') ? privHex.slice(2) : String(privHex));

export async function addressOf(privHex, noble) {
  const pub = noble.secp256k1.getPublicKey(privToHex(privHex), false);
  const hex = noble.bytesToHex(noble.keccak_256(pub.slice(1)).slice(-20));
  return { lowercase: '0x' + hex, checksummed: checksumAddress('0x' + hex, noble.keccak_256, noble.bytesToHex) };
}

/** EIP-191 personal_sign：与钱包 signMessage 完全一致（确定性签名，RFC6979） */
export async function personalSign(privHex, message, noble) {
  const msgBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  const digest = noble.keccak_256(new Uint8Array([...prefix, ...msgBytes]));
  const sig = noble.secp256k1.sign(digest, privToHex(privHex));
  return '0x' + sig.r.toString(16).padStart(64, '0') + sig.s.toString(16).padStart(64, '0') + (sig.recovery + 27).toString(16).padStart(2, '0');
}

// ---------------- 会话与 HTTP
const API = (process.env.YOUQIU_API ?? 'https://youqiu.xyz').replace(/\/+$/, '');
const HOME = process.env.BIYING_HOME && isAbsolute(process.env.BIYING_HOME) ? process.env.BIYING_HOME : join(homedir(), '.biying');
const identityFile = join(HOME, 'identity.json');
const sessionFile = join(HOME, 'session.json');

const writeSecret = (file, data) => {
  mkdirSync(HOME, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  chmodSync(file, 0o600);
};
const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);

async function call(method, path, { body, token } = {}) {
  const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new Error(`网络请求失败（${API}）：${e.message}`);
  }
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function chainIdOf() {
  const r = await call('GET', '/v1/config');
  if (r.status !== 200) throw new Error(`读取 /v1/config 失败：HTTP ${r.status}`);
  return { chainId: r.json.chainId, config: r.json };
}

async function verifySiwe(message, signature) {
  const r = await call('POST', '/v1/auth/verify', { body: { message, signature } });
  if (r.status !== 200) throw new Error(`登录验证失败：${r.json.error?.code ?? r.status} ${r.json.error?.message ?? ''}`.trim());
  return r.json; // { token, address }
}

/** 生成本地 Agent 身份钥（不是用户钱包：仅用于 SIWE 登录，不含资产） */
async function ensureIdentity() {
  const existing = readJson(identityFile);
  if (existing?.privateKey) return existing.privateKey;
  const privateKey = '0x' + randomBytes(32).toString('hex');
  writeSecret(identityFile, { privateKey, createdAt: new Date().toISOString(), note: 'Agent login identity only — not a funded wallet' });
  return privateKey;
}

async function loginWithKey(privHex, noble) {
  const url = new URL(API);
  const { chainId } = await chainIdOf();
  const nonce = (await call('GET', '/v1/auth/nonce')).json.nonce;
  const { checksummed } = await addressOf(privHex, noble);
  const message = buildSiweMessage({
    host: url.host, origin: url.origin, address: checksummed, chainId,
    nonce, issuedAt: new Date().toISOString(),
  });
  const signature = await personalSign(privHex, message, noble);
  const verified = await verifySiwe(message, signature);
  writeSecret(sessionFile, { address: verified.address, token: verified.token, loginAt: new Date().toISOString(), mode: 'identity' });
  return { address: verified.address, token: verified.token, mode: 'identity' };
}

/** 带 401 自动重登的请求（本地身份钥模式） */
async function authedCall(method, path, { body } = {}) {
  const session = readJson(sessionFile);
  if (!session?.token) {
    const err = new Error('尚未登录：先执行 login（或 login-message + login --sig）');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }
  let r = await call(method, path, { body, token: session.token });
  if (r.status === 401 && existsSync(identityFile)) {
    await loginWithKey(readJson(identityFile).privateKey, await loadNoble(HOME));
    r = await call(method, path, { body, token: readJson(sessionFile).token });
  }
  return r;
}

// ---------------- 命令实现
const commands = {
  async config() {
    const r = await call('GET', '/v1/config');
    if (r.status !== 200) throw new Error(`HTTP ${r.status} ${r.json.error?.message ?? ''}`.trim());
    return r.json;
  },
  async login(args) {
    const sig = args['--sig'], messageArg = args['--message'];
    if (sig && !messageArg) throw new Error('login --sig 需要同时提供 --message（login-message 输出的原消息）');
    if (sig && messageArg) {
      const message = messageArg.startsWith('@') ? readFileSync(messageArg.slice(1), 'utf8').trim() : messageArg;
      const verified = await verifySiwe(message, sig);
      writeSecret(sessionFile, { address: verified.address, token: verified.token, loginAt: new Date().toISOString(), mode: 'wallet' });
      return { address: verified.address, mode: 'wallet' };
    }
    return loginWithKey(await ensureIdentity(), await loadNoble(HOME));
  },
  async loginMessage(args) {
    const address = args['--address'];
    if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '')) throw new Error('--address 必填（0x 开头 40 位十六进制）');
    const url = new URL(API);
    const { chainId } = await chainIdOf();
    const nonce = (await call('GET', '/v1/auth/nonce')).json.nonce;
    const noble = await loadNoble(HOME);
    const message = buildSiweMessage({
      host: url.host, origin: url.origin, chainId, nonce, issuedAt: new Date().toISOString(),
      address: checksumAddress(address, noble.keccak_256, noble.bytesToHex),
    });
    return { message, note: '请用宿主钱包对完整原消息 personal_sign，再执行 login --sig <签名> --message <本消息>（nonce 10 分钟内有效）' };
  },
  async me() {
    const r = await authedCall('GET', '/v1/me');
    if (r.status !== 200) throw new Error(`HTTP ${r.status} ${r.json.error?.message ?? ''}`.trim());
    return r.json;
  },
  async read(args) {
    const address = args._[0];
    if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '')) throw new Error('用法：read <address>（0x 开头 40 位十六进制）');
    const query = new URLSearchParams({ address, kind: args['--kind'] ?? 'auto' });
    if (args['--wallet']) query.set('wallet', args['--wallet']);
    const waits = args['--wait'] ? 6 : 1;
    for (let i = 0; i < waits; i++) {
      const r = await authedCall('GET', `/v1/read?${query}`);
      if (r.status === 202) {
        if (i === waits - 1) return { pending: true, ...r.json };
        await new Promise((ok) => setTimeout(ok, (r.json.retryAfter ?? 5) * 1000));
        continue;
      }
      if (r.status !== 200) throw new Error(`HTTP ${r.status} ${r.json.error?.code ?? ''} ${r.json.error?.message ?? ''}`.trim());
      return r.json;
    }
  },
  async ask(args) {
    const [question, target] = args._;
    if (!['buy', 'sell', 'launch', 'other'].includes(question)) throw new Error('用法：ask <buy|sell|launch|other> [target] [--period ..] [--topic ..]');
    const body = { question, period: args['--period'] ?? 'short' };
    if (target) body.target = target;
    if (args['--topic']) body.topic = args['--topic'];
    const session = readJson(sessionFile);
    body.wallet = args['--wallet'] ?? session?.address;
    const r = await authedCall('POST', '/v1/ask', { body });
    if (r.status !== 200) throw new Error(`HTTP ${r.status} ${r.json.error?.code ?? ''} ${r.json.error?.message ?? ''}`.trim());
    return r.json;
  },
  async hours(args) {
    const query = new URLSearchParams({ window: args['--window'] ?? '24', purpose: args['--purpose'] ?? 'launch' });
    const r = await call('GET', `/v1/hours?${query}`);
    if (r.status !== 200) throw new Error(`HTTP ${r.status} ${r.json.error?.message ?? ''}`.trim());
    return r.json;
  },
  async board(args) {
    const r = await call('GET', '/v1/board' + (args['--address'] ? `?address=${args['--address']}` : ''));
    if (r.status !== 200) throw new Error(`HTTP ${r.status} ${r.json.error?.message ?? ''}`.trim());
    return r.json;
  },
  logout() {
    rmSync(sessionFile, { force: true });
    return { ok: true, note: '本地会话已删除（不撤销链上授权）' };
  },
};

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help') { console.log(HELP); return; }
  if (!commands[cmd]) throw new Error(`未知命令：${cmd}（help 查看用法）`);
  const args = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) args[rest[i]] = (rest[i + 1] ?? '').startsWith('--') || i + 1 === rest.length ? true : rest[++i];
    else args._.push(rest[i]);
  }
  const result = await commands[cmd](args);
  console.log(JSON.stringify(result, null, 2));
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((e) => {
    console.error(JSON.stringify({ error: { code: e.code ?? 'CLI_ERROR', message: e.message } }));
    process.exit(1);
  });
}
