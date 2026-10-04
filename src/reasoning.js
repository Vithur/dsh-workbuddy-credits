/**
 * 推理等级同步 —— 把网关声明的档位写进 `llm-pi-ai` 的模型配置。
 *
 * ## 为什么必须写配置，而不是自己画一个选择器
 *
 * DSH 的模型菜单**原生**就会渲染推理等级：模型选择器读模型目录的
 * `reasoning.efforts`，而那份元数据来自适配器的 `resolveModel()`。
 * `dsh-llm-pi-ai` 的规则是：
 *
 * - `reasoningEfforts: false`  → 声明为不支持推理；
 * - `reasoningEfforts` 缺席    → 沿用内置目录的能力；
 * - `reasoningEfforts: { … }`  → 每个键是一个档位，值是**发给上游的线上拼写**，
 *   未声明的档位被钉成 `null`（不支持）。
 *
 * 档位显示名由适配器按 id 首字母大写生成，所以 `low`/`high`/`max` 在菜单里
 * 就是官方的 `Low`/`High`/`Max` —— 不需要插件自己起中文名。
 *
 * 当前配置里写的是 `reasoning: true`，这个字段不产生任何档位，这正是
 * 「网关加进来的模型都不能改推理等级」的根因。
 *
 * ## 边界
 *
 * - 只碰 `providers.<id>.models[].reasoningEfforts`，其他字段一律原样带过。
 * - 只声明网关真的列出的档位：不给网关没提供的档位（例如 `off`）—— 对这个
 *   网关来说 `off` 是「不发 reasoning_effort」，等于模型默认档，放上去就是一个
 *   说了不算的控件。
 * - 幂等：算出来的结果与现状一致时**不写**，避免每次加载都改配置文件。
 *
 * @module src/reasoning.js
 */

/**
 * pi-ai 认得的全部档位，按升级顺序。
 * 只有落在这个集合里的档位才会被写进配置 —— 写了别的会被配置校验拒绝。
 */
export const PI_AI_THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

/**
 * 把网关的「模型与档位」信息翻成 `reasoningEfforts` 字典。
 *
 * 档位**完全以网关为准**，不给任何保底档：
 *
 * - `supported_efforts` 里的每个档位照抄；
 * - 网关把 `can_disable_thinking` 标为真时，`off` 也是一个真实档位
 *   （网关页面把它显示成「off (可关)」）；
 * - `supported_efforts` 为空或缺失时表示「固定档」（网关页面写「固定档 · 默认 x」），
 *   这时不写 `reasoningEfforts`，菜单里就不该出现档位选择器。
 *
 * 所以只有一档的模型菜单里就只有一个，两档就两个 —— 与网关页面完全一致。
 *
 * 值是**线上拼写**。`off` 特意写成字符串 `'off'` 而不是 `null`：pi-ai 的约定是
 * `off` 配 `null` 表示「整段省略 reasoning 参数」，对这个网关就等于用它自己的
 * 默认档（`default_effort: high`）—— 那 `Off` 就成了一个说了不算的控件。
 * 写成 `'off'` 才会把 `reasoning_effort: "off"` 真发出去。
 *
 * @param {string[]|null|undefined} supported 网关声明的档位
 * @param {boolean} [canDisableThinking] 网关是否标注该模型「思考可关」
 * @returns {Record<string, string>|null} 字典；无可用档位时返回 null
 */
export function desiredEfforts(supported, canDisableThinking) {
  const dict = {}
  for (const level of Array.isArray(supported) ? supported : []) {
    if (typeof level !== 'string' || !level) continue
    if (!PI_AI_THINKING_LEVELS.includes(level)) continue
    dict[level] = level
  }
  if (canDisableThinking === true) dict.off = 'off'

  // 只有 off 等于「这个模型没有可选的思考档位」，按 pi-ai 的约定整段省略。
  const beyondOff = Object.keys(dict).filter((level) => level !== 'off')
  return beyondOff.length > 0 ? dict : null
}

/** 两个档位字典是否等价（键与值都相同，忽略键顺序）。 */
export function sameEfforts(left, right) {
  if (left === right) return true
  if (!left || !right) return false
  const a = Object.keys(left)
  const b = Object.keys(right)
  if (a.length !== b.length) return false
  return a.every((key) => left[key] === right[key])
}

/**
 * 纯函数：算出「写完之后」的配置，以及改了哪些模型。
 *
 * 与编辑器解耦，所以可以离线测 —— 真正落盘的那一步只做一次 `editor.edit()`。
 *
 * @param {object} current `llm-pi-ai` 的当前配置
 * @param {string} providerId 要同步的 provider（如 `workbuddy`）
 * @param {Map<string, Record<string, string>|null>} effortByModel 模型 id → 目标档位字典
 * @returns {{ config: object, changes: Array<{ model: string, from: unknown, to: Record<string,string> }> }}
 */
export function planReasoningSync(current, providerId, effortByModel) {
  const base = current && typeof current === 'object' ? current : {}
  const providers = { ...(base.providers ?? {}) }
  const provider = { ...(providers[providerId] ?? {}) }
  const models = Array.isArray(provider.models) ? provider.models : []
  const changes = []

  const nextModels = models.map((model) => {
    const desired = effortByModel.get(model?.id)
    if (!desired) return model
    if (sameEfforts(model.reasoningEfforts, desired)) return model
    changes.push({ model: model.id, from: model.reasoningEfforts ?? null, to: desired })
    return { ...model, reasoningEfforts: desired }
  })

  if (changes.length === 0) return { config: base, changes: [] }

  provider.models = nextModels
  providers[providerId] = provider
  return { config: { ...base, providers }, changes }
}

/** 从编辑器条目里认领 `llm-pi-ai` 那一行。 */
function isLlmPiAiEntry(entry) {
  const id = entry?.options?.id ?? entry?.id ?? ''
  const name = entry?.options?.name ?? entry?.name ?? ''
  return id === 'llm-pi-ai' || String(name).includes('dsh-llm-pi-ai')
}

/**
 * 按网关能力同步一次推理等级。
 *
 * 全程 fail-open：拿不到编辑器、找不到条目、上游不可达，都只回报原因，
 * 不抛异常、不动配置。
 *
 * @param {object} ctx Cordis context
 * @param {import('./gateway.js').Gateway} gateway
 * @param {object} options
 * @param {string} options.providerId 要同步的 provider id
 * @param {string[]} options.models 已添加模型 id
 * @param {(message: string) => void} [options.log]
 * @returns {Promise<{ ok: boolean, reason?: string, changes?: object[] }>}
 */
export async function syncReasoningEfforts(ctx, gateway, options) {
  const { providerId, models, log } = options
  const editor = ctx.get('configEditor')
  if (!editor || typeof editor.edit !== 'function') {
    return { ok: false, reason: '该组合没有 configEditor，无法写配置' }
  }

  const entries = typeof editor.entries === 'function' ? editor.entries() : []
  const entry = entries.find(isLlmPiAiEntry)
  if (!entry) return { ok: false, reason: '没有找到 llm-pi-ai 配置条目' }

  const listing = await gateway.models()
  if (!listing) return { ok: false, reason: '网关不可达，保留现有档位配置' }

  const supported = new Map()
  // gateway.models() 在出口统一成面板形状 `{ models: [...] }`，`/v1/models` 的
  // `{ data: [...] }` 只是回退兼容 —— 这里两个键都要认，只读 data 会让面板
  // 路径下 supported 永远为空，同步静默失败（实测发生过）。
  for (const model of listing.models ?? listing.data ?? []) {
    if (!model || typeof model.id !== 'string') continue
    supported.set(model.id, {
      efforts: model.supported_efforts,
      canDisableThinking: model.can_disable_thinking === true,
    })
  }

  const effortByModel = new Map()
  for (const id of models) {
    // 只为网关**认得**的模型声明档位：清单里没有的 id 说明网关不提供它，
    // 给它写档位等于凭空承诺。
    const info = supported.get(id)
    if (!info) continue
    const dict = desiredEfforts(info.efforts, info.canDisableThinking)
    if (dict) effortByModel.set(id, dict)
  }
  if (effortByModel.size === 0) return { ok: false, reason: '网关没有为任何已添加模型提供可选档位' }

  // 先按「当前生效的配置」算一遍：没有变更就**不写盘**。
  // 每次加载都改一次配置文件是不可接受的副作用。
  const rows = typeof editor.configuration === 'function' ? editor.configuration() : []
  const row = Array.isArray(rows) ? rows.find((item) => {
    const id = item?.entry?.options?.id ?? item?.entry?.id ?? ''
    const name = item?.entry?.options?.name ?? item?.entry?.name ?? ''
    return id === 'llm-pi-ai' || String(name).includes('dsh-llm-pi-ai')
  }) : undefined
  const current = row ? { ...(row.inherited ?? {}), ...(row.override ?? {}) } : {}
  const planned = planReasoningSync(current, providerId, effortByModel)
  if (planned.changes.length === 0) return { ok: true, changes: [], reason: '已是最新' }

  let result = { ok: true, changes: [] }
  await editor.edit(entry, (live) => {
    // 编辑回调拿到的是权威现状（编辑器会先和解外部改动），所以以它为准重算一次，
    // 避免「检查」与「写入」之间被别的写入插队。
    const authoritative = live && typeof live === 'object' && Object.keys(live).length > 0 ? live : current
    const fresh = planReasoningSync(authoritative, providerId, effortByModel)
    result = { ok: true, changes: fresh.changes }
    return fresh.config
  })

  if (result.changes.length === 0) return { ok: true, changes: [], reason: '已是最新' }
  log?.(`workbuddy-credits: 已同步 ${result.changes.length} 个模型的推理等级`)
  return result
}
