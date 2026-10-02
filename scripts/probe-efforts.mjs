/**
 * 探测网关真正接受的推理档位。
 *
 * 网关 `/v1/models` 声明的 `supported_efforts` 是它自己的说法；这里直接发最小
 * 请求，看它对每个档位是接受还是拒绝 —— 只有实测过才敢决定菜单里放哪几档。
 *
 * 用 `global:deepseek-v4.1-flash`（网关标价 x0.00，免费）避免产生费用。
 *
 * 跑法：`node scripts/probe-efforts.mjs`
 */

const BASE_URL = process.env.WB_BASE_URL ?? 'http://192.168.1.42:7863'
const API_KEY = process.env.WORKBUDDY_API_KEY ?? ''
const MODEL = process.env.WB_PROBE_MODEL ?? 'global:deepseek-v4.1-flash'

if (!API_KEY) {
  console.error('缺少环境变量 WORKBUDDY_API_KEY')
  process.exit(1)
}

const LEVELS = ['off', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

async function probe(effort) {
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 16,
    stream: false,
    ...effort === null ? {} : { reasoning_effort: effort },
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    let detail = ''
    try {
      const parsed = JSON.parse(text)
      detail = parsed?.error?.message ?? parsed?.choices?.[0]?.finish_reason ?? ''
      const usage = parsed?.usage
      if (usage) detail += ` [out=${usage.completion_tokens ?? '?'}]`
    } catch {
      detail = text.slice(0, 120)
    }
    return { status: response.status, ok: response.ok, detail: String(detail).slice(0, 160) }
  } catch (error) {
    return { status: null, ok: false, detail: error?.name === 'AbortError' ? '超时' : String(error?.message ?? error) }
  } finally {
    clearTimeout(timer)
  }
}

console.log(`模型 ${MODEL}（免费）\n`)

const baseline = await probe(null)
console.log(`不传 reasoning_effort  → HTTP ${baseline.status}  ${baseline.detail}`)
console.log('')

for (const level of LEVELS) {
  const result = await probe(level)
  const verdict = result.ok ? '接受' : '拒绝'
  console.log(`reasoning_effort=${level.padEnd(8)} → ${verdict}  HTTP ${result.status}  ${result.detail}`)
}
