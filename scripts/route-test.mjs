/**
 * Host 路由真测 —— 不联网，用 stub `fetch` 假装网关，验证真实的路由处理器。
 *
 * 为什么值得单独一层：`smoke` 只证明产物形状，`mount-test` 只覆盖浏览器半身。
 * Host 的这条路由是本插件唯一对外接口，两条分支（取快照 / 同步推理等级）
 * 与密钥边界都在这里，必须真跑一遍。
 *
 * 跑法：`node scripts/route-test.mjs`
 */

import assert from 'node:assert/strict'

let passed = 0
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++
      console.log(`  ok  ${name}`)
    })
    .catch((error) => {
      console.error(`  FAIL ${name}\n       ${error.message}`)
      process.exitCode = 1
    })
}

// —— 假网关：只回答本插件会问的那三个路由 ——
const GATEWAY = {
  models: {
    models: [
      { id: 'cn:hy4-preview', name: 'Hy4', credits: 'x0.29', supported_efforts: ['high'], default_effort: 'high', context_length: 1000000, max_output_tokens: 64000, supports_reasoning: true },
      { id: 'cn:glm-5.3-flash', name: 'GLM', credits: 'x0.06', supported_efforts: ['low', 'high', 'max'], default_effort: 'high', can_disable_thinking: true, context_length: 1000000, max_output_tokens: 131072, supports_reasoning: true },
      { id: 'cn:hy4-preview-f', name: 'Hy4f', credits: '', supported_efforts: [], context_length: 1000000 },
    ],
  },
  usage: {
    generated: '2026-10-02T08:00:00+08:00',
    since: '2026-10-02T05',
    totals: {
      requests: 10,
      errors: 1,
      total_tokens: 1234,
      credits: 5.61,
      cache_hit_rate: 95.2,
      credit_tokens: 1308602,
      credit_samples: 44,
      credits_per_1m_tokens: 4.287,
      cache_hit_tokens: 1204096,
      cache_miss_tokens: 87716,
    },
    by_model: [{ key: 'hy4-preview', requests: 10, total_tokens: 1234, credits: 5.61 }],
    credit_by_model: [
      { key: 'glm-5.3-flash', rate: '0.06', requests: 44, credits: 5.61, credit_tokens: 1308602, credit_samples: 44, credits_per_1m_tokens: 4.287, cache_hit_tokens: 1204096, cache_miss_tokens: 87716 },
      { key: 'hy4-preview', rate: '0', requests: 130, credits: 0, credit_tokens: 8299057, credit_samples: 130, credits_per_1m_tokens: 0, cache_hit_tokens: 5445568, cache_miss_tokens: 2803898 },
    ],
    by_account: [],
    credit_by_account: [
      { key: 'u-1', realm: 'cn', nickname: 'Vithur', requests: 133, credits: 4.83, credit_tokens: 2735968, credit_samples: 53, credits_per_1m_tokens: 1.765, cache_hit_tokens: 1159040, cache_miss_tokens: 1555839 },
    ],
    series: [{ t: '2026-10-02T05', requests: 10, total_tokens: 1234, credits: 5.61 }],
  },
  overview: {
    accounts: [
      {
        uid: 'u-1',
        nickname: 'Vithur',
        realm: 'cn',
        credits: 2983,
        credits_total: 4726,
        credits_expiring: 0,
        credits_earliest_expiry: '2026-10-31T23:59:59+08:00',
        disabled: false,
        cooling: false,
        success_count: 133,
        last_success: '2026-10-02T08:05:54+08:00',
        token_usage: { request_count: 133, usage_count: 130, prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, last_model: 'hy4-preview' },
        model_costs: [{ model: 'hy4-preview', cost_per_1k: 0.11, samples: 17 }],
      },
    ],
  },
}

let requestedUrls = []
globalThis.fetch = async (url) => {
  requestedUrls.push(String(url))
  const body = url.includes('/panel/api/models')
    ? GATEWAY.models
    : url.includes('/panel/api/usage')
      ? GATEWAY.usage
      : url.includes('/panel/api/overview')
        ? GATEWAY.overview
        : null
  if (body === null) return { ok: false, status: 404, json: async () => ({}) }
  return { ok: true, status: 200, json: async () => body }
}

// —— 假 ctx：捕获路由处理器、设置注册，并提供可写的 configEditor ——
let capturedHandler = null
let settingsRegistrations = []
let edits = []
const llmPiAiConfig = {
  providers: {
    workbuddy: {
      displayName: 'workbuddy',
      baseURL: 'http://192.168.1.42:7863/v1',
      models: [
        { id: 'cn:hy4-preview', name: 'Hy4', contextWindow: 1000000 },
        { id: 'cn:glm-5.3-flash', name: 'GLM', contextWindow: 1000000 },
        { id: 'cn:hy4-preview-f', name: 'Hy4f', contextWindow: 1000000 },
        { id: 'cn:not-in-gateway', name: 'Ghost', contextWindow: 1000 },
      ],
    },
  },
}

/** 宿主在这份假 ctx 里“装有”的服务；`missing` 用来模拟服务尚未就绪。 */
const PROVIDED = ['connection', 'settings', 'configEditor', 'credentials', 'llm-pi-ai']

function makeCtx({ missing = [] } = {}) {
  const provided = PROVIDED.filter((name) => !missing.includes(name))
  return {
    logger: { info: () => {}, warn: () => {}, debug: () => {} },
    on: () => () => {},
    effect: (fn) => {
      const disposer = fn()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    get: (name) => {
      if (!provided.includes(name)) return undefined
      if (name === 'credentials') return { resolve: async () => ({ value: 'wb2a_fake' }) }
      if (name === 'llm-pi-ai') return { config: llmPiAiConfig }
      if (name === 'configEditor') {
        return {
          entries: () => [{ options: { id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai' } }],
          configuration: () => [{ entry: { options: { id: 'llm-pi-ai' } }, inherited: llmPiAiConfig, override: {} }],
          edit: async (entry, change) => {
            edits.push({ entry, config: change(llmPiAiConfig, {}) })
          },
        }
      }
      return undefined
    },
    inject: (deps, body) => {
      // 注入出来的子上下文必须和真实 Cordis 一样带 `effect`：路由注册体是
      // 包在 `c.effect(() => register(...))` 里的，缺了它注册会被静默吞掉。
      const injected = {
        effect: (fn) => {
          const disposer = fn()
          return typeof disposer === 'function' ? disposer : () => {}
        },
        get: () => ({
          fetch: {
            register: (route) => {
              capturedHandler = route.fetch
              return () => {}
            },
          },
        }),
        settings: { register: (ns, schema) => { settingsRegistrations.push({ ns, schema }) } },
      }
      // 真实 Cordis 的注入 fiber 要等**全部**依赖都提供出来才跑；缺一个就一直挂着，
      // 静默少一个功能。之前这里是「命中任一依赖就跑」，等于给插件递了一个真实环境
      // 里根本不成立的时序 —— credentials 未就绪就同步的 bug 正是这么漏掉的。
      if (deps.every((dep) => provided.includes(dep))) body(injected)
      return { dispose: () => {} }
    },
  }
}

const plugin = await import('../index.js')
plugin.apply(makeCtx(), { baseUrl: 'http://gateway.test', apiKey: 'wb2a_fake' })

/** 造一个最小的 POST 请求对象。 */
function post(body) {
  return { json: async () => body }
}

console.log('配置（把 DSH 搞挂过的地方）')

await test('**不导出 Config** —— 导出它会拖垮 DSH 启动', () => {
  // 导出 Config 就必须是 schemastery schema：Cordis 读 ~standard.validate，
  // 设置服务还要 toJSON / meta / uid。给错形状会让 DSH 直接打不开（已真实发生过）。
  assert.equal('Config' in plugin, false, '不要导出 Config：配置走 profile 的 cordis.patch.yml')
})
await test('默认配置齐全（宿主不会再替我们填）', () => {
  const defaults = plugin.defaultConfig()
  assert.equal(defaults.baseUrl, 'http://192.168.1.42:7863')
  assert.equal(defaults.apiKeyRef, 'WORKBUDDY_API_KEY')
  assert.equal(defaults.reasoningProvider, 'workbuddy')
  assert.equal(defaults.rowLimit, 10)
  assert.deepEqual(defaults.providers, [])
})
await test('推理等级同步**默认关闭** —— 不默认改用户配置', () => {
  assert.equal(plugin.defaultConfig().syncReasoning, false)
})
await test('部分配置能跑：缺键用默认值兜底', () => {
  // 这条曾经挂过：`{ ...Config, ...config }` 把 schema 当值用，
  // 于是 reasoningProvider 变成对象、同步静默失效。
  const partial = { baseUrl: 'http://x' }
  const merged = { ...plugin.defaultConfig(), ...partial }
  assert.equal(merged.reasoningProvider, 'workbuddy')
  assert.equal(typeof merged.reasoningProvider, 'string')
})

console.log('路由装配')

await test('注册了 usage 路由处理器', () => {
  assert.equal(typeof capturedHandler, 'function')
})
await test('默认配置下不碰用户配置', () => {
  assert.equal(edits.length, 0, 'syncReasoning 默认 false，不该有任何写入')
})

// 显式开启后才同步 —— 单独跑一次 apply，用同一份 sink 观察新增的写入。
// 同步是异步跑的（`void syncReasoning(...).then(...)`），所以这里要等一拍再断言。
plugin.apply(makeCtx(), { baseUrl: 'http://gateway.test', apiKey: 'wb2a_fake', syncReasoning: true })
await new Promise((resolve) => setTimeout(resolve, 50))

await test('显式开启 syncReasoning 后才写入', () => {
  assert.equal(edits.length, 1, '应当同步一次')
})

// credentials 是**后到**的服务：激活时还没有，约两秒后就绪。同步必须等它，
// 否则每次启动都是「拿不到密钥 → 静默不写」，用户看到的就是推理等级菜单空着。
plugin.apply(makeCtx({ missing: ['credentials'] }), { baseUrl: 'http://gateway.test', apiKey: 'wb2a_fake', syncReasoning: true })
await new Promise((resolve) => setTimeout(resolve, 50))

await test('credentials 尚未就绪时**不**同步（等注入 fiber，不抢跑）', () => {
  assert.equal(edits.length, 1, '缺凭据服务还去同步 = 必然静默失败')
})

console.log('取快照分支')

const okResponse = await capturedHandler(post({}))
const okPayload = await okResponse.json()

await test('返回 ok 与 snapshot', () => {
  assert.equal(okPayload.ok, true)
  assert.ok(okPayload.snapshot)
})
await test('快照带账户余额', () => {
  assert.equal(okPayload.snapshot.balances.length, 1)
  assert.equal(okPayload.snapshot.balances[0].credits, 2983)
  assert.equal(okPayload.snapshot.balances[0].creditsTotal, 4726)
})
await test('快照带模型推理等级', () => {
  const hy4 = okPayload.snapshot.capabilities.find((c) => c.id === 'cn:hy4-preview')
  const glm = okPayload.snapshot.capabilities.find((c) => c.id === 'cn:glm-5.3-flash')
  assert.deepEqual(hy4.efforts, ['high'])
  assert.deepEqual(glm.efforts, ['low', 'high', 'max'])
})
await test('积分扣除历史带齐网关面板要的字段', () => {
  const row = okPayload.snapshot.creditModels.find((r) => r.key === 'glm-5.3-flash')
  assert.equal(row.rate, '0.06')
  assert.equal(row.requests, 44)
  assert.equal(row.credits, 5.61)
  assert.equal(row.creditTokens, 1308602)
  assert.equal(row.creditSamples, 44)
  assert.equal(row.creditsPer1m, 4.287)
  assert.equal(row.cacheHitTokens, 1204096)
  assert.equal(row.cacheMissTokens, 87716)
})
await test('积分扣除汇总带齐五张卡的值', () => {
  const totals = okPayload.snapshot.creditTotals
  assert.equal(totals.credits, 5.61)
  assert.equal(totals.creditTokens, 1308602)
  assert.equal(totals.creditSamples, 44)
  assert.equal(totals.creditsPer1m, 4.287)
  assert.equal(totals.cacheHitTokens, 1204096)
  assert.equal(totals.cacheMissTokens, 87716)
})
await test('积分扣除历史不按 rowLimit 截断', async () => {
  const response = await capturedHandler(post({}))
  const payload = await response.json()
  assert.equal(payload.snapshot.creditModels.length, 2)
})
await test('空 body 不报错', async () => {
  const response = await capturedHandler({ json: async () => { throw new Error('no body') } })
  const payload = await response.json()
  assert.equal(payload.ok, true)
})

console.log('推理等级同步分支')

await test('加载时的同步写入网关提供的档位（不补档）', () => {
  const written = edits[0].config
  const models = written.providers.workbuddy.models
  // cn:glm-5.3-flash：网关 supported_efforts = low/high/max 且 can_disable_thinking = true
  // → 补上 off，页面显示成「off (可关)」。
  assert.deepEqual(models.find((m) => m.id === 'cn:glm-5.3-flash').reasoningEfforts, {
    low: 'low',
    high: 'high',
    max: 'max',
    off: 'off',
  })
  // cn:hy4-preview：网关只声明 high 且不可关 → 菜单里就只有一档。
  assert.deepEqual(models.find((m) => m.id === 'cn:hy4-preview').reasoningEfforts, { high: 'high' })
})
await test('网关清单里没有的模型不写', () => {
  const models = edits[0].config.providers.workbuddy.models
  assert.equal('reasoningEfforts' in models.find((m) => m.id === 'cn:not-in-gateway'), false)
})
await test('网关标为固定档（supported_efforts 空且不可关）的模型不写', () => {
  const models = edits[0].config.providers.workbuddy.models
  assert.equal('reasoningEfforts' in models.find((m) => m.id === 'cn:hy4-preview-f'), false)
})
await test('provider 其他字段保留', () => {
  const provider = edits[0].config.providers.workbuddy
  assert.equal(provider.displayName, 'workbuddy')
  assert.equal(provider.baseURL, 'http://192.168.1.42:7863/v1')
})

const syncResponse = await capturedHandler(post({ action: 'syncReasoning' }))
const syncPayload = await syncResponse.json()

await test('syncReasoning 动作返回 ok', () => {
  assert.equal(syncPayload.ok, true)
  assert.equal(syncPayload.result.ok, true)
})
await test('重复同步是幂等的（不再产生新写入）', () => {
  // 第二次 edit 的入参已是写入后的配置，plan 应当零变更。
  assert.equal(edits.length, 2)
  const second = edits[1].config
  const first = edits[0].config
  assert.deepEqual(second, first)
})

console.log('密钥边界')

await test('网关请求都打到配置的地址', () => {
  assert.ok(requestedUrls.length > 0)
  assert.ok(requestedUrls.every((url) => url.startsWith('http://gateway.test/')))
  assert.ok(requestedUrls.some((url) => url.includes('/panel/api/overview')))
  assert.ok(requestedUrls.some((url) => url.includes('/panel/api/usage')))
  assert.ok(requestedUrls.some((url) => url.includes('/panel/api/models')))
})
await test('快照里不出现网关密钥', () => {
  const text = JSON.stringify(okPayload)
  assert.ok(!text.includes('wb2a_fake'), '密钥泄漏进快照')
})

console.log(`\n${passed} 项通过`)
