/**
 * 插件入口（Host 半身）。
 *
 * 职责四件：
 * 1. 按配置建一个网关客户端；
 * 2. 注册一条受鉴权保护的路由，把用量快照喂给浏览器；
 * 3. 把自己的设置项挂进设置面板；
 * 4. 把网关声明的推理等级同步进 `llm-pi-ai` 配置 —— 这样模型菜单里
 *    才会**原生**出现官方那套 Off/Low/High/Max 档位。
 *
 * 关于 `inject` —— 这里刻意**不**声明任何硬依赖。原因与 `dsh-our-free-model`
 * 踩过的坑一致：Cordis 会把 `inject` 里缺席的服务所在 fiber 一直挂起，
 * 一个 headless 组合（没有 HTTP 服务）就会让整个插件永远不激活。所以
 * `connection`、`settings`、`configEditor`、`credentials` 都走**嵌套的注入 fiber**：
 * 缺席只是少一个功能，不会拖垮插件本体。
 * 反过来说，凡是依赖「比本插件更晚就绪的服务」的启动动作，都必须把那个服务**列进
 * 注入依赖**里等它 —— 见下方推理等级同步的 `credentials`。
 *
 * @module index.js
 */

import { Gateway, resolveApiKey } from './src/gateway.js'
import { buildSnapshot, configuredModels } from './src/snapshot.js'
import { syncReasoningEfforts } from './src/reasoning.js'
import { API_ROUTE } from './shared/constants.js'

export const name = 'workbuddy-credits'

/** 插件不硬依赖任何服务 —— 详见文件头。缺失时降级，而不是挂起。 */
export const inject = []

/**
 * 配置字段表：键 → 默认值。
 *
 * ## 这里**刻意不导出 `Config`** —— 这是踩过坑的结论
 *
 * Cordis 在加载每个插件时会跑 `resolveConfig(runtime, config)`：
 *
 * ```js
 * if (!runtime.Config) return config            // ← 不导出就原样放行
 * const result = runtime.Config['~standard'].validate(config)
 * ```
 *
 * 也就是说 `Config` 必须是 **Standard Schema**。但 Standard Schema 只是入场券：
 * `@deepseek-ai/dsh-settings` 之后还会把这个 schema 投影成设置表单，它会调
 * `schema.toJSON()`、读 `schema.meta` / `schema.uid` —— 那些是 **schemastery**
 * 的元数据。自实现的 Standard Schema 没有它们，于是：
 *
 * 1. 传普通对象 → `_resolveConfig` 读 `undefined.validate` → 条目激活失败；
 * 2. 传自实现的 Standard Schema → Cordis 过了，但设置服务 `schema.toJSON()` 抛错。
 *    而 `describe()` 有 `fiber.state !== 2` 的门禁，**只有激活成功的条目才会被投影**，
 *    所以这个雷恰好要等到"修好激活问题、重启之后"才炸 —— 表现为 DSH 直接打不开。
 *
 * 结论：**不导出 `Config`**。已装的 6 个第三方插件（dsh-context / dsh-status-rotator /
 * dsh-mnemon / dsh-free-search / dsh-our-free-model / dsh-mcp-studio）没有一个导出它。
 * 配置走 profile 的 `cordis.patch.yml`，插件自己填默认值。
 */
const CONFIG_DEFAULTS = {
  /** 网关地址。 */
  baseUrl: 'http://192.168.1.42:7863',
  /** 凭据 ref（环境变量名）。 */
  apiKeyRef: 'WORKBUDDY_API_KEY',
  /** 只在凭据读不到时使用的回落；留空则完全依赖凭据服务。 */
  apiKey: '',
  /** 要统计的 provider id；留空表示配置里的全部 provider。 */
  providers: [],
  /** 各维度表格最多显示多少行。 */
  rowLimit: 10,
  /** 推理等级要同步到哪个 provider 的模型配置。 */
  reasoningProvider: 'workbuddy',
  /**
   * 是否在加载时按网关把 `reasoningEfforts` 写进 `llm-pi-ai` 配置。
   *
   * **默认关**。这是本插件唯一会改动用户配置的行为，而改配置的风险面很大：
   * 一旦写坏，下一次启动就可能起不来。功能本身是幂等且窄范围的，但要开就由
   * 用户明确开 —— 在 patch 里加一行 `syncReasoning: true` 即可。
   */
  syncReasoning: false,
}

/** 默认配置。 */
export function defaultConfig() {
  return { ...CONFIG_DEFAULTS }
}

/**
 * 装配 snapshot 所需的全部运行期依赖。
 *
 * 密钥在**每请求**时重新解析，而不是启动时缓存 —— 用户随时可能在凭据面板里
 * 换掉 `WORKBUDDY_API_KEY`，缓存会让它一直用到进程重启才生效。
 *
 * @param {import('./src/gateway.js').Gateway} gateway
 * @param {object} ctx
 * @param {object} config
 */
async function snapshotOnce(ctx, config, gateway) {
  const credentials = ctx.get('credentials')
  const key = await resolveApiKey(credentials, config.apiKeyRef, config.apiKey)
  if (!key) {
    return { ok: false, error: '未找到网关 API Key', matches: [], models: [], accounts: [], creditModels: [], creditAccounts: [], series: [] }
  }
  const active = gatewayFor(key.key, config.baseUrl, gateway)
  const llmPiAi = readPiAiConfig(ctx)
  const models = configuredModels(llmPiAi, config.providers)
  return await buildSnapshot(ctx, active, { models, rowLimit: config.rowLimit })
}

/**
 * 按当前密钥建一个网关实例。
 *
 * 每次都新建，看起来浪费，其实是有意的：`gatewayFor` 的调用方每请求重新解析
 * 密钥（用户随时可能轮换），而 Gateway 的短缓存跟着实例走 —— 复用一个实例会让
 * 换过的密钥继续用旧的。新建的成本只是一次 map 分配，远低于一次网关往返。
 *
 * @param {string} apiKey
 * @param {string} baseUrl
 * @param {import('./src/gateway.js').Gateway} existing 未使用，保留以说明取舍
 */
function gatewayFor(apiKey, baseUrl, existing) {
  return new Gateway(baseUrl, apiKey)
}

/**
 * 把默认值摊平到实际配置上。
 *
 * 插件不导出 `Config`，所以宿主**不会**替我们填默认值 —— 默认值完全由这里负责。
 * 也不能写成 `{ ...CONFIG_DEFAULTS, ...config }` 之外的任何花活：`config` 是
 * 用户在 patch 里手写的东西，只给一部分键是常态。
 *
 * 类型不强制：配置是宿主与用户的事，插件只该降级（用默认值兜底），不该在启动
 * 路径上抛异常 —— 插件启动失败会把整个 DSH 拖下水。
 */
function resolveConfig(config) {
  const input = config && typeof config === 'object' ? config : {}
  return { ...CONFIG_DEFAULTS, ...input }
}

/**
 * 读 `llm-pi-ai` 的配置，以拿到「已添加的模型清单」。
 *
 * 两条路，优先 configEditor：它给出 profile 里真正生效的那份配置
 * （`inherited` 与 `override` 合并）。`llm-pi-ai` 不一定把配置挂成同名服务，
 * 只靠 `ctx.get` 会读到 undefined，模型清单就会莫名其妙变成空的。
 */
function readPiAiConfig(ctx) {
  try {
    const editor = ctx.get('configEditor')
    if (editor && typeof editor.configuration === 'function') {
      const rows = editor.configuration()
      const row = Array.isArray(rows) ? rows.find((item) => {
        const id = item?.entry?.options?.id ?? item?.entry?.id ?? ''
        const name = item?.entry?.options?.name ?? item?.entry?.name ?? ''
        return id === 'llm-pi-ai' || String(name).includes('dsh-llm-pi-ai')
      }) : undefined
      if (row) {
        const merged = { ...(row.inherited ?? {}), ...(row.override ?? {}) }
        if (merged && typeof merged === 'object') return merged
      }
    }
  } catch {
    // 落到下面的服务读取
  }
  try {
    const service = ctx.get('llm-pi-ai', false) ?? ctx.get('llmPiAi', false)
    const config = service?.config
    return config && typeof config === 'object' ? config : null
  } catch {
    return null
  }
}

/**
 * 挂那条唯一的路由。
 *
 * 落在 `/api` 围栏内，所以浏览器凭平台会话凭据访问，
 * 而网关密钥从未离开 Host —— 这是本插件唯一的密钥边界。
 */
function serveRoute(ctx, config, gateway) {
  ctx.inject(['connection'], (c) => {
    const connection = c.get('connection')
    const register = typeof connection?.fetch?.register === 'function'
      ? connection.fetch.register.bind(connection.fetch)
      : undefined
    if (register === undefined) return
    const handler = async (request) => {
      try {
        // 请求体解析必须容错：缺 body、非 JSON、空 body 都退化成空对象，
        // 绝不能因为读 body 失败而让整个面板 500。
        let body = {}
        try {
          const raw = await request?.json?.()
          if (raw && typeof raw === 'object') body = raw
        } catch {
          body = {}
        }

        if (body.action === 'syncReasoning') {
          const result = await syncReasoning(ctx, config, gateway)
          return Response.json({ ok: result.ok, result }, { headers: { 'cache-control': 'no-store' } })
        }

        const snapshot = await snapshotOnce(ctx, config, gateway)
        return Response.json({ ok: true, snapshot }, { headers: { 'cache-control': 'no-store' } })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return Response.json(
          { ok: false, error: `读取网关失败：${message}` },
          { headers: { 'cache-control': 'no-store' } },
        )
      }
    }
    try {
      c.effect(() => register({
        path: API_ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: handler,
      }), 'workbuddy-credits: usage route')
    } catch {
      // 注册失败就安静退化：没有面板，其他功能不受影响。
    }
  })
}

/**
 * 配置表单由宿主自动生成 —— **不需要**插件做任何事。
 *
 * `settings` 服务（"Project Config schemas into forms"）会读本插件导出的 `Config`
 * 并投影成设置表单，所以早先那个 `settings.register(...)` 调用是死代码：
 * 那个服务根本没有 `register` 方法。删掉它，别留着误导后来的人。
 */

/**
 * 按网关能力同步一次推理等级。
 *
 * 这是让模型菜单出现网关所声明档位的**唯一**路径：菜单读的是适配器声明的能力，
 * 而适配器的能力来自 `llm-pi-ai` 配置里的 `reasoningEfforts`。插件不自己画选择器，
 * 只把配置补对。
 *
 * ## 契约：这个 promise **永不 reject**
 *
 * 它是被 `void syncReasoning(...)` 这样「发射后不管」地调用的。一旦 reject 而没人
 * 接住，Node 会把未处理的 rejection 升级成进程级异常 —— 那是能拖垮宿主的东西。
 * 所以整个函数体都包在 try/catch 里，失败一律变成 `{ ok: false, reason }`。
 * preflight 里专门装了 `unhandledRejection` 监听来守这条。
 */
async function syncReasoning(ctx, config, gateway) {
  try {
    const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
    const key = await resolveApiKey(credentials, config.apiKeyRef, config.apiKey)
    if (!key) return { ok: false, reason: '未找到网关 API Key' }

    const active = gatewayFor(key.key, config.baseUrl, gateway)
    const models = configuredModels(readPiAiConfig(ctx), config.providers)
    if (models.length === 0) return { ok: false, reason: '没有读到已添加的模型清单' }

    return await syncReasoningEfforts(ctx, active, {
      providerId: config.reasoningProvider,
      models,
      log: (message) => ctx.logger?.info?.(message),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: `推理等级同步失败：${message}` }
  }
}

/**
 * 插件主体。
 *
 * ## 契约：`apply` **永不抛异常**
 *
 * 宿主对「条目激活失败」是降级处理（记一条 warning，其余照常），但这里仍然把
 * 每一步单独兜住，理由是：插件的任何失败都不该有机会变成宿主的启动失败。
 * 之前那版就是在这里失守的 —— 导出的 `Config` 形状不对，异常发生在宿主的
 * 配置解析路径上，直接把 DSH 拖到起不来。
 *
 * `scripts/preflight.mjs` 里有一组「恶意 ctx」断言专门守这条契约：缺服务、
 * 服务为 null、服务方法抛异常，`apply` 都必须正常返回。
 */
export function apply(ctx, config) {
  const merged = resolveConfig(config)
  const gateway = new Gateway(merged.baseUrl, '')

  /** 跑一步，失败只记一笔 —— 连 logger 都坏了也不许把异常放出去。 */
  const safely = (label, operation) => {
    try {
      operation()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      try {
        ctx.logger?.warn?.(`workbuddy-credits: ${label} 未挂载 —— ${message}`)
      } catch {
        // 日志通道本身不可用，那就安静跳过：插件已经降级到「什么都不做」。
      }
    }
  }

  safely('用量路由', () => serveRoute(ctx, merged, gateway))

  // 推理等级同步会改用户配置，所以默认关；只有显式 syncReasoning: true 才挂。
  safely('推理等级同步', () => {
    if (merged.syncReasoning !== true) return
    // `credentials` 必须和 `configEditor` 一起声明：它是**后到**的服务 —— 实测插件
    // 激活那一刻 `ctx.get('credentials')` 还是 undefined，约两秒后才就绪。只声明
    // configEditor 的话，同步会在激活时跑一次、拿不到密钥、静默失败，于是表现为
    // 「网关模型没有原生推理等级菜单」，而且日志里的 warn 没人看得见。
    ctx.inject(['configEditor', 'credentials'], (c) => {
      c.effect(() => {
        // 异步做，不阻塞插件激活。`syncReasoning` 本身承诺不 reject，这里再接一道
        // `.catch` 是兜底：未处理的 rejection 会被 Node 升级成进程级异常，
        // 那正是「插件把宿主搞崩」最典型的形态。
        void syncReasoning(ctx, merged, gateway)
          .then((result) => {
            if (result.ok === false && result.reason) {
              ctx.logger?.warn?.(`workbuddy-credits: 推理等级未同步 —— ${result.reason}`)
            }
          })
          .catch((error) => {
            try {
              const message = error instanceof Error ? error.message : String(error)
              ctx.logger?.warn?.(`workbuddy-credits: 推理等级同步异常 —— ${message}`)
            } catch {
              // 日志通道也坏了，那就彻底安静。
            }
          })
        return () => {}
      }, 'workbuddy-credits: reasoning sync')
    })
  })

  safely('卸载清理', () => {
    ctx.effect(() => () => {
      try {
        gateway.invalidate()
      } catch {
        // 卸载时清理缓存失败不需要打扰用户。
      }
    }, 'workbuddy-credits: dispose')
  })

  safely('启动日志', () => {
    ctx.logger?.info?.(`workbuddy-credits: 已启用，网关 ${merged.baseUrl}`)
  })
}
