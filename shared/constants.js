/**
 * 共享常量 —— Host 半身与浏览器半身共用的名字。
 *
 * 只放跨半身必须一致的字符串与数值：入口 id、locale namespace、
 * 那条受鉴权保护的 HTTP 路由、默认轮询节奏。改一处，两边同步。
 *
 * @module shared/constants.js
 */

/** Loader entry id —— patch 层 `- id:` 的那一行，必须逐字一致。 */
export const ENTRY_ID = 'workbuddy-credits'

/** Locale namespace —— 与 `ctx.locale.register(ns, dicts)` 的 ns 一致。 */
export const LOCALE_NS = 'workbuddyCredits'

/**
 * 本插件唯一的 HTTP 路由，挂在 `/api` 鉴权围栏之内。
 * 浏览器半身 POST 到这里取用量快照，网关密钥始终留在 Host 侧。
 */
export const API_ROUTE = '/api/workbuddy-credits/usage'

/** Setting.xml 命名空间 —— patch config 里 `- id: workbuddy-credits` 那一行必须存在。 */
export const SETTINGS_NS = 'workbuddy-credits'

/** 默认 UI 轮询间隔（毫秒）。 */
export const DEFAULT_POLL_MS = 30_000

/** 轮询间隔下限（毫秒）—— 防止面板把网关打爆。 */
export const MIN_POLL_MS = 5_000

/** 单次网关请求超时（毫秒）。 */
export const UPSTREAM_TIMEOUT_MS = 8_000

/** Host 侧同一份快照的最短复用时间（毫秒）；UI 的轮询通常更慢。 */
export const HOST_CACHE_MS = 10_000
