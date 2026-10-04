/**
 * 网关客户端 —— 与 `workbuddy2api` 面板对话的唯一出口。
 *
 * 三条约定：
 * 1. 密钥从 credentialsservice 解析，永远不写进日志、也不发给浏览器。
 * 2. 所有失败都解析成 `null` + 一句人话，绝不把异常抛到调用层。
 * 3. 快照缓一小段时间 —— UI 轮询与拓展面板共享同一份快照。
 *
 * @module src/gateway.js
 */

import { UPSTREAM_TIMEOUT_MS, HOST_CACHE_MS, USAGE_WINDOW_HOURS } from '../shared/constants.js'

/** 一次带超时的 JSON 读取；任何失败（含非 2xx）都返回 null。 */
async function getJson(url, headers, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { headers, signal: controller.signal })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 薄缓存：同一 URL + 用例在有效期内只打一次网关。
 * 用途 —— 面板开启、会话标签切换、间隔轮询会同时来问，别把 NAS 打爆。
 */
class TinyCache {
  #expires = HOST_CACHE_MS
  #entries = new Map()

  constructor(ttlMs = HOST_CACHE_MS) {
    this.#expires = ttlMs
  }

  /**
   * 取一个值；miss 时调用 loader。loader 抛错则原样上抛（由调用方处理）。
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} loader
   * @returns {Promise<T>}
   */
  async use(key, loader) {
    const hit = this.#entries.get(key)
    const now = Date.now()
    if (hit && now - hit.at < this.#expires) return hit.value
    const value = await loader()
    this.#entries.set(key, { at: now, value })
    return value
  }

  /** 清空 —— 设置变动后强制重新取数。 */
  clear() {
    this.#entries.clear()
  }
}

/**
 * 网关的一个已配置实例。
 *
 * 三个 data sources：
 * - `/v1/models` —— 完整倍率表（`credits` 字段），承担「模型 → 倍率」索引。
 * - `/panel/api/usage` —— 用量 RAM，含 `by_model` / `credit_by_model` / `series`。
 * - `/panel/api/logs` —— 面板日志，仅用于「最近活动」时间序列的补充。
 */
export class Gateway {
  #baseUrl
  #apiKey
  #cache = new TinyCache()

  /**
   * @param {string} baseUrl 网关地址，如 `http://192.168.1.42:7863`
   * @param {string} apiKey 网关密钥（Bearer）
   */
  constructor(baseUrl, apiKey) {
    this.#baseUrl = String(baseUrl).replace(/\/+$/, '')
    this.#apiKey = String(apiKey)
  }

  /** 所有路由的共同请求头。 */
  #headers() {
    return { authorization: `Bearer ${this.#apiKey}` }
  }

  /** 清空缓存 —— 配置变更后必须调用，否则会继续吐旧倍率。 */
  invalidate() {
    this.#cache.clear()
  }

  /**
   * 取完整模型清单（含每个模型的 `credits` 倍率字符串与推理等级）。
   *
   * 面板接口优先，因为它额外返回 `supported_efforts` / `default_effort`；
   * `/v1/models` 仍作为回退，兼容关闭面板路由的网关版本。
   *
   * ## 两条接口的形状不同，返回值统一成 `{ models: [...] }`
   *
   * `/panel/api/models` 给 `{ models: [...] }`，`/v1/models` 给 `{ data: [...] }`。
   * 原先这里把面板结果包成 `{ data: ... }` 去迁就 `/v1`，于是同一个字段名在两条
   * 路径上含义相反 —— 下游按 `models` 读就永远读到空数组，而且**不报错**，
   * 只表现为「模型板块一行都没有」。这里在出口收口，下游只认一种形状。
   *
   * @returns {Promise<{ models: object[] }|null>}
   */
  models() {
    return this.#cache.use('models', async () => {
      const panel = await getJson(`${this.#baseUrl}/panel/api/models`, this.#headers())
      if (panel && Array.isArray(panel.models)) return { models: panel.models }
      const legacy = await getJson(`${this.#baseUrl}/v1/models`, this.#headers())
      if (legacy && Array.isArray(legacy.data)) return { models: legacy.data }
      return null
    })
  }

  /**
   * 取用量快照。
   *
   * `hours` 显式给了窗口 —— 网关的默认窗口是当日累计，跨度能到十几个小时，
   * 而设置页只画最近 12 小时。窗口写在 URL 上而不是事后截断 `series`：事后截断
   * 拿到的仍是全天口径的 `totals`，顶部那几个数字会和下面的图对不上。
   *
   * @returns {Promise<object|null>}
   */
  usage() {
    return this.#cache.use('usage', async () => {
      return await getJson(`${this.#baseUrl}/panel/api/usage?hours=${USAGE_WINDOW_HOURS}`, this.#headers())
    })
  }

  /**
   * 取账户余额与有效期明细。该接口是网关面板自身的只读 overview，
   * 比直接读 NAS 上的 state.json 更安全，也能拿到冷却/最近成功等实时字段。
   * @returns {Promise<object|null>}
   */
  overview() {
    return this.#cache.use('overview', async () => {
      return await getJson(`${this.#baseUrl}/panel/api/overview`, this.#headers())
    })
  }

  /**
   * 取面板日志 —— 最近的活动流水。每次新取，不缓存（日志增长很快）。
   * @returns {Promise<object|null>}
   */
  logs() {
    return getJson(`${this.#baseUrl}/panel/api/logs`, this.#headers())
  }

  /**
   * 探活 —— 只校验连通性与密钥是否有效，不读任何数据。
   * @returns {Promise<{ ok: boolean, status: number|null, message: string }>}
   */
  async probe() {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      const response = await fetch(`${this.#baseUrl}/v1/models`, {
        headers: this.#headers(),
        signal: controller.signal,
      })
      if (response.ok) return { ok: true, status: response.status, message: '网关可达' }
      if (response.status === 401) return { ok: false, status: 401, message: 'API Key 无效' }
      return { ok: false, status: response.status, message: `网关返回 HTTP ${response.status}` }
    } catch (error) {
      const aborted = error?.name === 'AbortError'
      return {
        ok: false,
        status: null,
        message: aborted ? '请求超时：网关无响应' : '无法连接网关',
      }
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * 从 credentialsservice 解析网关密钥。
 *
 * `credentials.resolve()` 收一个凭据 ref 字符串（plugin-env ref 就是环境变量名，
 * 例如 `WORKBUDDY_API_KEY`），返回 `{ value }` —— 这一点是从已装插件的实际调用里
 * 确认的，不要换成对象形态。失败则回落 config 里的明文密钥。
 *
 * 返回值带上「是从哪里拿到的」，以便配错了人能看懂。
 *
 * @param {object|undefined} credentials `ctx.get('credentials')`
 * @param {string} apiKeyRef 凭据 ref 名（环境变量名）
 * @param {string} fallback 配置里的明文密钥
 * @returns {Promise<{ key: string, source: string }|null>}
 */
export async function resolveApiKey(credentials, apiKeyRef, fallback) {
  if (typeof credentials?.resolve === 'function' && apiKeyRef) {
    try {
      const hit = await credentials.resolve(apiKeyRef)
      const value = typeof hit === 'string' ? hit : hit?.value
      if (typeof value === 'string' && value) return { key: value, source: `凭据 ${apiKeyRef}` }
    } catch {
      // 落到下面的明文回落
    }
  }
  if (typeof fallback === 'string' && fallback) return { key: fallback, source: '插件配置' }
  return null
}
