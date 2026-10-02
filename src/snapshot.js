/**
 * 快照装配 —— 把网关的两份答复拼成浏览器要的一张图。
 *
 * 这是 Host 侧唯一的业务 PDT：浏览器半身不读网关原始数据，只读这里的产出，
 * 形状变更只需要改这一个文件。
 *
 * @module src/snapshot.js
 */

import { buildModelCapabilities, buildModelMatches, buildSeries, collectUsageRates, creditTotals, indexModelCapabilities, indexModelRates, toCreditRow, topRows } from '../shared/parse.js'

/**
 * 从 DSH 配置里抽出已添加的模型 id。
 *
 * 形状是 `llm-pi-ai` 的 config：`providers.<id>.models[].id`。之所以自己去寇这个图，
 * 是因为它比请在服务端去做导游 registry 更可靠 —— 配置里有什么就显示什么。
 * 读不到就返回空数组，面板会退化成「只显示有消耗的模型」。
 *
 * @param {object|undefined} llmPiAiConfig `llm-pi-ai` 的配置
 * @param {string[]} providerIds 要纳入的 provider（默认全部）
 * @returns {string[]}
 */
export function configuredModels(llmPiAiConfig, providerIds) {
  const providers = llmPiAiConfig?.providers
  if (!providers || typeof providers !== 'object') return []
  const wanted = Array.isArray(providerIds) && providerIds.length > 0 ? new Set(providerIds) : null
  const ids = []
  for (const [providerId, provider] of Object.entries(providers)) {
    if (wanted && !wanted.has(providerId)) continue
    const models = Array.isArray(provider?.models) ? provider.models : []
    for (const model of models) {
      if (typeof model?.id === 'string' && model.id) ids.push(model.id)
    }
  }
  return ids
}

/**
 * 装配浏览器要的完整快照。
 *
 * @param {object} ctx Cordis context（用于 `ctx.get`）
 * @param {import('./gateway.js').Gateway} gateway
 * @param {object} options
 * @param {string[]} options.models 已添加模型 id
 * @param {number} options.rowLimit 表格显示行数上限
 * @returns {Promise<import('../shared/types.js').UsageSnapshot>}
 */
export async function buildSnapshot(ctx, gateway, options) {
  const { models, rowLimit } = options

  // 两份同时取：缺任何一份都还能出半个面板，所以分开容错。
  const [listing, usage, overview] = await Promise.all([gateway.models(), gateway.usage(), gateway.overview()])

  if (!listing && !usage && !overview) {
    return { ok: false, error: '网关不可达或 API Key 无效', models: [], accounts: [], creditModels: [], creditAccounts: [], series: [], matches: [] }
  }

  const rateIndex = indexModelRates(listing ?? {})
  const capabilityIndex = indexModelCapabilities(listing ?? {})
  const usageRates = collectUsageRates(usage ?? {})
  // 完整倍率表优先；用量维度里的 rate 只在前者缺席时补位。
  const merged = new Map(rateIndex)
  for (const [key, rate] of usageRates) {
    if (!merged.has(key)) merged.set(key, { multiplier: rate, raw: String(rate) })
  }

  const matches = buildModelMatches(models, merged, usage ?? {})
  const limit = Number.isFinite(rowLimit) ? Math.max(1, rowLimit) : 10

  return {
    ok: true,
    error: null,
    generated: usage?.generated ?? null,
    since: usage?.since ?? null,
    totals: usage?.totals ?? null,
    balances: normalizeBalances(overview?.accounts),
    capabilities: buildModelCapabilities(models, capabilityIndex),
    configuredModels: models,
    models: topRows(usage?.by_model, limit, usageRates),
    accounts: topRows(usage?.by_account, limit, usageRates),
    // 积分扣除历史：整份列出，不按 rowLimit 截断 —— 这是账目，缺行会误导。
    creditModels: (usage?.credit_by_model ?? []).map(toCreditRow),
    creditAccounts: (usage?.credit_by_account ?? []).map(toCreditRow),
    creditTotals: creditTotals(usage?.totals),
    series: buildSeries(usage ?? {}),
    matches,
  }
}

/**
 * 从快照里算出「会话级别」的展示所需总和。
 *
 * 「会话」在网关侧没有直接对应的维度 —— 网关按小时/模型/账户聚合，不认 DSH 的会话。
 * 所以这里取的是**当前统计窗口内的整体消耗**：财务上对得上，语义上诚实标注为
 * 「本期」而不是假装算出了单个会话的量。
 *
 * @param {import('../shared/types.js').UsageSnapshot} snapshot
 */
/** 将网关 overview 账户行裁成余额页需要的安全字段。 */
export function normalizeBalances(accounts) {
  return (Array.isArray(accounts) ? accounts : []).map((account) => ({
    uid: typeof account?.uid === 'string' ? account.uid : '',
    nickname: typeof account?.nickname === 'string' ? account.nickname : '未命名账户',
    realm: typeof account?.realm === 'string' ? account.realm : '',
    credits: Number.isFinite(account?.credits) ? account.credits : 0,
    creditsTotal: Number.isFinite(account?.credits_total) ? account.credits_total : 0,
    creditsExpiring: Number.isFinite(account?.credits_expiring) ? account.credits_expiring : 0,
    earliestExpiry: typeof account?.credits_earliest_expiry === 'string' ? account.credits_earliest_expiry : null,
    earliestRemaining: Number.isFinite(account?.credits_earliest_remaining) ? account.credits_earliest_remaining : 0,
    disabled: account?.disabled === true,
    cooling: account?.cooling === true,
    until: typeof account?.until === 'string' ? account.until : null,
    successCount: Number.isFinite(account?.success_count) ? account.success_count : 0,
    lastSuccess: typeof account?.last_success === 'string' ? account.last_success : null,
    tokenUsage: account?.token_usage && typeof account.token_usage === 'object' ? {
      requests: Number.isFinite(account.token_usage.request_count) ? account.token_usage.request_count : 0,
      usage: Number.isFinite(account.token_usage.usage_count) ? account.token_usage.usage_count : 0,
      promptTokens: Number.isFinite(account.token_usage.prompt_tokens) ? account.token_usage.prompt_tokens : 0,
      completionTokens: Number.isFinite(account.token_usage.completion_tokens) ? account.token_usage.completion_tokens : 0,
      totalTokens: Number.isFinite(account.token_usage.total_tokens) ? account.token_usage.total_tokens : 0,
      lastModel: typeof account.token_usage.last_model === 'string' ? account.token_usage.last_model : null,
      lastUsedAt: typeof account.token_usage.last_used_at === 'string' ? account.token_usage.last_used_at : null,
    } : null,
    modelCosts: Array.isArray(account?.model_costs) ? account.model_costs.map((cost) => ({
      model: typeof cost?.model === 'string' ? cost.model : '',
      costPer1k: Number.isFinite(cost?.cost_per_1k) ? cost.cost_per_1k : 0,
      lastSeen: typeof cost?.last_seen === 'string' ? cost.last_seen : null,
      samples: Number.isFinite(cost?.samples) ? cost.samples : 0,
    })) : [],
  }))
}

export function headlineOf(snapshot) {
  const totals = snapshot?.totals
  return {
    credits: Number.isFinite(totals?.credits) ? totals.credits : 0,
    requests: Number.isFinite(totals?.requests) ? totals.requests : 0,
    errors: Number.isFinite(totals?.errors) ? totals.errors : 0,
    tokens: Number.isFinite(totals?.total_tokens) ? totals.total_tokens : 0,
    cacheHitRate: Number.isFinite(totals?.cache_hit_rate) ? totals.cache_hit_rate : 0,
  }
}
