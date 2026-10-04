/**
 * 快照装配 —— 把网关的两份答复拼成浏览器要的一张图。
 *
 * 这是 Host 侧唯一的业务 PDT：浏览器半身不读网关原始数据，只读这里的产出，
 * 形状变更只需要改这一个文件。
 *
 * @module src/snapshot.js
 */

import { buildModelCapabilities, buildModelMatches, buildSeries, collectUsageRates, creditTotals, indexModelCapabilities, indexModelRates, lowRateModels, accountCards } from '../shared/parse.js'
import { LOW_RATE_THRESHOLD } from '../shared/constants.js'

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
 * @returns {Promise<import('../shared/types.js').UsageSnapshot>}
 */
export async function buildSnapshot(ctx, gateway, options) {
  const { models } = options

  // 两份同时取：缺任何一份都还能出半个面板，所以分开容错。
  const [listing, usage, overview] = await Promise.all([gateway.models(), gateway.usage(), gateway.overview()])

  if (!listing && !usage && !overview) {
    return {
      ok: false,
      error: '网关不可达或 API Key 无效',
      models: [],
      accountCards: [],
      series: [],
      matches: [],
    }
  }

  const rateIndex = indexModelRates(listing ?? {})
  const capabilityIndex = indexModelCapabilities(listing ?? {})
  const usageRates = collectUsageRates(usage ?? {})
  // 完整倍率表优先；用量维度里的 rate 只在前者缺席时补位。
  const merged = new Map(rateIndex)
  for (const [key, rate] of usageRates) {
    if (!merged.has(key)) merged.set(key, { multiplier: rate, raw: String(rate) })
  }

  // `matches` 走「已添加模型 × 网关倍率」，只服务状态栏 pill（要定位会话当前模型）；
  // 设置页的模型板块走 `models`，那是网关自己的清单，与 DSH 配置无关 ——
  // 用户看到的是「网关现在有哪些便宜模型」，不是「我配了哪些」。
  return {
    ok: true,
    error: null,
    generated: usage?.generated ?? null,
    since: usage?.since ?? null,
    totals: usage?.totals ?? null,
    creditTotals: creditTotals(usage?.totals),
    accounts: overview?.accounts ?? [],
    accountCards: accountCards(overview?.accounts),
    capabilities: buildModelCapabilities(models, capabilityIndex),
    configuredModels: models,
    models: lowRateModels(listing ?? {}, usage ?? {}, LOW_RATE_THRESHOLD),
    series: buildSeries(usage ?? {}),
    matches: buildModelMatches(models, merged, usage ?? {}),
  }
}
