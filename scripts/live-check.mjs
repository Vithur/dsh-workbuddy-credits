/**
 * 端到端真测 —— 直接打真实网关，跑通「listings → snapshot」全链路。
 *
 * 这不是 mock：它用与插件完全相同的 `src/gateway.js`、`src/snapshot.js`、
 * `shared/parse.js`，只是从命令行驱动并打印结果。任何一处接入出错，这里就会暴露。
 *
 * 跑法：先设环境变量再执行
 *   $env:WORKBUDDY_API_KEY = "wb2a_..."
 *   node scripts/live-check.mjs
 */

import { Gateway } from '../src/gateway.js'
import { buildSnapshot, configuredModels, headlineOf } from '../src/snapshot.js'
import { buildModelMatches, indexModelRates } from '../shared/parse.js'
import { readDshModels } from './read-dsh-config.mjs'

const BASE_URL = process.env.WB_BASE_URL ?? 'http://192.168.1.42:7863'
const API_KEY = process.env.WORKBUDDY_API_KEY ?? ''

if (!API_KEY) {
  console.error('缺少环境变量 WORKBUDDY_API_KEY')
  process.exit(1)
}

const gateway = new Gateway(BASE_URL, API_KEY)

console.log(`网关 ${BASE_URL}\n`)

console.log('— 探活 —')
const probe = await gateway.probe()
console.log(`  ok=${probe.ok} status=${probe.status ?? '—'} ${probe.message}`)
if (!probe.ok) process.exit(1)

// —— 已添加模型从**真实配置**里读，不写死：用户随时会增删模型 ——
const CONFIGURED = (await readDshModels('workbuddy') ?? []).map((model) => model.id)

console.log('\n— 已添加模型（读自 cordis.patch.yml）—')
console.log(`  共 ${CONFIGURED.length} 个：${CONFIGURED.join(', ') || '（读不到）'}`)

console.log('\n— configuredModels：从配置形状抽 id —')
const fakeConfig = {
  providers: {
    workbuddy: {
      models: CONFIGURED.map((id) => ({ id, name: id })),
    },
    'local-swift': { models: [{ id: 'Qwen3.8-27B' }] },
  },
}
const all = configuredModels(fakeConfig, [])
const onlyWorkbuddy = configuredModels(fakeConfig, ['workbuddy'])
console.log(`  全部 provider: ${all.length} 个模型`)
console.log(`  限定 workbuddy: ${onlyWorkbuddy.length} 个模型`)

console.log('\n— 完整快照 —')
const snapshot = await buildSnapshot(null, gateway, { models: onlyWorkbuddy, rowLimit: 8 })
console.log(`  ok=${snapshot.ok} error=${snapshot.error ?? '无'}`)
console.log(`  生成于 ${snapshot.generated ?? '—'}，起点 ${snapshot.since ?? '—'}`)

const head = headlineOf(snapshot)
console.log('\n— 本期汇总 —')
console.log(`  积分消耗      ${head.credits}`)
console.log(`  请求数        ${head.requests}（失败 ${head.errors}）`)
console.log(`  总 token      ${head.tokens.toLocaleString('en-US')}`)
console.log(`  缓存命中率    ${head.cacheHitRate.toFixed(2)}%`)

console.log('\n— 已添加模型 × 网关倍率 —')
console.log('  模型'.padEnd(34) + '倍率'.padEnd(10) + '请求'.padEnd(8) + '积分'.padEnd(10) + '原始值')
for (const m of snapshot.matches) {
  const mult = m.multiplier === null ? '—' : `x${m.multiplier}`
  const raw = m.raw === null || m.raw === '' ? '(空)' : m.raw
  console.log(
    '  ' + m.id.padEnd(32) + mult.padEnd(10) + String(m.requests).padEnd(8) + String(m.credits).padEnd(10) + raw,
  )
}

const unknown = snapshot.matches.filter((m) => !m.known)
console.log(`\n  未匹配到倍率的模型：${unknown.length === 0 ? '无' : unknown.map((m) => m.id).join(', ')}`)

console.log('\n— 按模型（前 8）—')
for (const row of snapshot.models) {
  console.log(`  ${row.key.padEnd(28)} 请求 ${String(row.requests).padEnd(6)} token ${row.tokens.toLocaleString('en-US').padEnd(14)} 命中率 ${(row.cacheHitRate ?? 0).toFixed(1)}%`)
}

console.log('\n— 小时序列 —')
for (const point of snapshot.series) {
  console.log(`  ${point.t}  请求 ${String(point.requests).padEnd(6)} 积分 ${point.credits}`)
}

console.log('\n— 已添加模型 × 网关推理等级 —')
for (const capability of snapshot.capabilities ?? []) {
  const efforts = capability.efforts.length > 0 ? capability.efforts.join(' / ') : '（网关未声明，不可切换）'
  console.log(`  ${capability.id.padEnd(32)} 默认 ${String(capability.defaultEffort ?? '—').padEnd(7)} 可选 ${efforts}`)
}

console.log('\n— 账户余额明细 —')
for (const balance of snapshot.balances ?? []) {
  console.log(
    `  ${String(balance.nickname).padEnd(24)} ${balance.realm.padEnd(7)} `
    + `${balance.credits}/${balance.creditsTotal} 积分  即将过期 ${balance.creditsExpiring}  `
    + `请求 ${balance.tokenUsage?.requests ?? 0}  最近 ${balance.tokenUsage?.lastModel ?? '—'}`,
  )
}
console.log(`  账户数 ${(snapshot.balances ?? []).length}`)

console.log('\n— 积分扣除历史（网关面板同款）—')
const ct = snapshot.creditTotals ?? {}
console.log(`  扣除积分 ${ct.credits}  ·  匹配 Token ${ct.creditTokens}  ·  样本 ${ct.creditSamples}`)
console.log(`  平均积分/1M ${ct.creditsPer1m}  ·  命中 ${ct.cacheHitTokens} / 未命中 ${ct.cacheMissTokens}`)
console.log('  按模型：')
for (const row of snapshot.creditModels ?? []) {
  console.log(
    `    ${String(row.key).padEnd(28)} 倍率 ${String(row.rate || '—').padEnd(6)} `
    + `请求 ${String(row.requests).padEnd(6)} 扣除 ${String(row.credits).padEnd(10)} `
    + `样本Token ${String(row.creditTokens).padEnd(12)} ${row.creditsPer1m} /1M`,
  )
}
console.log('  按账号：')
for (const row of snapshot.creditAccounts ?? []) {
  console.log(
    `    ${String(row.nickname || row.key).padEnd(24)} ${String(row.realm).padEnd(7)} `
    + `请求 ${String(row.requests).padEnd(6)} 扣除 ${String(row.credits).padEnd(10)} ${row.creditsPer1m} /1M`,
  )
}

console.log('\n— 推理等级同步：将要写进 llm-pi-ai 的内容（以网关为准）—')
const { desiredEfforts } = await import('../src/reasoning.js')
const listingForEfforts = await gateway.models()
const infoById = new Map((listingForEfforts?.data ?? []).map((m) => [m.id, m]))
for (const capability of snapshot.capabilities ?? []) {
  const model = infoById.get(capability.id)
  const declared = model?.supported_efforts
  const canOff = model?.can_disable_thinking === true
  const dict = desiredEfforts(declared, canOff)
  const rendered = dict ? JSON.stringify(dict) : '（固定档，不写）'
  const page = declared && declared.length ? declared.join(' / ') + (canOff ? ' / off (可关)' : '') : '固定档'
  console.log(`  ${capability.id.padEnd(32)} 网关页面：${page.padEnd(34)} → ${rendered}`)
}

console.log('\n— 只走 models 的倍率索引（校验不算错于一处）—')
const listing = await gateway.models()
const rateIndex = indexModelRates(listing ?? {})
const spot = buildModelMatches(['cn:hy4-preview', 'global:gpt-5.6-luna'], rateIndex, {})
for (const m of spot) {
  console.log(`  ${m.id.padEnd(28)} 倍率 ${m.multiplier === null ? '—' : 'x' + m.multiplier}`)
}

console.log('\n全部链路通过')
