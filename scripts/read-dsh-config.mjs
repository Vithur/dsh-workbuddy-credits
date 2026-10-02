/**
 * 读取 DSH profile 里 `llm-pi-ai` 的真实模型配置。
 *
 * 用 profile 自带的 `yaml` 包解析 `cordis.patch.yml`，而不是手写缩进匹配 ——
 * patch 文件里有几十个顶层 `- id:` 条目，朴素解析会把它们当成模型读进来。
 *
 * 之所以所有检查脚本都走这里：写死的模型清单一定会和用户的实际配置脱节
 * （用户随时会增删模型），读到的东西必须来自真配置。
 *
 * @module scripts/read-dsh-config.mjs
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** 默认 profile 目录。 */
export function profileDir() {
  return process.env.DSH_PROFILE_DIR ?? path.join(os.homedir(), '.dsh', 'profiles', 'desktop')
}

/**
 * 读出 `llm-pi-ai` 里某个 provider 的模型清单。
 * @param {string} providerId
 * @returns {Promise<Array<object>|null>} 模型数组；读不到返回 null
 */
export async function readDshModels(providerId) {
  const dir = profileDir()
  const patch = path.join(dir, 'cordis.patch.yml')
  if (!fs.existsSync(patch)) return null

  let parse
  try {
    const yamlUrl = pathToFileURL(path.join(dir, 'node_modules', 'yaml', 'dist', 'index.js')).href
    parse = (await import(yamlUrl)).parse
  } catch {
    return null
  }

  const doc = parse(fs.readFileSync(patch, 'utf8'))
  if (!Array.isArray(doc)) return null

  const entry = doc.find((row) => row?.id === 'llm-pi-ai')
  const provider = entry?.config?.providers?.[providerId]
  const models = Array.isArray(provider?.models) ? provider.models : []
  return models.length > 0 ? models : null
}
