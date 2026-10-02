/**
 * 网关数据解析 —— 把 `workbuddy2api` 的返回阵地揉成 (browser-first医疗机构字典。
 *
 * 两处关乎正确性，值得先说清：
 * 1. **倍率字符串**：上游 `credits` 字段有三种形态 —— `x0.79`、`0.71 credits`、
 *    以及空值/缺席（免费模型）。解析器必须全部吃到，空值一律解读为「0 倍率」
 *    而不是「未知」，因为网关清单里 `cn:hy3` 与 `global:hy3` 就是写了 `x0.00`。
 * 2. **型号键_norms**：DSH 侧模型 id 形如 `cn:hy4-preview`；用量维度给的却是裸名
 *    `hy4-preview`（丢掉了 realm 前缀）。比对时必须把两者 unify 到同一个「型号裸颇」
 *    才能配上 —— 否则每个模型的倍率都会误报为「未知」。
 *
 * @module shared/parse.js
 */

/** 从形如 `x0.79` / `0.71 credits` / `1.62` 的上游字符串里揪出数值部分。 */
export function parseMultiplier(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const match = raw.match(/(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = Number.parseFloat(match[1])
  return Number.isFinite(value) ? value : null
}

/**
 * 把一个可能是 `cn:hy4-preview` 的 id 剥成裸名 `hy4-preview`。
 * 用量维度的 key 不带 realm 前缀，比对前必须先把两边归一。
 */
export function bareModelId(id) {
  if (typeof id !== 'string') return ''
  const at = id.indexOf(':')
  return at < 0 ? id : id.slice(at + 1)
}

/** 取数值，非有限值一律回落 `fallback` —— 上游缺字段时保证不出现 NaN。 */
export function num(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * 把上游的积分扣除维度裁成「积分扣除历史」表的行。
 *
 * 与 `toUsageRow` 分开是有意的：这张表要的是**与积分同时观测到的 token**
 * （`credit_tokens`）与有效样本数（`credit_samples`），而不是全部 token。
 * 两者混用会让「积分 / 1M Token」这个折算值失真 —— 网关自己也把这两个
 * 口径分开存。
 *
 * @param {object} raw 上游行
 * @returns {object} 积分扣除历史行
 */
export function toCreditRow(raw) {
  const rate = typeof raw?.rate === 'string' ? raw.rate.trim() : ''
  return {
    key: typeof raw?.key === 'string' ? raw.key : '',
    realm: typeof raw?.realm === 'string' ? raw.realm : '',
    nickname: typeof raw?.nickname === 'string' ? raw.nickname : '',
    rate,
    requests: num(raw?.requests),
    credits: num(raw?.credits),
    creditTokens: num(raw?.credit_tokens),
    creditSamples: num(raw?.credit_samples),
    creditsPer1m: num(raw?.credits_per_1m_tokens),
    cacheHitTokens: num(raw?.cache_hit_tokens),
    cacheMissTokens: num(raw?.cache_miss_tokens),
    cacheHitRate: num(raw?.cache_hit_rate),
  }
}

/**
 * 上游 `totals` 里的积分扣除汇总 —— 面板顶部那五张卡的原始值。
 * @param {object} totals 上游 totals
 */
export function creditTotals(totals) {
  return {
    credits: num(totals?.credits),
    creditTokens: num(totals?.credit_tokens),
    creditSamples: num(totals?.credit_samples),
    creditsPer1m: num(totals?.credits_per_1m_tokens),
    cacheHitTokens: num(totals?.cache_hit_tokens),
    cacheMissTokens: num(totals?.cache_miss_tokens),
  }
}

/**
 * 把上游的一个用量维度裁剪成 UI 行；同时给参与了本次 Regress 的倍率。
 * @param {object} raw 上游行
 * @param {Map<string, number>} rates 裸颇 → 倍率
 */
export function toUsageRow(raw, rates) {
  const key = typeof raw?.key === 'string' ? raw.key : ''
  return {
    key,
    realm: typeof raw?.realm === 'string' ? raw.realm : undefined,
    nickname: typeof raw?.nickname === 'string' ? raw.nickname : undefined,
    rate: typeof raw?.rate === 'string' ? parseMultiplier(raw.rate) : (rates?.get(bareModelId(key)) ?? null),
    requests: num(raw?.requests),
    errors: num(raw?.errors),
    tokens: num(raw?.total_tokens),
    credits: num(raw?.credits),
    creditsPer1m: num(raw?.credits_per_1m_tokens),
    cacheHitRate: num(raw?.cache_hit_rate),
  }
}

/**
 * 从 `/panel/api/usage` 的答复里抽出「模型 → 倍率」表。
 * `credit_by_model` 带 `rate` 字段但只统计有消耗的模型；完整倍率表来自另一份模型清单，
 * 由调用方额外传入 —— 这里只负责把两个来源合成一张以裸颇为键的表。
 * @param {object} usage `/panel/api/usage` 的答复
 * @returns {Map<string, number>} 裸颇 → 倍率数值
 */
export function collectUsageRates(usage) {
  const rates = new Map()
  for (const row of usage?.credit_by_model ?? []) {
    if (!row || typeof row.key !== 'string') continue
    const rate = parseMultiplier(row.rate)
    if (rate === null) continue
    rates.set(bareModelId(row.key), rate)
  }
  return rates
}

/**
 * 从 `/v1/models` 的答复里构建完整的「裸颇 → 倍率」索引。
 * 注意：这里的 id 带 realm 前缀，必须 normalized 后才能与用量维度比对。
 * @param {object} listing `/v1/models` 的答复
 * @returns {Map<string, { multiplier: number|null, raw: string|null }>}
 */
export function indexModelRates(listing) {
  const index = new Map()
  for (const model of listing?.data ?? []) {
    if (!model || typeof model.id !== 'string') continue
    const raw = typeof model.credits === 'string' ? model.credits : null
    index.set(bareModelId(model.id), {
      multiplier: parseMultiplier(raw),
      raw,
    })
  }
  return index
}

/**
 * 从网关模型清单提取真实推理等级。
 * `supported_efforts` 是唯一可信的可选值；空数组或缺失表示不能切换。
 * 同一裸模型存在 cn/global 两条路由时分别保留完整 id，避免串倍率或等级。
 */
export function indexModelCapabilities(listing) {
  const index = new Map()
  for (const model of listing?.data ?? []) {
    if (!model || typeof model.id !== 'string') continue
    const efforts = Array.isArray(model.supported_efforts)
      ? model.supported_efforts.filter((value) => typeof value === 'string' && value)
      : []
    const defaultEffort = typeof model.default_effort === 'string' && model.default_effort
      ? model.default_effort
      : typeof model.reasoning_effort === 'string' && model.reasoning_effort
        ? model.reasoning_effort
        : efforts[0] ?? null
    index.set(model.id, {
      id: model.id,
      name: typeof model.name === 'string' && model.name ? model.name : model.id,
      efforts,
      defaultEffort,
      supportsReasoning: model.supports_reasoning === true || efforts.length > 0,
      canDisableThinking: model.can_disable_thinking === true,
      contextLength: num(model.context_length ?? model.max_allowed_size),
      maxOutputTokens: num(model.max_output_tokens),
    })
  }
  return index
}

/** 将完整模型能力索引裁成配置模型列表，并按原配置顺序输出。 */
export function buildModelCapabilities(configured, capabilityIndex) {
  return (Array.isArray(configured) ? configured : []).map((id) => {
    const exact = capabilityIndex.get(id)
    if (exact) return exact
    const realm = typeof id === 'string' && id.includes(':') ? id.split(':', 1)[0] : ''
    const bare = bareModelId(id)
    const fallback = [...capabilityIndex.values()].find((row) => bareModelId(row.id) === bare && (!realm || row.id.startsWith(`${realm}:`)))
    return fallback ?? {
      id,
      name: id,
      efforts: [],
      defaultEffort: null,
      supportsReasoning: false,
      canDisableThinking: false,
      contextLength: 0,
      maxOutputTokens: 0,
    }
  })
}

/**
 * 把已添加模型与网关倍率表、近期用量缝到一起 —— 插件的核心名单。
 *
 * 「已添加」指 DSH 配置里登记的模型（如 `cn:hy4-preview`）。产出按
 * 倍率降序，让「最贵」的型号排在面板最上面。
 *
 * @param {string[]} configured 已添加模型 id 列表
 * @param {Map<string, { multiplier: number|null, raw: string|null }>} rateIndex 完整倍率索引
 * @param {object} usage `/panel/api/usage` 的答复
 * @returns {import('./types.js').ModelMatch[]}
 */
export function buildModelMatches(configured, rateIndex, usage) {
  /** 裸颇 → 该模型的近期用量合计 */
  const usageByBare = new Map()
  for (const row of usage?.by_model ?? []) {
    if (!row || typeof row.key !== 'string') continue
    usageByBare.set(row.key, row)
    usageByBare.set(bareModelId(row.key), row)
  }

  const matches = (Array.isArray(configured) ? configured : []).map((id) => {
    const bare = bareModelId(id)
    const exactRate = rateIndex.get(id)
    const rate = exactRate ?? rateIndex.get(bare)
    const row = usageByBare.get(id) ?? usageByBare.get(bare)
    return {
      id,
      multiplier: rate?.multiplier ?? null,
      raw: rate?.raw ?? null,
      known: rate !== undefined && rate.multiplier !== null,
      used: row !== undefined,
      requests: num(row?.requests),
      credits: num(row?.credits),
      tokens: num(row?.total_tokens),
    }
  })

  // 倍率高的在前；倍率未知的沉到最后（按 requests 排），已用量的优先展示。
  matches.sort((a, b) => {
    if (a.multiplier === null && b.multiplier === null) return b.requests - a.requests
    if (a.multiplier === null) return 1
    if (b.multiplier === null) return -1
    return b.multiplier - a.multiplier
  })
  return matches
}

/**
 * 把 `series`（小时序列）裁成 UI 柱 —— 24h 积分趋势的数据源。
 * @param {object} usage `/panel/api/usage` 的答复
 * @returns {import('./types.js').SeriesPoint[]}
 */
export function buildSeries(usage) {
  const series = []
  for (const row of usage?.series ?? []) {
    if (!row || typeof row.t !== 'string') continue
    series.push({
      t: row.t,
      requests: num(row.requests),
      errors: num(row.errors),
      tokens: num(row.total_tokens),
      credits: num(row.credits),
    })
  }
  return series
}

/**
 * 按请求数取用量维度的前 N 行 —— 面板表格不希望被几十个账户撑爆。
 * @param {object[]} rows 上游原始行
 * @param {number} limit
 * @param {Map<string, number>} rates 裸颇 → 倍率
 */
export function topRows(rows, limit, rates) {
  const source = Array.isArray(rows) ? rows : []
  return source
    .slice()
    .sort((a, b) => num(b?.requests) - num(a?.requests))
    .slice(0, Math.max(0, limit))
    .map((row) => toUsageRow(row, rates))
}
