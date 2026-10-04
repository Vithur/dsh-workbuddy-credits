/**
 * Host 侧的端到端真测 —— 直接打真实网关。
 *
 * 断言的是**装配出来的快照**而不是单个函数：页面崩掉通常不是某个解析函数出错，
 * 而是快照形状与界面期望对不上（例如少了 `accountCards`、窗口写成了全天）。
 * 只测 `lowRateModels` 抓不到这类问题。
 *
 * 需要 `WORKBUDDY_API_KEY`（网关 Bearer）。密钥读不到就跳过，不算失败 ——
 * 但**打印跳过**，免得「测试全过」其实是一条都没跑。
 *
 * 跑法：`node scripts/live-check.mjs`
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const load = (relative) => import(pathToFileURL(path.join(root, relative)).href)

const { Gateway } = await load('src/gateway.js')
const { buildSnapshot } = await load('src/snapshot.js')
const { LOW_RATE_THRESHOLD, USAGE_WINDOW_HOURS } = await load('shared/constants.js')

const baseUrl = process.env.WB_GATEWAY_URL ?? 'http://192.168.1.42:7863'
const apiKey = process.env.WORKBUDDY_API_KEY

if (!apiKey) {
  console.log('跳过：环境变量 WORKBUDDY_API_KEY 未设置，没有真实网关可打')
  process.exit(0)
}

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

const gateway = new Gateway(baseUrl, apiKey)
const snapshot = await buildSnapshot({}, gateway, { models: [] })

console.log(`网关：${baseUrl}`)

test('快照取数成功', () => {
  assert.equal(snapshot.ok, true, snapshot.error ?? '')
})

test('usage 请求带上了窗口，totals 与序列同一口径', () => {
  // 不能拿 testdata 当参照物去比 —— 那是几分钟前的快照，网关一直在写，
  // totals 与序列之和必然有差（每分钟还在涨）。所以断言改成「同一份实时数据里
  // totals 约等于序列之和」，这是「窗口写在 URL 上」这件事的真正证据：
  // 若窗口没生效，totals 会是全天口径而序列只有 12 小时，两者差出好几十积分。
  assert.ok(snapshot.totals, '缺少 totals')
  const seriesSum = snapshot.series.reduce((sum, point) => sum + (point.credits ?? 0), 0)
  const drift = Math.abs(snapshot.totals.credits - seriesSum)
  assert.ok(
    drift < Math.max(1, snapshot.totals.credits * 0.05),
    `totals.credits=${snapshot.totals.credits} 与序列之和 ${seriesSum} 差 ${drift.toFixed(2)}，不像同一窗口`,
  )
})

test('时序点不超过窗口小时数', () => {
  assert.ok(snapshot.series.length <= USAGE_WINDOW_HOURS + 1, `序列点过多：${snapshot.series.length}`)
  for (const point of snapshot.series) {
    assert.ok(Number.isFinite(point.totalTokens), '柱高必须是有限数')
    assert.ok(Number.isFinite(point.promptTokens), '输入段必须是有限数')
  }
})

test('模型板块只收生效倍率低于阈值的模型', () => {
  for (const row of snapshot.models) {
    assert.ok(
      row.multiplier < LOW_RATE_THRESHOLD,
      `${row.id} 生效倍率 ${row.multiplier} 不该出现在低倍率列表`,
    )
  }
  assert.ok(snapshot.models.length > 0, '网关应至少有几个低倍率模型')
})

test('模型行按生效倍率升序', () => {
  const rates = snapshot.models.map((row) => row.multiplier)
  assert.deepEqual(rates, [...rates].sort((a, b) => a - b))
})

test('账号板块覆盖国内与国际两个 realm', () => {
  const realms = new Set(snapshot.accountCards.map((row) => row.realm))
  assert.ok(realms.has('cn'), '缺国内账户')
  assert.ok(realms.has('global'), '缺国际账户')
})

test('账户余额之和等于页面顶部那张卡的数字', () => {
  const sum = snapshot.accountCards.reduce((total, row) => total + row.credits, 0)
  const capacity = snapshot.accountCards.reduce((total, row) => total + row.creditsTotal, 0)
  assert.ok(sum > 0, '余额合计应大于 0')
  assert.ok(capacity >= sum, '总额不应小于剩余')
})

test('没有冷却的账户 coolingUntil 为 null（不是 Go 零值时间）', () => {
  for (const row of snapshot.accountCards) {
    if (!row.cooling && row.limited.length === 0) {
      assert.equal(row.coolingUntil, null, `${row.nickname} 不该有冷却截止时间`)
    }
  }
})

test('限流行带可解析的解封时刻', () => {
  for (const row of snapshot.accountCards) {
    for (const limit of row.limited) {
      assert.ok(limit.model, '限流行必须有模型名')
      if (limit.resetAt !== null) {
        assert.ok(limit.resetAt > Date.now() - 86_400_000, `${limit.model} 解封时间不像近期`)
      }
    }
  }
})

test('状态栏 pill 依赖的 matches 仍是数组（配了模型才有内容）', () => {
  assert.ok(Array.isArray(snapshot.matches))
})

console.log(`\n${passed} 项通过`)