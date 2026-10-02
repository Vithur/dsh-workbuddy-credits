/**
 * 快照读取 —— 一个 React Hook，两个视图共用。
 *
 * 三件事：轮询、去重、卸载时不泄漏。
 *
 * 轮询的意义要诚实说明：网关按小时聚合，不是按会话。所以这里的「本期」指网关
 * 统计窗口（通常当日）的整体消耗，面板会照实标注，不会假装算出了单会话的量。
 *
 * @module client/useSnapshot.js
 */

import { useEffect, useRef, useState } from 'react'
import { API_ROUTE } from '../shared/constants.js'

/**
 * 一次 POST 拿快照。失败时也返回结构完整的对象 —— UI 不需要到处判空。
 * @param {AbortSignal} signal
 * @returns {Promise<{ ok: boolean, snapshot?: object, error?: string }>}
 */
async function fetchSnapshot(signal) {
  try {
    const response = await fetch(API_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      signal,
    })
    if (!response.ok) {
      return { ok: false, error: `接口返回 HTTP ${response.status}` }
    }
    const payload = await response.json()
    if (payload?.ok === false) return { ok: false, error: payload.error ?? '未知错误' }
    return { ok: true, snapshot: payload?.snapshot ?? null }
  } catch (error) {
    if (error?.name === 'AbortError') return { ok: false, error: null, aborted: true }
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * @param {object} options
 * @param {number} options.pollMs 轮询间隔
 * @param {boolean} [options.enabled] false 时完全不发请求（视图未展示）
 * @returns {{ snapshot: object|null, error: string|null, loading: boolean, refresh: () => void, at: number|null }}
 */
export function useSnapshot({ pollMs, enabled = true }) {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [at, setAt] = useState(null)
  /** 自增令牌 —— 卸载/重取时让旧请求的结果作废，避免竞态覆盖新数据。 */
  const token = useRef(0)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const mine = ++token.current
    let timer

    const run = async (signal) => {
      setLoading(true)
      const result = await fetchSnapshot(signal)
      // 组件已卸载，或已有更新的请求发出：丢弃这次结果。
      if (token.current !== mine) return
      if (result.aborted) return
      if (result.ok) {
        setSnapshot(result.snapshot)
        setError(null)
        setAt(Date.now())
      } else {
        setError(result.error ?? '读取失败')
      }
      setLoading(false)
    }

    const controller = new AbortController()
    run(controller.signal)

    const interval = Number.isFinite(pollMs) && pollMs > 0 ? Math.max(1000, pollMs) : null
    if (interval !== null) {
      timer = setInterval(() => {
        const next = new AbortController()
        run(next.signal)
      }, interval)
    }

    return () => {
      // 让已经飞在路上的请求作废，再撤掉定时器。
      token.current++
      controller.abort()
      if (timer) clearInterval(timer)
    }
  }, [pollMs, enabled, nonce])

  const refresh = () => setNonce((n) => n + 1)

  return { snapshot, error, loading, refresh, at }
}
