/**
 * 打印网关每个模型的推理档位声明，用于判定「Default 从哪来」。
 *
 * 只打印档位字段，不打印密钥与账户信息。
 *
 * 跑法：`node scripts/probe-defaults.mjs`
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Gateway } from '../src/gateway.js'

const BASE_URL = process.env.WB_BASE_URL ?? 'http://192.168.1.42:7863'
const REF = process.env.WB_KEY_REF ?? 'WORKBUDDY_API_KEY'

function readKey() {
  if (process.env[REF]) return process.env[REF]
  const file = join(homedir(), '.dsh', '.credentials.yaml')
  const match = readFileSync(file, 'utf8').match(new RegExp(`^\\s*${REF}:\\s*(.+)$`, 'm'))
  if (!match) throw new Error(`凭据里找不到 ${REF}`)
  return match[1].trim().replace(/^["']|["']$/g, '')
}

const gateway = new Gateway(BASE_URL, readKey())
const models = await gateway.models()

for (const model of models?.data ?? []) {
  console.log(
    `${String(model.id).padEnd(28)} supported=${JSON.stringify(model.supported_efforts ?? model.supportedEfforts ?? null)} ` +
      `default=${JSON.stringify(model.default_effort ?? model.defaultEffort ?? null)} ` +
      `can_disable=${JSON.stringify(model.can_disable_thinking ?? model.canDisableThinking ?? null)}`,
  )
}
