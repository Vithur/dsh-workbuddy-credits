/**
 * 解析器的独立真测 —— 直接用网关的真实返回片段跑，不是 mock 的假数据。
 *
 * 覆盖三件容易错的事：倍率字符串的三种形态、realm 前缀剥离、以及
 * 已添加模型与用量维度的正确配对。
 *
 * 跑法：`node shared/test-parse.mjs`
 */

import assert from 'node:assert/strict'
import { buildModelMatches, buildSeries, bareModelId, collectUsageRates, creditTotals, indexModelRates, parseMultiplier, toCreditRow, toUsageRow, topRows } from './parse.js'

let passed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (error) {
    console.error(`  FAIL ${name}\n       ${error.message}`)
    process.exitCode = 1
  }
}

console.log('parseMultiplier —— 三种上游形态')

test('x0.79 前缀形态', () => {
  assert.equal(parseMultiplier('x0.79'), 0.79)
})
test('0.71 credits 后缀形态', () => {
  assert.equal(parseMultiplier('0.71 credits'), 0.71)
})
test('裸数字形态', () => {
  assert.equal(parseMultiplier('1.62'), 1.62)
})
test('免费模型 x0.00 = 0，不是未知', () => {
  assert.equal(parseMultiplier('x0.00'), 0)
})
test('空字符串返回 null', () => {
  assert.equal(parseMultiplier(''), null)
})
test('undefined / null 返回 null', () => {
  assert.equal(parseMultiplier(undefined), null)
  assert.equal(parseMultiplier(null), null)
})
test('纯数字入参直接透传', () => {
  assert.equal(parseMultiplier(0.06), 0.06)
})

console.log('bareModelId —— realm 前缀剥离')

test('带 cn: 前缀', () => {
  assert.equal(bareModelId('cn:hy4-preview'), 'hy4-preview')
})
test('带 global: 前缀', () => {
  assert.equal(bareModelId('global:deepseek-v4.1-flash'), 'deepseek-v4.1-flash')
})
test('无前缀原样返回', () => {
  assert.equal(bareModelId('hy4-preview'), 'hy4-preview')
})
test('多个冒号只切第一个', () => {
  assert.equal(bareModelId('a:b:c'), 'b:c')
})
test('非字符串返回空串', () => {
  assert.equal(bareModelId(null), '')
})

// —— 以下是网关 /v1/models 与 /panel/api/usage 的真实结构缩影（字段精简过） ——

const REAL_LISTING = {
  data: [
    { id: 'cn:hy4-preview', credits: 'x0.29' },
    { id: 'cn:hy3', credits: 'x0.00' },
    { id: 'cn:glm-5v-turbo', credits: '0.71 credits' },
    { id: 'global:gpt-6-astra', credits: 'x6.67' },
    { id: 'cn:hy4-preview-f', credits: '' },
    { id: 'global:deepseek-v4.1-flash', credits: 'x0.00' },
  ],
}

const REAL_USAGE = {
  by_model: [
    { key: 'hy4-preview', requests: 130, total_tokens: 8299057, credits: 0 },
    { key: 'deepseek-v4.1-flash', requests: 398, total_tokens: 69601744, credits: 0 },
    { key: 'glm-5.3-flash', requests: 44, total_tokens: 1308602, credits: 5.61 },
  ],
  credit_by_model: [
    { key: 'glm-5.3-flash', rate: '0.06', requests: 44, credits: 5.61 },
    { key: 'deepseek-v4.1-flash', rate: '0', requests: 398, credits: 0 },
    { key: 'hy4-preview', rate: '0', requests: 130, credits: 0 },
  ],
  series: [
    { t: '2026-10-02T05', requests: 147, total_tokens: 19912346, credits: 0.01 },
    { t: '2026-10-02T06', requests: 297, total_tokens: 50025131, credits: 4.82 },
  ],
}

console.log('indexModelRates / collectUsageRates')

test('完整倍率索引按裸颇建键', () => {
  const index = indexModelRates(REAL_LISTING)
  assert.equal(index.get('hy4-preview').multiplier, 0.29)
  assert.equal(index.get('gpt-6-astra').multiplier, 6.67)
})
test('空 credits 记为 multiplier=null', () => {
  const index = indexModelRates(REAL_LISTING)
  assert.equal(index.get('hy4-preview-f').multiplier, null)
})
test('用量倍率表取到 rate 数值', () => {
  const rates = collectUsageRates(REAL_USAGE)
  assert.equal(rates.get('glm-5.3-flash'), 0.06)
})

console.log('buildModelMatches —— 已添加模型与倍率、用量配对')

test('DSH 配置的带前缀 id 能配上用量维度', () => {
  const matches = buildModelMatches(['cn:hy4-preview'], indexModelRates(REAL_LISTING), REAL_USAGE)
  assert.equal(matches[0].id, 'cn:hy4-preview')
  assert.equal(matches[0].multiplier, 0.29)
  assert.equal(matches[0].known, true)
  assert.equal(matches[0].used, true)
  assert.equal(matches[0].requests, 130)
})
test('global 前缀同样能配上', () => {
  const matches = buildModelMatches(['global:deepseek-v4.1-flash'], indexModelRates(REAL_LISTING), REAL_USAGE)
  assert.equal(matches[0].multiplier, 0)
  assert.equal(matches[0].requests, 398)
})
test('未登记到倍率表的模型 known=false', () => {
  const matches = buildModelMatches(['cn:not-a-model'], indexModelRates(REAL_LISTING), REAL_USAGE)
  assert.equal(matches[0].known, false)
  assert.equal(matches[0].multiplier, null)
  assert.equal(matches[0].used, false)
})
test('按倍率降序排，最贵在前', () => {
  const matches = buildModelMatches(
    ['cn:hy4-preview', 'global:gpt-6-astra', 'cn:glm-5v-turbo'],
    indexModelRates(REAL_LISTING),
    REAL_USAGE,
  )
  assert.deepEqual(matches.map((m) => m.id), ['global:gpt-6-astra', 'cn:glm-5v-turbo', 'cn:hy4-preview'])
})
test('空倍率的模型不参与「未知」判定', () => {
  const matches = buildModelMatches(['cn:hy4-preview-f'], indexModelRates(REAL_LISTING), REAL_USAGE)
  assert.equal(matches[0].known, false, '空 credits 应视为未知倍率，而非 0')
})

console.log('buildSeries / topRows / toUsageRow')

test('小时序列保留 t 与 credits', () => {
  const series = buildSeries(REAL_USAGE)
  assert.equal(series.length, 2)
  assert.equal(series[1].t, '2026-10-02T06')
  assert.equal(series[1].credits, 4.82)
})
test('topRows 按请求数截取', () => {
  const rows = topRows(REAL_USAGE.by_model, 2, collectUsageRates(REAL_USAGE))
  assert.equal(rows.length, 2)
  assert.equal(rows[0].key, 'deepseek-v4.1-flash')
})
test('缺失字段回落 0，不产生 NaN', () => {
  const row = toUsageRow({ key: 'x' }, new Map())
  assert.equal(row.requests, 0)
  assert.equal(row.credits, 0)
  assert.ok(Number.isFinite(row.credits))
})
test('空 usage 不崩', () => {
  assert.deepEqual(buildSeries({}), [])
  assert.deepEqual(topRows(undefined, 5, new Map()), [])
  assert.deepEqual(buildModelMatches([], new Map(), {}), [])
})

console.log('toCreditRow / creditTotals —— 积分扣除历史的口径')

// 网关把「与积分同时观测到的 token」与全部 token 分开存，两者不能混用：
// 混了「积分 / 1M Token」这个折算值就会失真。
const CREDIT_ROW = {
  key: 'glm-5.3-flash',
  rate: '0.06',
  requests: 44,
  credits: 5.61,
  credit_tokens: 1308602,
  credit_samples: 44,
  credits_per_1m_tokens: 4.287,
  cache_hit_tokens: 1204096,
  cache_miss_tokens: 87716,
  total_tokens: 99999999,
}

test('倍率保留原始字符串（显示要带 x 前缀）', () => {
  assert.equal(toCreditRow(CREDIT_ROW).rate, '0.06')
})
test('有效样本 token 取自 credit_tokens 而非 total_tokens', () => {
  assert.equal(toCreditRow(CREDIT_ROW).creditTokens, 1308602)
})
test('样本数与折算值原样带出', () => {
  const row = toCreditRow(CREDIT_ROW)
  assert.equal(row.creditSamples, 44)
  assert.equal(row.creditsPer1m, 4.287)
})
test('缓存命中与未命中分别保留（要算健康色）', () => {
  const row = toCreditRow(CREDIT_ROW)
  assert.equal(row.cacheHitTokens, 1204096)
  assert.equal(row.cacheMissTokens, 87716)
})
test('缺字段回落 0，不产生 NaN', () => {
  const row = toCreditRow({ key: 'x' })
  assert.equal(row.creditTokens, 0)
  assert.equal(row.creditSamples, 0)
  assert.equal(row.cacheMissTokens, 0)
  assert.equal(row.rate, '')
})
test('空行不崩', () => {
  assert.equal(toCreditRow(undefined).key, '')
})
test('汇总卡取到五个值', () => {
  const totals = creditTotals(CREDIT_ROW)
  assert.equal(totals.credits, 5.61)
  assert.equal(totals.creditTokens, 1308602)
  assert.equal(totals.creditSamples, 44)
  assert.equal(totals.creditsPer1m, 4.287)
  assert.equal(totals.cacheHitTokens, 1204096)
})
test('空汇总不崩', () => {
  assert.equal(creditTotals(undefined).credits, 0)
})

console.log(`\n${passed} 项通过`)