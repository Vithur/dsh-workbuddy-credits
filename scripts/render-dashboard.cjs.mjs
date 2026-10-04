/**
 * 设置页渲染真测的**断言部分**。
 *
 * 由 `render-dashboard.mjs` 编译成单文件 ESM 后执行 —— 见那个文件的说明：
 * Node 原生不认 `.jsx`，而 React 必须与宿主同源，所以分成两层：
 * 这个文件只写「断言什么」，「怎么加载」交给 runner。
 *
 * 跑法：不要直接跑，用 `node scripts/render-dashboard.mjs`。
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CreditsDashboard } from '../client/CreditsDashboard.jsx'
import { DICT_ZH } from '../client/locale.js'
import * as fmt from '../client/format.js'
import { accountCards, lowRateModels, creditTotals } from '../shared/parse.js'

/**
 * 上面全部是**静态相对 import**，不能用 `await import(pathToFileURL(...))`。
 * 后者的 URL 是运行期算出来的，esbuild 无法静态解析，会原样留到运行时 ——
 * 于是又撞回 Node 不认 `.jsx` 的老问题（`ERR_UNKNOWN_FILE_EXTENSION`）。
 * 相对路径既能被打进单文件产物，又让 `react` 从插件自己的 node_modules 解析。
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

/** t() 的最小实现：未知键直接抛错，好让测试抓到漏翻的文案。 */
const t = (key) => {
  const value = DICT_ZH[key]
  if (value === undefined) throw new Error(`字典缺键：${key}`)
  return value
}

const usage = JSON.parse(await readFile(path.join(root, 'testdata/usage.json'), 'utf8'))
const listing = JSON.parse(await readFile(path.join(root, 'testdata/models.json'), 'utf8'))
const overview = JSON.parse(await readFile(path.join(root, 'testdata/overview.json'), 'utf8'))

const snapshot = {
  ok: true,
  error: null,
  totals: usage.totals,
  creditTotals: creditTotals(usage.totals),
  accounts: overview.accounts,
  accountCards: accountCards(overview.accounts),
  models: lowRateModels(listing, usage, 0.2),
  series: [],
  matches: [],
}

console.log(`快照：${snapshot.models.length} 个低倍率模型 / ${snapshot.accountCards.length} 个账户`)

const render = (source) =>
  renderToStaticMarkup(
    React.createElement(CreditsDashboard, { t, fmt, useSnapshot: () => source, pollMs: 30_000 }),
  )

const html = render({ snapshot, error: null, loading: false, refresh: () => {} })

console.log('概览三栏')

test('三个数字都渲染', () => {
  assert.ok(html.includes('积分'), '缺分组标题')
  assert.ok(html.includes('剩余 / 总额'))
  assert.ok(html.includes('积分 / 1M Token'))
  assert.ok(html.includes('缓存命中率'))
})
test('余额显示剩余与总额', () => {
  // 概览卡用千分位（fmt.tokens），不是 gatewayCredit —— 大额数字加千分位
  // 才读得动，这与账号卡上的小数字不同，两处格式化本来就该不一样。
  const sum = snapshot.accountCards.reduce((total, row) => total + row.credits, 0)
  const cap = snapshot.accountCards.reduce((total, row) => total + row.creditsTotal, 0)
  assert.ok(html.includes(fmt.tokens(sum)), `缺剩余积分 ${fmt.tokens(sum)}`)
  assert.ok(html.includes(`/${fmt.tokens(cap)}`), `缺总额 ${fmt.tokens(cap)}`)
})
test('关键数字用 22px', () => {
  assert.ok(html.includes('font-size:22px'), '概览数字字号不是 22px')
})
test('有刷新按钮且带loading 态标记', () => {
  assert.ok(html.includes(t('refresh')), '缺刷新文案')
  assert.ok(html.includes('aria-busy'), '刷新按钮缺 loading 态标记')
})

console.log('卡片网格')

test('模型与账号都是显式两列', () => {
  // React 会把 style 对象序列化成 `key:value;`，所以匹配时不能带空格。
  // 两处（模型 / 账号）共用同一个 `cards` 常量对象，esbuild 只序列化一次，
  // 所以 DOM 里只能数到 1 处 —— 查的是「用了显式两列」，不是数出现次数。
  assert.ok(
    html.includes('grid-template-columns:repeat(2, minmax(0, 1fr))'),
    '卡片网格未用显式两列',
  )
  assert.ok(!html.includes('auto-fill'), '不能用 auto-fill：容器稍窄就塌成一列')
})
test('圆角走原生 token', () => {
  assert.ok(html.includes('var(--dsw-radius-xl, 20px)'), '卡片圆角未走原生 token')
})
test('描边是 0.5px hairline', () => {
  assert.ok(html.includes('0.5px solid var(--dsw-alias-settings-card-stroke'), '卡片描边未走原生 token')
})
test('展开态不换边框色变量', () => {
  // 踩过的坑：展开时把 borderColor 换成低一档的 border-l3，浏览器把这条
  // border-color 当成未指定，回退到最亮默认色 —— 实测描边从 86 飙到 250（纯白），
  // 整排卡片像被点亮。所以卡片 <li> 的 style 必须与常态逐字相同。
  const lis = [...html.matchAll(/<li style="([^"]*)"/g)].map((m) => m[1])
  assert.ok(lis.length > 0, '没找到卡片')
  const unique = [...new Set(lis)]
  assert.equal(unique.length, 1, `所有卡片的 <li> style 应完全一致，实际 ${unique.length} 种`)
  // `transition:border-color` 是属性名不是值，这里查的是「有没有 borderColor 覆盖」。
  assert.ok(!lis.some((style) => /(^|;)\s*border-color\s*:/.test(style)), '卡片 style 里不该出现 border-color 覆盖')
})

console.log('模型卡')

test('每个低倍率模型都有一张卡', () => {
  for (const row of snapshot.models) {
    assert.ok(html.includes(row.id), `缺模型卡：${row.id}`)
  }
})
test('高倍率模型不出现', () => {
  for (const id of ['global:gpt-6-astra', 'cn:glm-5v-turbo', 'global:kimi-k3']) {
    assert.ok(!html.includes(id), `不该出现高倍率模型：${id}`)
  }
})
test('收起态显示能力位', () => {
  assert.ok(
    html.includes(t('capTool')) || html.includes(t('capVision')) || html.includes(t('capThinking')),
    '能力位一个都没渲染',
  )
})
test('收起态写全「扣除积分 N」', () => {
  // 光写「32.92 积分」有歧义：是剩余、是倍率、还是本次消耗？
  assert.ok(html.includes(`${t('creditsDeducted')} `), '缺「扣除积分」前缀')
})
test('展开区默认隐藏', () => {
  assert.ok(html.includes('display:none'), '展开区必须默认 display:none，否则折叠箭头是纯装饰')
  assert.ok(html.includes('aria-expanded="false"'), '缺 aria-expanded=false')
})
test('展开区不重复积分', () => {
  // 积分已在收起态的 chip 里出现；同一张卡上出现两次就是信息重复。
  //
  // 直接按展开区容器的 id 抓：`aria-controls` 指向它，而该id 在按钮与
  // 容器上各出现一次，所以按 `id="X"` 定位容器、取到 `</dl>` 为止，
  // 拿到的就只是展开区本体，不会串到下一张卡。
  const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1])
  assert.ok(ids.length > 0, '没找到展开区')
  for (const id of ids) {
    const start = html.indexOf(`<div id="${id}"`)
    assert.ok(start > 0, `找不到展开区容器 ${id}`)
    const detail = html.slice(start, html.indexOf('</dl>', start))
    assert.ok(!detail.includes(t('creditsDeducted')), `展开区 ${id} 不该再显示积分`)
  }
})

console.log('账号卡')

test('每个账号都有一张卡', () => {
  for (const account of snapshot.accountCards) {
    assert.ok(html.includes(account.nickname.replace(/@.*$/, '')), `缺账号卡：${account.nickname}`)
  }
})
test('账号名去掉邮箱后缀', () => {
  const emails = snapshot.accountCards.filter((a) => a.nickname.includes('@'))
  if (emails.length === 0) return
  // 只查可见文本，不查 title —— title 里放完整账号名是正确的（悬浮要看全名）。
  const visible = html.replace(/title="[^"]*"/g, '')
  assert.ok(!visible.includes('@'), '可见文本里不该带邮箱后缀')
  for (const account of emails) {
    const short = account.nickname.replace(/@.*$/, '')
    assert.ok(visible.includes(short), `缺短名 ${short}`)
  }
})
test('国内与国际同款无色样式', () => {
  const tones = [...html.matchAll(/data-tone="([^"]+)"/g)].map((m) => m[1])
  assert.ok(!tones.includes('filled'), '不该再有实心底的国内标签')
  const outlines = tones.filter((tone) => tone === 'outline').length
  assert.ok(outlines >= 2, `国内与国际都该用 outline，实际 ${outlines} 个`)
})
test('限流账号显示模型名与解封时刻', () => {
  const limited = snapshot.accountCards.flatMap((a) => a.limited)
  if (limited.length === 0) return
  assert.ok(html.includes(limited[0].model), '应显示被限流的模型名')
  assert.ok(html.includes(t('rateLimited')), '应显示限流标签')
  assert.ok(html.includes(t('unlockAt')), '应显示解封时刻')
})
test('可用账号显示「可用」', () => {
  const usable = snapshot.accountCards.filter((a) => a.limited.length === 0)
  if (usable.length > 0) assert.ok(html.includes(t('available')))
})

console.log('颜色克制')

test('没有 success / info 状态色', () => {
  // 「免费」「国内」这类普通事实不用彩色 —— 用颜色暗示它们更重要是错的。
  assert.ok(!html.includes('state-success-primary'), '不该出现 success 状态色')
  assert.ok(!html.includes('state-info'), '不该出现 info 状态色')
})
test('倍率 Tag 用中性档，不因免费而变绿', () => {
  const tones = [...html.matchAll(/data-tone="([^"]+)"/g)].map((m) => m[1])
  const neutral = tones.filter((tone) => tone === 'neutral').length
  assert.ok(neutral >= snapshot.models.length, `倍率 Tag 应全用 neutral，实际 ${neutral} 个`)
})
test('警示色只出现在限流标签上', () => {
  const warn = (html.match(/state-warn-primary/g) ?? []).length
  // 定义处两处（state.warn 常量 + tagWarning），所以基线就是 2。
  assert.ok(warn <= 2, `warn 色不该额外出现在别处，实际 ${warn} 处`)
  const warnTags = [...html.matchAll(/data-tone="warning"/g)].length
  const limitedAccounts = snapshot.accountCards.filter((a) => a.limited.length > 0).length
  assert.ok(warnTags <= limitedAccounts, 'warn 标签数不该超过限流账号数')
})

console.log('容错')

test('网关不可达时给出可读错误与重试', () => {
  const out = render({ snapshot: { ok: false, error: '网关不可达或 API Key 无效' }, error: null, loading: false, refresh: () => {} })
  assert.ok(out.includes('网关不可达'))
  assert.ok(out.includes('重试'))
})
test('空数据不渲染空壳卡片', () => {
  const out = render({ snapshot: { ok: true, accountCards: [], models: [] }, error: null, loading: false, refresh: () => {} })
  assert.ok(out.includes('暂无数据'))
})
test('没有模型时给出空态文案', () => {
  const out = render({ snapshot: { ok: true, accountCards: snapshot.accountCards, models: [] }, error: null, loading: false, refresh: () => {} })
  assert.ok(out.includes(t('noLowRateModel')))
})
test('没有账号时给出空态文案', () => {
  const out = render({ snapshot: { ok: true, accountCards: [], models: snapshot.models }, error: null, loading: false, refresh: () => {} })
  assert.ok(out.includes(t('noAccounts')))
})
test('限流行没有解封时刻时不编造时间', () => {
  const out = render({
    snapshot: {
      ok: true,
      creditTotals: snapshot.creditTotals,
      models: snapshot.models,
      accountCards: [{ uid: 'x', nickname: '测试', realm: 'cn', credits: 1, creditsTotal: 2, limited: [{ model: 'hy3', kind: 'rate_limit', until: null, resetAt: null }] }],
    },
    error: null,
    loading: false,
    refresh: () => {},
  })
  assert.ok(out.includes('hy3'))
  assert.ok(!out.includes(`${t('unlockAt')} 00:00`), '解封时间未知时不能显示零值时刻')
})

console.log(`\n${passed} 项通过`)