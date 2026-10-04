/**
 * 网关数据形状 —— 一份只读的类型地图。
 *
 * `workbuddy2api` 面板的 `/panel/api/usage` 返回的字段散落在不同维度里：
 * 全局汇总、按模型、按账户、按小时序列。这里把它们收拢成几个名词出处，
 * 两边半身据此读字段，不再各自字面量硬编码字符串。
 *
 * 全部按 fail-open 设计：任何字段缺失都走 `"—"`，不会因上游加字段而崩。
 *
 * @module shared/types.js
 */

/**
 * 一个用量维度的原始 statistics；上游任何字段缺失都按 0 / null 处理。
 * @typedef {object} UsageStat
 * @property {string} key 维度键（模型 id / 账户 id / realm）
 * @property {string} [realm] `cn` 或 `global`，仅账户维度带
 * @property {string} [nickname] 账户昵称，仅账户维度带
 * @property {string} [rate] 该模型当时的积分倍率字符串，如 `0.06`
 * @property {number} requests 请求数
 * @property {number} errors 失败数
 * @property {number} prompt_tokens 输入 token
 * @property {number} completion_tokens 输出 token
 * @property {number} total_tokens 总 token
 * @property {number} credits 消耗积分
 * @property {number} credits_per_1m_tokens 每百万 token 积分单价
 * @property {number} cache_hit_tokens 缓存命中 token
 * @property {number} cache_miss_tokens 缓存未命中 token
 * @property {number} cache_hit_rate 缓存命中率百分比
 * @property {number} avg_latency_ms 平均延迟毫秒
 * @property {number} avg_tokens_per_second 平均吞吐
 */

/**
 * 一个修剪过的维度行 —— Host 半身喂给浏览器的最终形状。
 * 行数已被 `topModels` / `topAccounts` 约束，字段只读展示所需。
 * @typedef {object} UsageRow
 * @property {string} key 维度键
 * @property {string} [realm] `cn` / `global`
 * @property {string} [nickname] 账户昵称
 * @property {number} [rate] 积分倍率数值（不是字符串）
 * @property {number} requests 请求数
 * @property {number} errors 失败数
 * @property {number} tokens 总 token
 * @property {number} credits 消耗积分
 * @property {number} [creditsPer1m] 每百万 token 单价
 * @property {number} [cacheHitRate] 缓存命中率
 * @property {boolean} known 是否命中模型的 listed 倍率表
 */

/**
 * 小时序列上的一点 —— Token 时序图的一根堆叠柱。
 * @typedef {object} SeriesPoint
 * @property {string} t 小时桶起始时刻，如 `2026-10-03T06`
 * @property {number} requests 该小时请求数
 * @property {number} errors 失败数
 * @property {number} promptTokens 输入 token（柱的下段）
 * @property {number} completionTokens 输出 token（柱的上段）
 * @property {number} totalTokens 总 token（柱高）
 * @property {number} credits 该小时消耗积分
 */

/**
 * 「模型」板块的一行 —— 只收当前生效倍率低于阈值的模型。
 *
 * 用量字段（requests / credits / cacheHitTokens / creditsPer1m）按**倍率归因**：
 * 来自 `credit_by_model` 中观测 rate 与本模型生效价相符的行，见 `lowRateModels`。
 * @typedef {object} LowRateModel
 * @property {string} id 模型全 id（带 realm 前缀）
 * @property {string} name 展示名
 * @property {number} multiplier 当前生效倍率（数值）
 * @property {number} listRate 牌价倍率；上游未写时为 `null`
 * @property {number|null} promoRate 促销倍率；无促销时为 `null`
 * @property {string|null} promoLabel 促销标签（如「限时免费」）
 * @property {number} requests 窗口内请求数
 * @property {number} credits 窗口内扣除积分
 * @property {number} cacheHitTokens 缓存命中 token
 * @property {number} cacheMissTokens 缓存未命中 token
 * @property {number|null} creditsPer1m 本路由的「积分 / 1M Token」；无 token 样本时为 `null`
 */

/**
 * 「账号」板块的一行。
 * @typedef {object} AccountCard
 * @property {string} uid
 * @property {string} nickname
 * @property {string} realm `cn` / `global`
 * @property {number} credits 剩余积分
 * @property {number} creditsTotal 总额度
 * @property {number} creditsExpiring 即将过期积分
 * @property {boolean} disabled 是否已禁用
 * @property {boolean} cooling 是否处于冷却
 * @property {number|null} coolingUntil 冷却截止毫秒；不在冷却为 `null`
 * @property {Array<{ model: string, kind: string, until: number|null, resetAt: number|null }>} limited 模型级限流行
 */

/**
 * 已添加模型的倍率比对行 —— 状态栏 pill 用来定位当前会话模型。
 * @typedef {object} ModelMatch
 * @property {string} id 模型 id
 * @property {number|null} multiplier 当前倍率数值；null 表示未在网关倍率表里找到
 * @property {string|null} raw 上游原始倍率字符串（可能是 `x1.25` 或 `1.25 credits`）
 * @property {boolean} known 是否成功解析出倍率
 * @property {boolean} used 近期是否有实际用量记录
 * @property {number} requests 近期请求数
 * @property {number} credits 近期消耗积分
 * @property {number} tokens 近期总 token
 */

/**
 * 用量快照 —— 浏览器半身拿到的完整答复。
 * @typedef {object} UsageSnapshot
 * @property {boolean} ok 是否成功取到数据
 * @property {string|null} error 失败原因（人类可读），成功时 null
 * @property {string|null} [generated] 网关生成时刻
 * @property {string|null} [since] 统计起点
 * @property {UsageStat|null} [totals] 全局汇总
 * @property {UsageStat[]} [accounts] 网关账户余额与状态
 * @property {LowRateModel[]} models 生效倍率低于阈值的模型
 * @property {AccountCard[]} accountCards 按 realm 排序的账户卡
 * @property {SeriesPoint[]} series 小时 Token 序列
 * @property {ModelMatch[]} matches 已添加模型的倍率比对（状态栏 pill 用）
 */
