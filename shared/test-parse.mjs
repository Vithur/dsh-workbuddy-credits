/**
 * 解析器的独立真测 —— 直接用网关的真实返回片段跑，不是 mock 的假数据。
 *
 * 覆盖五件容易错的事：倍率字符串的三种形态、realm 前缀剥离、
 * 已添加模型与用量维度的正确配对、**生效价优先于牌价**的筛选口径、
 * 以及 Go 零值时间戳。
 *
 * 跑法：`node shared/test-parse.mjs`
 */

import assert from 'node:assert/strict'
import {
  accountCards,
  buildModelMatches,
  buildSeries,
  bareModelId,
  collectUsageRates,
  creditTotals,
  gatewayTime,
  indexCreditRows,
  indexModelRates,
  lowRateModels,
  parseMultiplier,
  pickCreditRows,
} from './parse.js'

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

// —— 以下是网关 /panel/api/models 与 /panel/api/usage 的真实结构缩影（字段精简过） ——

const REAL_LISTING = {
  models: [
    // 牌价 0.29，夜间免费 —— 必须按生效价 0 收进低倍率列表。
    { id: 'cn:hy4-preview', name: 'Hy4 preview', credits: 'x0.29', promo_credits: '0x', promo_factor: 0, promo_label: '夜间免费' },
    // 牌价 0.79，五折 —— 生效价 0.395，仍高于阈值，不收。
    { id: 'cn:glm-5.2', name: 'GLM-5.2', credits: 'x0.79', promo_credits: '0.50x', promo_factor: 0.5, promo_label: '夜间折扣' },
    { id: 'cn:hy3', name: 'Hy3', credits: 'x0.00' },
    { id: 'cn:glm-5v-turbo', name: 'GLM-5v-Turbo', credits: '0.71 credits' },
    { id: 'global:gpt-6-astra', name: 'GPT-6-Astra', credits: 'x6.67' },
    // 无价格：不能当成 0 倍率收进来。
    { id: 'cn:hy4-preview-f', name: 'Hy4 preview', credits: '' },
    // 同一裸模型两条路由：国内 0.11、国际 0.00 —— 倍率索引不能互相覆盖。
    { id: 'cn:deepseek-v4.1-flash', name: 'Deepseek-V4.1-Flash', credits: 'x0.11' },
    { id: 'global:deepseek-v4.1-flash', name: 'Deepseek-V4.1-Flash', credits: 'x0.00' },
    { id: 'cn:space-bunny', name: 'Space-Bunny', credits: 'x0.03', promo_label: '限时折扣' },
  ],
}

/** `indexModelRates` 吃的是 `/v1/models` 的 `{ data: [...] }` 形状，与面板的 `{ models: [...] }` 不同。 */
const REAL_V1_LISTING = { data: REAL_LISTING.models }

const REAL_USAGE = {
  by_model: [
    { key: 'hy4-preview', requests: 1133, total_tokens: 167857927, credits: 8.99, cache_hit_tokens: 108013296, cache_miss_tokens: 59844631 },
    { key: 'deepseek-v4.1-flash', requests: 1950, total_tokens: 668535359, credits: 61.03, cache_hit_tokens: 656512512, cache_miss_tokens: 10426251 },
    { key: 'glm-5.3-flash', requests: 44, total_tokens: 1308602, credits: 5.61, cache_hit_tokens: 1204096, cache_miss_tokens: 87716 },
  ],
  credit_by_model: [
    { key: 'glm-5.3-flash', rate: '0.06', requests: 44, credits: 5.61, credit_tokens: 1308602, cache_hit_tokens: 1204096, cache_miss_tokens: 87716 },
    // 同一裸模型两条路由：国内 0.11 有消耗，国际 0 免费 —— 不能串。
    { key: 'deepseek-v4.1-flash', rate: '0.11', requests: 1552, credits: 61.03, credit_tokens: 423151921, cache_hit_tokens: 414660416, cache_miss_tokens: 7633535 },
    { key: 'deepseek-v4.1-flash', rate: '0', requests: 398, credits: 0, credit_tokens: 245392438, cache_hit_tokens: 242778880, cache_miss_tokens: 2176596 },
    { key: 'hy4-preview', rate: '0', requests: 130, credits: 0, credit_tokens: 167857927, cache_hit_tokens: 108013296, cache_miss_tokens: 59844631 },
  ],
  series: [
    { t: '2026-10-02T05', requests: 147, prompt_tokens: 19816871, completion_tokens: 95475, total_tokens: 19912346, credits: 0.01 },
    { t: '2026-10-02T06', requests: 297, prompt_tokens: 49800122, completion_tokens: 225009, total_tokens: 50025131, credits: 4.82 },
  ],
}

console.log('indexModelRates / collectUsageRates')

test('完整倍率索引按裸名建键', () => {
  const index = indexModelRates(REAL_V1_LISTING)
  assert.equal(index.get('hy4-preview').multiplier, 0.29)
  assert.equal(index.get('gpt-6-astra').multiplier, 6.67)
})
test('完整 id 精确建键，同名双路由互不覆盖', () => {
  const index = indexModelRates(REAL_V1_LISTING)
  assert.equal(index.get('cn:deepseek-v4.1-flash').multiplier, 0.11)
  assert.equal(index.get('global:deepseek-v4.1-flash').multiplier, 0)
  assert.equal(index.get('cn:hy3').multiplier, 0)
})
test('裸名键只在唯一时登记，双路由裸名丢弃', () => {
  const index = indexModelRates(REAL_V1_LISTING)
  assert.equal(index.get('deepseek-v4.1-flash'), undefined, '双路由裸名不能落到任何一边')
  assert.ok(index.get('hy4-preview'), '唯一裸名仍保留回退键')
})
test('空 credits 记为 multiplier=null', () => {
  const index = indexModelRates(REAL_V1_LISTING)
  assert.equal(index.get('cn:hy4-preview-f').multiplier, null)
})
test('用量倍率表取到 rate 数值', () => {
  const rates = collectUsageRates(REAL_USAGE)
  assert.equal(rates.get('glm-5.3-flash'), 0.06)
})
test('用量倍率表：同裸名多行倍率分歧时丢键，不串倍率', () => {
  const rates = collectUsageRates(REAL_USAGE)
  assert.equal(rates.get('deepseek-v4.1-flash'), undefined, '0.11 与 0 并存时不能取任何一边')
  assert.equal(rates.get('hy4-preview'), 0)
})

console.log('indexCreditRows / pickCreditRows —— 用量按倍率归因')

test('credit_by_model 按裸名归组，同模型多行都保留', () => {
  const index = indexCreditRows(REAL_USAGE)
  assert.equal(index.get('deepseek-v4.1-flash').length, 2)
  assert.equal(index.get('hy4-preview').length, 1)
})
test('pickCreditRows 按倍率挑行：国际免费只拿 rate=0 的行', () => {
  const index = indexCreditRows(REAL_USAGE)
  const rows = pickCreditRows(index.get('deepseek-v4.1-flash'), [0])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].rate, '0')
  assert.equal(rows[0].credits, 0)
})
test('pickCreditRows 候选顺序：生效价优先于牌价', () => {
  const index = indexCreditRows(REAL_USAGE)
  const rows = pickCreditRows(index.get('deepseek-v4.1-flash'), [null, 0.11])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].rate, '0.11')
})
test('倍率都对不上时合并全部行，不显示假 0', () => {
  const index = indexCreditRows(REAL_USAGE)
  const rows = pickCreditRows(index.get('deepseek-v4.1-flash'), [0.77])
  assert.equal(rows.length, 2)
})
test('缺行 / 空输入不崩', () => {
  assert.deepEqual(pickCreditRows(undefined, [0]), [])
  assert.deepEqual(pickCreditRows([], []), [])
})

console.log('lowRateModels —— 生效价优先于牌价')

test('按生效倍率筛选，牌价高的免费模型收进来', () => {
  const rows = lowRateModels(REAL_LISTING, REAL_USAGE, 0.2)
  assert.ok(rows.some((row) => row.id === 'cn:hy4-preview'))
  const row = rows.find((item) => item.id === 'cn:hy4-preview')
  assert.equal(row.multiplier, 0, '生效价应取 promo_credits 的 0，而不是牌价 0.29')
  assert.equal(row.listRate, 0.29)
  assert.equal(row.promoLabel, '夜间免费')
})
test('生效价仍高于阈值的模型被排除', () => {
  const rows = lowRateModels(REAL_LISTING, REAL_USAGE, 0.2)
  assert.ok(!rows.some((row) => row.id === 'cn:glm-5.2'), '五折后 0.395 仍超阈值')
})
test('无价格的模型不进列表（不能当 0 倍率）', () => {
  const rows = lowRateModels(REAL_LISTING, REAL_USAGE, 0.2)
  assert.ok(!rows.some((row) => row.id === 'cn:hy4-preview-f'))
})
test('按生效倍率升序排列', () => {
  const rows = lowRateModels(REAL_LISTING, REAL_USAGE, 0.2)
  const rates = rows.map((row) => row.multiplier)
  assert.deepEqual(rates, [...rates].sort((a, b) => a - b))
})
test('用量按倍率归因到带前缀的模型 id：国际免费不串国内消耗', () => {
  const rows = lowRateModels(REAL_LISTING, REAL_USAGE, 0.2)
  const row = rows.find((item) => item.id === 'global:deepseek-v4.1-flash')
  assert.equal(row.multiplier, 0)
  assert.equal(row.requests, 398, '国际免费模型只吃 rate=0 那一行的用量')
  assert.equal(row.credits, 0, '国际免费模型的消耗必须是 0')
  assert.equal(row.cacheHitTokens, 242778880)
})
test('国内路由的用量归到国内模型卡上', () => {
  const rows = lowRateModels(REAL_LISTING, REAL_USAGE, 0.2)
  const cn = rows.find((item) => item.id === 'cn:hy4-preview')
  assert.equal(cn.multiplier, 0, '促销价 0 优先')
  assert.equal(cn.requests, 130)
})
test('无用量记录的模型给 0 而不是崩', () => {
  const rows = lowRateModels(REAL_LISTING, REAL_USAGE, 0.2)
  const row = rows.find((item) => item.id === 'cn:space-bunny')
  assert.equal(row.requests, 0)
  assert.equal(row.credits, 0)
  assert.ok(Number.isFinite(row.credits))
})
test('空清单 / 空用量不崩', () => {
  assert.deepEqual(lowRateModels({}, {}, 0.2), [])
  assert.deepEqual(lowRateModels(undefined, undefined, 0.2), [])
})

console.log('lowRateModels —— 能力位')

/**
 * 卡片收起态第二行就是 `工具 · 视觉 · 思考常开`，完全依赖这三个字段。
 * 它们是**后加**的：漏掉时界面上不会报错，只是那一行静默塌成只剩促销标签，
 * 看起来像「数据错了」而不是「字段没传过来」，所以必须在这里钉死。
 */
const CAPABILITY_LISTING = {
  models: [
    { id: 'cn:all', credits: 'x0.01', supports_tool_call: true, supports_images: true, supports_reasoning: true, can_disable_thinking: false },
    { id: 'cn:can-disable', credits: 'x0.02', supports_tool_call: false, supports_images: false, supports_reasoning: true, can_disable_thinking: true },
    { id: 'cn:plain', credits: 'x0.03', supports_tool_call: false, supports_images: false, supports_reasoning: false },
  ],
}

test('能力位原样带出', () => {
  const row = lowRateModels(CAPABILITY_LISTING, {}, 0.2).find((item) => item.id === 'cn:all')
  assert.equal(row.supportsToolCall, true)
  assert.equal(row.supportsImages, true)
  assert.equal(row.supportsReasoning, true)
})
test('思考能关时不算「思考常开」', () => {
  const rows = lowRateModels(CAPABILITY_LISTING, {}, 0.2)
  assert.equal(rows.find((row) => row.id === 'cn:can-disable').supportsReasoning, false)
  assert.equal(rows.find((row) => row.id === 'cn:plain').supportsReasoning, false)
})
test('缺失的能力字段回落 false 而不是 undefined', () => {
  const row = lowRateModels({ models: [{ id: 'cn:bare', credits: 'x0.01' }] }, {}, 0.2)[0]
  assert.equal(row.supportsToolCall, false)
  assert.equal(row.supportsImages, false)
  assert.equal(row.supportsReasoning, false)
})

console.log('buildModelMatches —— 已添加模型与倍率、用量配对')

test('DSH 配置的带前缀 id 能配上用量维度', () => {
  const matches = buildModelMatches(['cn:hy4-preview'], indexModelRates(REAL_V1_LISTING), REAL_USAGE)
  assert.equal(matches[0].id, 'cn:hy4-preview')
  assert.equal(matches[0].multiplier, 0.29)
  assert.equal(matches[0].known, true)
  assert.equal(matches[0].used, true)
  assert.equal(matches[0].requests, 130, '牌价 0.29 对不上观测 rate=0，合并该模型全部行')
})
test('global 前缀同样能配上，且消耗归因到本路由', () => {
  const matches = buildModelMatches(['global:deepseek-v4.1-flash'], indexModelRates(REAL_V1_LISTING), REAL_USAGE)
  assert.equal(matches[0].multiplier, 0)
  assert.equal(matches[0].requests, 398, '国际免费模型只吃 rate=0 那一行的用量')
  assert.equal(matches[0].credits, 0)
  assert.equal(matches[0].tokens, 245392438)
})
test('未登记到倍率表的模型 known=false', () => {
  const matches = buildModelMatches(['cn:not-a-model'], indexModelRates(REAL_V1_LISTING), REAL_USAGE)
  assert.equal(matches[0].known, false)
  assert.equal(matches[0].multiplier, null)
  assert.equal(matches[0].used, false)
})
test('按倍率降序排，最贵在前', () => {
  const matches = buildModelMatches(
    ['cn:hy4-preview', 'global:gpt-6-astra', 'cn:glm-5v-turbo'],
    indexModelRates(REAL_V1_LISTING),
    REAL_USAGE,
  )
  assert.deepEqual(matches.map((m) => m.id), ['global:gpt-6-astra', 'cn:glm-5v-turbo', 'cn:hy4-preview'])
})
test('空倍率的模型不参与「未知」判定', () => {
  const matches = buildModelMatches(['cn:hy4-preview-f'], indexModelRates(REAL_V1_LISTING), REAL_USAGE)
  assert.equal(matches[0].known, false, '空 credits 应视为未知倍率，而非 0')
})

console.log('buildSeries —— Token 时序的分项')

test('保留 t、prompt / completion 分项与总 token', () => {
  const series = buildSeries(REAL_USAGE)
  assert.equal(series.length, 2)
  assert.equal(series[1].t, '2026-10-02T06')
  assert.equal(series[1].credits, 4.82)
  assert.equal(series[1].promptTokens, 49800122)
  assert.equal(series[1].completionTokens, 225009)
  assert.equal(series[1].totalTokens, 50025131)
})
test('缺 total_tokens 时按 prompt + completion 补齐', () => {
  const series = buildSeries({ series: [{ t: 'x', prompt_tokens: 10, completion_tokens: 5 }] })
  assert.equal(series[0].totalTokens, 15)
})
test('缺分项时不产生 NaN', () => {
  const series = buildSeries({ series: [{ t: 'x' }] })
  assert.equal(series[0].promptTokens, 0)
  assert.equal(series[0].completionTokens, 0)
  assert.equal(series[0].totalTokens, 0)
})
test('空 usage 不崩', () => {
  assert.deepEqual(buildSeries({}), [])
  assert.deepEqual(buildSeries(undefined), [])
  assert.deepEqual(buildModelMatches([], new Map(), {}), [])
})

console.log('gatewayTime —— Go 零值时间戳')

test('Go 零值 0001-01-01 必须判为「无时间」', () => {
  assert.equal(gatewayTime('0001-01-01T00:00:00Z'), null)
})
test('真实时间戳解析成毫秒', () => {
  assert.equal(gatewayTime('2026-10-03T08:00:00+08:00'), Date.parse('2026-10-03T08:00:00+08:00'))
})
test('空值 / 非字符串返回 null', () => {
  assert.equal(gatewayTime(''), null)
  assert.equal(gatewayTime(undefined), null)
  assert.equal(gatewayTime(0), null)
})

console.log('accountCards —— 状态与解封时间')

const REAL_ACCOUNTS = [
  {
    uid: 'a-1',
    nickname: 'Vithur',
    realm: 'cn',
    credits: 3269,
    credits_total: 4934,
    credits_expiring: 0,
    disabled: false,
    cooling: false,
    until: '0001-01-01T00:00:00Z',
    degrade_until: '0001-01-01T00:00:00Z',
    breaker_until: '0001-01-01T00:00:00Z',
    rate_limited_models: [
      {
        model: 'hy4-preview',
        kind: 'rate_limit',
        until: '2026-10-03T07:20:01+08:00',
        reset_at: '2026-10-03T08:00:00+08:00',
      },
    ],
  },
  {
    uid: 'b-2',
    nickname: 'vithur5312@gmail.com',
    realm: 'global',
    credits: 187,
    credits_total: 380,
    disabled: false,
    cooling: false,
    until: '0001-01-01T00:00:00Z',
    degrade_until: '0001-01-01T00:00:00Z',
    breaker_until: '0001-01-01T00:00:00Z',
  },
]

test('解封时间取上游 reset_at 而非网关 until', () => {
  const cards = accountCards(REAL_ACCOUNTS)
  const cn = cards.find((row) => row.uid === 'a-1')
  assert.equal(cn.limited.length, 1)
  assert.equal(cn.limited[0].resetAt, Date.parse('2026-10-03T08:00:00+08:00'))
  assert.equal(cn.limited[0].until, Date.parse('2026-10-03T07:20:01+08:00'))
})
test('零值时间不算冷却', () => {
  const cards = accountCards(REAL_ACCOUNTS)
  assert.equal(cards.find((row) => row.uid === 'a-1').coolingUntil, null)
})
test('未来的熔断时刻取为冷却截止', () => {
  const future = Date.now() + 3600_000
  const cards = accountCards([{ uid: 'c', realm: 'cn', breaker_until: new Date(future).toISOString() }])
  assert.equal(cards[0].coolingUntil, future)
})
test('国内排在国际之前', () => {
  const cards = accountCards(REAL_ACCOUNTS)
  assert.deepEqual(cards.map((row) => row.realm), ['cn', 'global'])
})
test('缺字段回落，不产生 NaN', () => {
  const cards = accountCards([{ uid: 'd' }])
  assert.equal(cards[0].credits, 0)
  assert.equal(cards[0].creditsTotal, 0)
  assert.equal(cards[0].nickname, '未命名账户')
  assert.deepEqual(cards[0].limited, [])
})
test('无模型名或无时间的限流行被剔除', () => {
  const cards = accountCards([{ uid: 'e', rate_limited_models: [{ model: '' }, { model: 'x', reset_at: '0001-01-01T00:00:00Z' }] }])
  assert.equal(cards[0].limited.length, 1)
  assert.equal(cards[0].limited[0].resetAt, null)
})
test('空输入不崩', () => {
  assert.deepEqual(accountCards(undefined), [])
  assert.deepEqual(accountCards(null), [])
})

console.log('creditTotals —— 折算口径')

// 网关把「与积分同时观测到的 token」与全部 token 分开存，两者不能混用：
// 混了「积分 / 1M Token」这个折算值就会失真。
const CREDIT_TOTALS = {
  credits: 5.61,
  credit_tokens: 1308602,
  credit_samples: 44,
  credits_per_1m_tokens: 4.287,
  cache_hit_tokens: 1204096,
  cache_miss_tokens: 87716,
  total_tokens: 99999999,
}

test('取 credit_tokens 而不是 total_tokens', () => {
  assert.equal(creditTotals(CREDIT_TOTALS).creditTokens, 1308602)
})
test('六个折算值原样带出', () => {
  const totals = creditTotals(CREDIT_TOTALS)
  assert.equal(totals.credits, 5.61)
  assert.equal(totals.creditSamples, 44)
  assert.equal(totals.creditsPer1m, 4.287)
  assert.equal(totals.cacheHitTokens, 1204096)
  assert.equal(totals.cacheMissTokens, 87716)
})
test('空汇总不崩', () => {
  assert.equal(creditTotals(undefined).credits, 0)
})

console.log(`\n${passed} 项通过`)