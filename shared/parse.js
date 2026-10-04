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
 * 用量归一 —— 从 `/panel/api/usage` 里抽「带倍率观测的用量行」并按裸名归组。
 *
 * ## 为什么不用 `by_model`
 *
 * `by_model` 只按裸名聚合（`deepseek-v4.1-flash` 一条），而同一个裸模型在网关里
 * 常有 cn / global 两条路由（倍率 0.11 与 0.00）—— 合并后的用量没法归因到具体
 * 路由，国际免费模型会错拿国内路由的消耗。`credit_by_model` 按「模型 + 当时
 * 观测到的倍率」分行（cn 0.11 一行、global 0 一行），倍率就是归因键。
 *
 * @param {object} usage `/panel/api/usage` 的答复
 * @returns {Map<string, object[]>} 裸名 → 该模型的全部用量行（可能多行）
 */
export function indexCreditRows(usage) {
  const index = new Map()
  for (const row of Array.isArray(usage?.credit_by_model) ? usage.credit_by_model : []) {
    if (!row || typeof row.key !== 'string') continue
    const bare = bareModelId(row.key)
    const rows = index.get(bare)
    if (rows) rows.push(row)
    else index.set(bare, [row])
  }
  return index
}

/**
 * 从一个模型的全部用量行里挑出属于指定倍率的那组。
 *
 * 依次尝试 `rates` 里的每个倍率（生效价优先、牌价补位）：观测 rate 与倍率
 * 相等才算命中。全部落空时合并该模型的全部行 —— 与其显示 0，不如显示
 * 「这一路由分不清」的合计；观测 rate 与牌价、促销价都不一致的场景
 * （上游改价窗口期）确实无法更精确。
 *
 * @param {object[]|undefined} rows `indexCreditRows` 归组出的一组行
 * @param {Array<number|null|undefined>} rates 按优先级排列的候选倍率
 * @returns {object[]}
 */
export function pickCreditRows(rows, rates) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) return []
  for (const rate of Array.isArray(rates) ? rates : []) {
    if (typeof rate !== 'number' || !Number.isFinite(rate)) continue
    const hit = list.filter((row) => parseMultiplier(row?.rate) === rate)
    if (hit.length > 0) return hit
  }
  return list
}

/**
 * 把一组用量行加总成展示值。
 *
 * `creditsPer1m` 刻意自己重算（总积分 / 总 credit token x 1M）而不是平均各行：
 * 多行合并时只有加权才是真值；单行时与上游字段一致。token 取 `credit_tokens`
 * （与积分同时观测的口径），与顶部「积分 / 1M Token」的口径相同。
 */
function sumCreditRows(rows) {
  let requests = 0
  let credits = 0
  let hit = 0
  let miss = 0
  let tokens = 0
  for (const row of rows) {
    requests += num(row?.requests)
    credits += num(row?.credits)
    hit += num(row?.cache_hit_tokens)
    miss += num(row?.cache_miss_tokens)
    tokens += num(row?.credit_tokens)
  }
  return {
    requests,
    credits,
    cacheHitTokens: hit,
    cacheMissTokens: miss,
    creditTokens: tokens,
    creditsPer1m: tokens > 0 ? (credits / tokens) * 1e6 : null,
  }
}

/**
 * 网关模型清单 → 「模型」板块的行。
 *
 * ## 用量归因按倍率，不按裸名
 *
 * 用量来自 `credit_by_model`（`indexCreditRows` 归组）：同一个裸模型的 cn / global
 * 两条路由各自一行观测 rate，拿本路由的生效价（促销价优先、牌价补位）去匹配
 * 倍率，匹配不上才合并全部行。
 *
 * ## 这里只认**生效价**，不认牌价
 *
 * `/panel/api/models` 每个模型带三类价格字段：
 *
 * | 字段 | 含义 |
 * | --- | --- |
 * | `credits` | 牌价（转正后的基准倍率） |
 * | `promo_credits` | 促销价，限时免费时是 `0x` |
 * | `promo_factor` | 折扣系数，`0` = 限时免费、`0.5` = 夜间五折 |
 * | `promo_label` / `promo_note` | 促销标签与时段说明 |
 *
 * WorkBuddy 客户端扣积分用的是**生效价**：有 `promo_credits` 就用它，否则用牌价。
 * 所以筛选「倍率 ≤ 0.2」也必须按生效价算 —— 按牌价筛会把一堆正在免费但
 * 牌价 0.29 的模型漏掉，而把牌价便宜、生效价没降的模型错误收进来。
 *
 * @param {object} listing `/panel/api/models` 的答复
 * @param {object} usage `/panel/api/usage` 的答复
 * @param {number} threshold 生效倍率上限（不含）
 * @returns {import('./types.js').LowRateModel[]}
 */
export function lowRateModels(listing, usage, threshold) {
  const models = modelArray(listing)
  const creditIndex = indexCreditRows(usage)

  const rows = []
  for (const model of models) {
    const id = typeof model?.id === 'string' ? model.id : ''
    if (!id) continue

    const listRate = parseMultiplier(model?.credits)
    const promoRate = model?.promo_credits != null && model.promo_credits !== ''
      ? parseMultiplier(model.promo_credits)
      : null
    const effective = promoRate ?? listRate
    // 生效价缺席（上游没写价格）不等于 0，不能收进低倍率列表。
    if (effective === null || effective >= threshold) continue

    const usage = pickCreditRows(creditIndex.get(bareModelId(id)), [promoRate, listRate])
    const summed = sumCreditRows(usage)
    rows.push({
      id,
      name: typeof model?.name === 'string' && model.name ? model.name : id,
      multiplier: effective,
      listRate: listRate,
      promoRate: promoRate,
      promoLabel: typeof model?.promo_label === 'string' && model.promo_label ? model.promo_label : null,
      // 能力位：卡片收起态的第二行由它们拼成「工具 · 视觉 · 思考常开」。
      // `can_disable_thinking` 为真说明思考能关，就不再算「思考常开」——
      // 与原生 models 页 `_3nPmjq_rowTag` 的判定一致。
      supportsToolCall: model?.supports_tool_call === true,
      supportsImages: model?.supports_images === true,
      supportsReasoning: model?.supports_reasoning === true && model?.can_disable_thinking !== true,
      requests: summed.requests,
      credits: summed.credits,
      cacheHitTokens: summed.cacheHitTokens,
      cacheMissTokens: summed.cacheMissTokens,
      creditsPer1m: summed.creditsPer1m,
    })
  }

  // 生效价升序；同价按请求数降序，让有量的模型排在前面。
  rows.sort((a, b) => (a.multiplier - b.multiplier) || (b.requests - a.requests))
  return rows
}

/**
 * 网关账户行 → 「账号」板块的行。
 *
 * 状态列的重点是**模型解封时间** —— `rate_limited_models[].reset_at` 是上游重置
 * 时刻，`until` 是网关自己的最早重试时刻。两个都可能缺席（模型完全没被限流），
 * 这时要老实显示「可用」而不是编一个时间。
 *
 * ## 时间戳有坑
 *
 * 网关的空值是 Go 的零值 `0001-01-01T00:00:00Z`，不是 `null`、不是空串。
 * 用 `Date.parse` 判断会得到一个「公元 1 年」的时间点，直接展示会显示成
 * 1 年前，所以必须显式挡掉。
 *
 * @param {object[]} accounts 网关 overview 的账户行
 * @returns {import('./types.js').AccountCard[]}
 */
export function accountCards(accounts) {
  const now = Date.now()
  const list = Array.isArray(accounts) ? accounts : []

  return list.map((account) => {
    const limits = Array.isArray(account?.rate_limited_models) ? account.rate_limited_models : []
    const limited = limits
      .map((limit) => ({
        model: typeof limit?.model === 'string' ? limit.model : '',
        kind: typeof limit?.kind === 'string' ? limit.kind : 'rate_limit',
        until: gatewayTime(limit?.until),
        resetAt: gatewayTime(limit?.reset_at),
      }))
      .filter((limit) => limit.model !== '')

    // 熔断 / 连败降权 / 限流冷却取最晚的那个截止时刻 —— 那才是真正恢复的时间。
    const cooling = [
      gatewayTime(account?.breaker_until),
      gatewayTime(account?.degrade_until),
      gatewayTime(account?.until),
    ].filter((value) => value !== null && value > now)
    const coolingUntil = cooling.length > 0 ? Math.max(...cooling) : null

    return {
      uid: typeof account?.uid === 'string' ? account.uid : '',
      nickname: typeof account?.nickname === 'string' && account.nickname ? account.nickname : '未命名账户',
      realm: typeof account?.realm === 'string' ? account.realm : '',
      credits: num(account?.credits),
      creditsTotal: num(account?.credits_total),
      creditsExpiring: num(account?.credits_expiring),
      disabled: account?.disabled === true,
      cooling: account?.cooling === true,
      coolingUntil: coolingUntil,
      limited,
    }
  }).sort((a, b) => (a.realm === b.realm
    ? a.nickname.localeCompare(b.nickname, 'zh-CN')
    : a.realm === 'cn' ? -1 : 1))
}

/**
 * 网关时间戳 → 毫秒；零值 / 缺失 / 无法解析一律返回 `null`。
 *
 * 「返回 null 而不是 0」是刻意的：调用方要用它区分「没有这个时间」和
 * 「时间是 1970 年」，后者在展示层会变成误导性的相对时间。
 */
export function gatewayTime(value) {
  if (typeof value !== 'string' || !value || value.startsWith('0001-')) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 上游 `totals` 里的积分折算汇总 —— 设置页顶部那三张卡要用它。
 *
 * 刻意只取「与积分同时观测到的 token」（`credit_tokens`）与有效样本数
 * （`credit_samples`），而不是 `total_tokens`：后者含没有积分的样本，
 * 两者混用会让「积分 / 1M Token」失真 —— 网关自己也把这两个口径分开存。
 *
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
 * 从 `/panel/api/usage` 的答复里抽出「模型 → 倍率」表。
 * `credit_by_model` 带 `rate` 字段但只统计有消耗的模型；完整倍率表来自另一份模型清单，
 * 由调用方额外传入 —— 这里只负责把两个来源合成一张以裸名为键的表。
 *
 * 同一裸名出现多行（cn / global 两条路由）时倍率必然有分歧，键会被丢弃 ——
 * 宁可回退到完整倍率表，也不能让后一行覆盖前一行造成串倍率。
 *
 * @param {object} usage `/panel/api/usage` 的答复
 * @returns {Map<string, number>} 裸名 → 倍率数值
 */
export function collectUsageRates(usage) {
  const rates = new Map()
  const ambiguous = new Set()
  for (const row of usage?.credit_by_model ?? []) {
    if (!row || typeof row.key !== 'string') continue
    const bare = bareModelId(row.key)
    if (ambiguous.has(bare)) continue
    const rate = parseMultiplier(row.rate)
    if (rate === null) continue
    if (rates.has(bare)) {
      rates.delete(bare)
      ambiguous.add(bare)
      continue
    }
    rates.set(bare, rate)
  }
  return rates
}

/**
 * 从模型清单里取模型数组。
 *
 * 两条网关接口的形状不同：`/panel/api/models` 给 `{ models: [...] }`，
 * `/v1/models` 给 `{ data: [...] }`。`Gateway.models()` 已经在出口统一成前者，
 * 这里仍认两种 —— 解析器不该假设调用方一定走的是哪条路径，而多认一个键的
 * 成本是零。取不到时返回空数组，绝不返回 `undefined` 让下游炸在 `.map` 上。
 */
function modelArray(listing) {
  if (Array.isArray(listing?.models)) return listing.models
  if (Array.isArray(listing?.data)) return listing.data
  return []
}

/**
 * 从模型清单构建「id → 倍率」索引。
 *
 * 完整 id（`cn:deepseek-v4.1-flash`）永远精确建键；裸名键只在**唯一**时登记 ——
 * 同一裸模型存在 cn / global 两条路由时倍率不同（0.11 与 0.00），裸名键会让
 * 后一条覆盖前一条，国内模型就会拿国际的倍率、进而匹配到国际的用量行。
 * 裸名唯一时仍登记裸名键，保持「清单只有裸名」场景的回退可用。
 *
 * @param {object} listing 模型清单
 * @returns {Map<string, { multiplier: number|null, raw: string|null }>}
 */
export function indexModelRates(listing) {
  const models = modelArray(listing).filter((model) => model && typeof model.id === 'string')
  const bareCounts = new Map()
  for (const model of models) {
    const bare = bareModelId(model.id)
    bareCounts.set(bare, (bareCounts.get(bare) ?? 0) + 1)
  }

  const index = new Map()
  for (const model of models) {
    const raw = typeof model.credits === 'string' ? model.credits : null
    const entry = { multiplier: parseMultiplier(raw), raw }
    index.set(model.id, entry)
    const bare = bareModelId(model.id)
    if (bareCounts.get(bare) === 1) index.set(bare, entry)
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
  for (const model of modelArray(listing)) {
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
 * 用量归因同样走 `credit_by_model`（见 `lowRateModels` 的说明）：
 * `by_model` 按裸名合并 cn / global 两条路由，会把国内路由的消耗错记到
 * 国际免费模型头上 —— 状态栏 pill 就会显示出「免费模型扣了两百积分」。
 *
 * @param {string[]} configured 已添加模型 id 列表
 * @param {Map<string, { multiplier: number|null, raw: string|null }>} rateIndex 完整倍率索引
 * @param {object} usage `/panel/api/usage` 的答复
 * @returns {import('./types.js').ModelMatch[]}
 */
export function buildModelMatches(configured, rateIndex, usage) {
  const creditIndex = indexCreditRows(usage)

  const matches = (Array.isArray(configured) ? configured : []).map((id) => {
    const bare = bareModelId(id)
    const exactRate = rateIndex.get(id)
    const rate = exactRate ?? rateIndex.get(bare)
    const candidates = [rate?.multiplier]
    const summed = sumCreditRows(pickCreditRows(creditIndex.get(bare), candidates))
    return {
      id,
      multiplier: rate?.multiplier ?? null,
      raw: rate?.raw ?? null,
      known: rate !== undefined && rate.multiplier !== null,
      used: summed.requests > 0,
      requests: summed.requests,
      credits: summed.credits,
      tokens: summed.creditTokens,
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
 * 把 `series`（小时序列）裁成 UI 柱 —— Token 时序图的数据源。
 *
 * 保留 prompt / completion 的分项，因为图是**堆叠柱**：只看总 token 就丢了
 * 「这次调用是长上下文输入还是长输出」这个最直观的信号。
 * 时间戳保留 `t` 原文（`2026-10-03T06`），刻度标签由展示层切，不在这里转 —
 * 转了就丢掉了「这是小时桶」这个前提。
 *
 * @param {object} usage `/panel/api/usage` 的答复
 * @returns {import('./types.js').SeriesPoint[]}
 */
export function buildSeries(usage) {
  const series = []
  for (const row of usage?.series ?? []) {
    if (!row || typeof row.t !== 'string') continue
    const prompt = num(row.prompt_tokens)
    const completion = num(row.completion_tokens)
    series.push({
      t: row.t,
      requests: num(row.requests),
      errors: num(row.errors),
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: num(row.total_tokens) || prompt + completion,
      credits: num(row.credits),
    })
  }
  return series
}
