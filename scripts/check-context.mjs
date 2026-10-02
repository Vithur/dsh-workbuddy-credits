/**
 * 上下文长度核对 —— DSH 已添加模型 vs 网关「模型与档位」页。
 *
 * 网关页面显示的 `1000K / 131K` 是 `context_length` 与 `max_output_tokens`；
 * 它按 1000 进制显示（393216 → `393K`），所以这里也用同一把尺子，
 * 避免把「看起来差 9K」误判成配置错误。
 *
 * 跑法：`node scripts/check-context.mjs`
 */

import { Gateway } from '../src/gateway.js'
import { readDshModels } from './read-dsh-config.mjs'

const BASE_URL = process.env.WB_BASE_URL ?? 'http://192.168.1.42:7863'
const API_KEY = process.env.WORKBUDDY_API_KEY ?? ''
const PROVIDER = process.env.WB_PROVIDER ?? 'workbuddy'

if (!API_KEY) {
  console.error('缺少环境变量 WORKBUDDY_API_KEY')
  process.exit(1)
}

/**
 * 读 profile 里 llm-pi-ai 的配置，拿到 DSH 侧声明的上下文与最大输出。
 * 解析交给共用的读取器 —— 手写缩进匹配会把 patch 里的其他 `- id:` 条目当成模型。
 */
async function readDshModelsForProvider() {
  return await readDshModels(PROVIDER)
}

/** 网关按 1000 进制显示的 K 值。 */
const k = (n) => (Number.isFinite(n) && n > 0 ? `${Math.round(n / 1000)}K` : '—')

const gateway = new Gateway(BASE_URL, API_KEY)
const listing = await gateway.models()
if (!listing) {
  console.error('网关不可达')
  process.exit(1)
}

const gatewayById = new Map((listing.data ?? []).map((m) => [m.id, m]))
const dshModels = await readDshModelsForProvider()

if (!dshModels) {
  console.error('没能从 cordis.patch.yml 读出模型清单')
  process.exit(1)
}

console.log(`provider: ${PROVIDER}\n`)
const pad = (text, width) => String(text).padEnd(width)
console.log(
  pad('模型', 30) + pad('DSH 上下文', 18) + pad('网关上下文', 18)
  + pad('DSH 最大输出', 18) + pad('网关最大输出', 18) + '结果',
)

let mismatched = 0
for (const model of dshModels) {
  const gatewayModel = gatewayById.get(model.id)
  if (!gatewayModel) {
    console.log(pad(model.id, 30) + pad('—', 18) + pad('—', 18) + pad('—', 18) + pad('—', 18) + '网关清单里没有这个模型')
    mismatched++
    continue
  }
  const dshCtx = model.contextWindow
  const gwCtx = gatewayModel.context_length ?? gatewayModel.max_allowed_size
  const dshOut = model.maxTokens
  const gwOut = gatewayModel.max_output_tokens

  const ctxOk = dshCtx === gwCtx
  const outOk = dshOut === gwOut
  const verdict = ctxOk && outOk
    ? '一致'
    : [
        ctxOk ? null : `上下文差 ${gwCtx - dshCtx}`,
        outOk ? null : `最大输出差 ${gwOut - dshOut}`,
      ].filter(Boolean).join(' · ')
  if (!(ctxOk && outOk)) mismatched++

  console.log(
    pad(model.id, 30)
    + pad(`${k(dshCtx)} (${dshCtx})`, 18)
    + pad(`${k(gwCtx)} (${gwCtx})`, 18)
    + pad(`${k(dshOut)} (${dshOut})`, 18)
    + pad(`${k(gwOut)} (${gwOut})`, 18)
    + verdict,
  )
}

console.log(`\n共 ${dshModels.length} 个已添加模型，${mismatched} 个不一致`)
process.exitCode = mismatched === 0 ? 0 : 1
