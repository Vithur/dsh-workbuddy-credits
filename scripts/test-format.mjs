/**
 * 格式化函数的独立真测 —— 重点是「积分扣除历史」那组。
 *
 * 用户要求把网关面板那个板块的信息原样显示出来，所以这组函数必须与网关
 * 自己的 `fmtTok` / `fmtCredit` / `fmtCreditRatio` / `cacheRateText` 逐值一致。
 * 期望值直接抄自网关 `panel/app.js` 的实现，不是我们另定的规则。
 *
 * 跑法：`node scripts/test-format.mjs`
 */

import assert from 'node:assert/strict'
import * as fmt from '../client/format.js'

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

console.log('trimFixed / gatewayCredit —— 对齐网关 fmtCredit')

test('去掉末尾多余的零', () => {
  assert.equal(fmt.trimFixed('716.80'), '716.8')
})
test('整数不带小数点', () => {
  assert.equal(fmt.trimFixed('716.00'), '716')
})
test('非整数原样保留', () => {
  assert.equal(fmt.trimFixed('0.0625'), '0.0625')
})
test('积分保留两位再修尾零', () => {
  assert.equal(fmt.gatewayCredit(716.8312), '716.83')
  assert.equal(fmt.gatewayCredit(5.6), '5.6')
  assert.equal(fmt.gatewayCredit(0), '0')
})
test('NaN 按 0 处理（与网关的 `n || 0` 一致）', () => {
  assert.equal(fmt.gatewayCredit(Number.NaN), '0')
})
test('无穷大走占位符', () => {
  assert.equal(fmt.gatewayCredit(Number.POSITIVE_INFINITY), '—')
})

console.log('gatewayTokens —— 对齐网关 fmtTok')

test('十亿级用 B', () => {
  assert.equal(fmt.gatewayTokens(1_500_000_000), '1.50B')
})
test('百万级用 M，两位小数', () => {
  assert.equal(fmt.gatewayTokens(141_880_000), '141.88M')
  assert.equal(fmt.gatewayTokens(1_308_602), '1.31M')
})
test('千级用 k，一位小数', () => {
  assert.equal(fmt.gatewayTokens(12_345), '12.3k')
})
test('小于千原样输出', () => {
  assert.equal(fmt.gatewayTokens(881), '881')
  assert.equal(fmt.gatewayTokens(0), '0')
})

console.log('gatewayRate —— 对齐网关 fmtModelRate')

test('倍率带 x 前缀', () => {
  assert.equal(fmt.gatewayRate('0.06'), 'x0.06')
  assert.equal(fmt.gatewayRate('0'), 'x0')
})
test('空值走占位符', () => {
  assert.equal(fmt.gatewayRate(''), '—')
  assert.equal(fmt.gatewayRate(undefined), '—')
})

console.log('gatewayCreditRatio —— 对齐网关 fmtCreditRatio')

test('有样本时四位小数 + / 1M', () => {
  assert.equal(fmt.gatewayCreditRatio(5.0522, 881, 141_880_000), '5.0522 / 1M')
})
test('无样本时走占位符，不拿总 token 凑数', () => {
  assert.equal(fmt.gatewayCreditRatio(1.3, 0, 1000), '—')
  assert.equal(fmt.gatewayCreditRatio(1.3, 10, 0), '—')
})
test('尾零被修掉', () => {
  assert.equal(fmt.gatewayCreditRatio(4.287, 44, 1308602), '4.287 / 1M')
})

console.log('cacheRate / cacheColor —— 对齐网关 cacheRateText')

test('命中率按 (命中+未命中) 计算', () => {
  assert.equal(fmt.cacheRate(1204096, 87716), '93.2%')
  assert.equal(fmt.cacheRate(95, 5), '95%')
})
test('无样本走占位符', () => {
  assert.equal(fmt.cacheRate(0, 0), '—')
  assert.equal(fmt.cacheRate(undefined, undefined), '—')
})
test('健康色阈值：90 绿 / 80 黄 / 低于 80 红', () => {
  assert.equal(fmt.cacheColor(95, 5), 'var(--success, #30a46c)')
  assert.equal(fmt.cacheColor(85, 15), 'var(--warning, #f2b94b)')
  assert.equal(fmt.cacheColor(50, 50), 'var(--danger, #e5484d)')
})
test('无样本用中性色', () => {
  assert.equal(fmt.cacheColor(0, 0), 'var(--dsw-alias-label-tertiary, rgba(128,128,128,.8))')
})

console.log('既有格式化未被破坏')

test('credits 千分位', () => {
  assert.equal(fmt.credits(2983), '2983.00')
  assert.equal(fmt.credits(0), '0')
  assert.equal(fmt.credits(5.61), '5.61')
})
test('tokens 分组', () => {
  assert.equal(fmt.tokens(1234567), '1,234,567')
})
test('compact 缩写', () => {
  assert.equal(fmt.compact(128_500_000), '128.5M')
  assert.equal(fmt.compact(12_345), '12.3k')
})
test('percent 一位小数', () => {
  assert.equal(fmt.percent(95.227, 1), '95.2%')
})
test('multiplier 免费特例', () => {
  assert.equal(fmt.multiplier(0), '免费')
  assert.equal(fmt.multiplier(0.06), 'x0.06')
  assert.equal(fmt.multiplier(null), '—')
})
test('hourLabel 只取小时', () => {
  assert.equal(fmt.hourLabel('2026-10-02T06'), '06 时')
  assert.equal(fmt.hourLabel('bad'), 'bad')
})
test('balancePercent 夹在 0 到 100', () => {
  assert.equal(fmt.balancePercent({ credits: 2983, creditsTotal: 4726 }), (2983 / 4726) * 100)
  assert.equal(fmt.balancePercent({ credits: 10, creditsTotal: 0 }), 0)
  assert.equal(fmt.balancePercent({ credits: 999, creditsTotal: 100 }), 100)
})

console.log(`\n${passed} 项通过`)
