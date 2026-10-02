/**
 * UI 格式化 —— 数字与时间的展示规则集中在这里。
 *
 * 单独一个模块是为了让两处渲染路径（侧边栏底部积分入口、设置页明细）
 * 显示的数字严格一致：同一笔 5.61 积分，在两处必须长得一样。
 *
 * @module client/format.js
 */

/** 占位：任何拿不到值的地方都用它，绝不显示 `undefined` 或 `NaN`。 */
export const EMPTY = '—'

/** 积分：保留两位小数，但整数不硬凑噪音。 */
export function credits(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  if (value === 0) return '0'
  if (Math.abs(value) >= 1000) return value.toFixed(2)
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toFixed(4)
}

/** token：按千分位分组，`12345678` → `12,345,678`。 */
export function tokens(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  return Math.round(value).toLocaleString('en-US')
}

/** 紧凑数字：大数压到 k / M，用于一行放不下的地方。 */
export function compact(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000) return (value / 1_000).toFixed(1) + 'k'
  return String(Math.round(value))
}

/** 百分比：入参是 0 到 100，不是 0 到 1。 */
export function percent(value, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  return `${value.toFixed(digits)}%`
}

/** 倍率：0 显示为「免费」，其余保留原始精度。 */
export function multiplier(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  if (value === 0) return '免费'
  return `x${value}`
}

/** 小时标记 `2026-10-02T06` → `06 时`。 */
export function hourLabel(t) {
  if (typeof t !== 'string') return EMPTY
  const at = t.indexOf('T')
  if (at < 0) return t
  if (at === t.length - 1) return EMPTY
  return t.slice(at + 1) + ' 时'
}

/** ISO 时刻 → `HH:MM`。 */
export function clockOf(iso) {
  if (typeof iso !== 'string') return EMPTY
  const at = iso.indexOf('T')
  if (at < 0) return EMPTY
  return iso.slice(at + 1, at + 6)
}

/** 相对时间：`刚刚` / `3 分钟前`。网关的时间戳带时区。 */
export function relativeTime(iso, now = Date.now()) {
  if (typeof iso !== 'string') return EMPTY
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return EMPTY
  const seconds = Math.round((now - at) / 1000)
  if (seconds < 0) return '刚刚'
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  return `${Math.floor(seconds / 86400)} 天前`
}

/** 推理等级的中文标签；未知等级原样返回。 */
export function effortLabel(value) {
  const labels = { low: '低', medium: '中', high: '高', xhigh: '极高', max: '最大' }
  return labels[value] ?? value
}

/** 网关时间戳 → 本地可读日期时间；无效或零值走占位符。 */
export function dateLabel(value) {
  if (typeof value !== 'string' || !value || value.startsWith('0001-')) return EMPTY
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleString('zh-CN', { hour12: false })
}

/** 余额占总额的百分比，用于进度条。 */
export function balancePercent(balance) {
  if (!Number.isFinite(balance?.creditsTotal) || balance.creditsTotal <= 0) return 0
  return Math.max(0, Math.min(100, (balance.credits / balance.creditsTotal) * 100))
}

// —— 以下为「积分扣除历史」专用：逐值对齐网关面板自身的格式化规则 ——
// 用户要求把网关那个板块的信息原样显示出来，所以这里不自己发明缩写规则，
// 否则同一个数字在两处会不一样。

/** 去掉小数末尾多余的零：`716.80` → `716.8`，`716.00` → `716`。 */
export function trimFixed(value) {
  const text = String(value)
  if (!text.includes('.')) return text
  return text.replace(/0+$/, '').replace(/\.$/, '')
}

/** 网关的 token 缩写：≥1e9 → `X.XXB`，≥1e6 → `X.XXM`，≥1e3 → `X.Xk`。 */
export function gatewayTokens(value) {
  const n = Number(value || 0)
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return String(n)
}

/** 网关的积分显示：两位小数再去尾零。 */
export function gatewayCredit(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return EMPTY
  return trimFixed(n.toFixed(2))
}

/** 网关的倍率显示：`0.06` → `x0.06`；空值走占位符。 */
export function gatewayRate(rate) {
  const text = String(rate ?? '').trim()
  return text ? 'x' + text : EMPTY
}

/**
 * 「积分 / 1M Token」。样本数或 token 为 0 时没有意义，走占位符 ——
 * 这正是网关自己的规则，不能拿总 token 去凑一个看起来有的数。
 */
export function gatewayCreditRatio(value, samples, tokens) {
  if (!samples || !tokens) return EMPTY
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return EMPTY
  return trimFixed(n.toFixed(4)) + ' / 1M'
}

/** 缓存命中率文本：`命中/(命中+未命中)`，无样本走占位符。 */
export function cacheRate(hit, miss) {
  const h = Number(hit || 0)
  const m = Number(miss || 0)
  const total = h + m
  if (!total) return EMPTY
  return String(Math.round((h / total) * 1000) / 10) + '%'
}

/**
 * 缓存命中率的健康色 —— 与网关面板同一套阈值：
 * ≥90% 绿 / 80 到 90% 黄 / 低于 80% 红。
 */
export function cacheColor(hit, miss) {
  const h = Number(hit || 0)
  const m = Number(miss || 0)
  const total = h + m
  if (!total) return 'var(--dsw-alias-label-tertiary, rgba(128,128,128,.8))'
  const pct = (h / total) * 100
  if (pct >= 90) return 'var(--success, #30a46c)'
  if (pct >= 80) return 'var(--warning, #f2b94b)'
  return 'var(--danger, #e5484d)'
}
