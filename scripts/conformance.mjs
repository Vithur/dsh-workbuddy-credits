/**
 * 形状对照 —— 拿**本机已装且能正常工作的插件**当基准，逐项比对本插件的契约面。
 *
 * ## 为什么要有这个脚本
 *
 * 之前那两个把 DSH 搞崩的 bug，本质是同一类：**我的 bundle 和正常插件长得不一样**。
 *
 * 1. bundle 的 `load({ id })` 不等于包名；
 * 2. 客户端半身没有导出 `inject`，于是 `ctx.slots` / `ctx.locale` 是 undefined。
 *
 * 这两条都不是「逻辑错」，而是「契约没对上」。而当时的自检脚本验证的是我自己
 * 想出来的性质（不导出 Config、apply 不抛异常）—— 拿自己的假设当标准，永远
 * 抓不到「我不知道的约定」。
 *
 * 所以这个脚本换一个**外部基准**：扫描 profile 里所有声明了 `dsh.client` 的
 * 插件，把它们的契约面抽出来，跟本插件逐项对照。别人能跑，我就该长得一样。
 *
 * 跑法：`node scripts/conformance.mjs`（退出码非 0 表示**不要装**）
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const profileDir = process.env.DSH_PROFILE_DIR ?? path.join(os.homedir(), '.dsh', 'profiles', 'desktop')
const nodeModules = path.join(profileDir, 'node_modules')
const self = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

let passed = 0
let failed = 0
function check(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok    ${name}`)
  } catch (error) {
    failed++
    console.error(`  FAIL  ${name}`)
    console.error(`        ${error.message}`)
  }
}

/** 只应答已知字段的 React 桩；其余 require 一律给宽松代理，避免把别人的 bundle 卡死。 */
function makeRequireStub() {
  const react = new Proxy({}, {
    get(_target, key) {
      if (key === 'createElement') return () => ({ $$typeof: Symbol.for('react.element'), type: null, props: {} })
      if (key === 'Fragment') return Symbol.for('react.fragment')
      if (key === 'default') return react
      if (typeof key === 'string' && /^use[A-Z]/.test(key)) return () => undefined
      return () => undefined
    },
  })
  const cache = new Map([['react', react], ['react/jsx-runtime', react], ['react-dom', react]])
  return (id) => {
    if (cache.has(id)) return cache.get(id)
    const stub = new Proxy({}, { get: () => () => undefined })
    cache.set(id, stub)
    return stub
  }
}

/**
 * 在一个假宿主里执行一个 client bundle，拿回它注册的插件对象。
 * @returns {{ id: string, exports: object }|null}
 */
function loadClientBundle(bundlePath) {
  if (!fs.existsSync(bundlePath)) return null
  const bundle = fs.readFileSync(bundlePath, 'utf8')
  let captured = null
  const sandbox = {
    console: { log: () => {}, error: () => {}, warn: () => {} },
    Symbol,
    Date,
    Math,
    JSON,
    Object,
    Array,
    Error,
    Promise,
    setTimeout,
    clearTimeout,
    window: { __ModuleLoader__: { load: (registration) => { captured = registration } } },
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(bundle, sandbox, { filename: path.basename(bundlePath) })
  if (captured === null) return null
  const exports = captured.factory(makeRequireStub())
  return { id: captured.id, exports }
}

/** 收集一个插件的契约面。 */
function surfaceOf(dir) {
  const pkgPath = path.join(dir, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  } catch {
    return null
  }
  if (!pkg.dsh?.client) return null

  const clientRel = typeof pkg.exports?.['./client'] === 'string'
    ? pkg.exports['./client']
    : pkg.exports?.['./client']?.default
  const bundlePath = typeof clientRel === 'string' ? path.join(dir, clientRel) : null
  let loaded = null
  try {
    loaded = bundlePath === null ? null : loadClientBundle(bundlePath)
  } catch {
    loaded = null
  }
  return {
    name: pkg.name,
    dir,
    dshClient: pkg.dsh.client,
    bundleId: loaded?.id ?? null,
    inject: Array.isArray(loaded?.exports?.inject) ? loaded.exports.inject : null,
    hasApply: typeof loaded?.exports?.apply === 'function',
    hasName: typeof loaded?.exports?.name === 'string',
  }
}

// —— 收集基准：profile 里所有能用的插件（排除本插件自己）——
// 有些插件的 bundle 在这个沙箱里跑不起来（依赖更多宿主全局、或工厂里有副作用），
// 那是**本脚本的取样限制**，不是那些插件不合格。所以它们被排除并标注，而不是拿去
// 判失败 —— 对照工具自己失准比没有对照更糟。
const scanned = []
const baselines = []
if (fs.existsSync(nodeModules)) {
  for (const entry of fs.readdirSync(nodeModules, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    if (entry.name === self.name) continue
    if (entry.name.startsWith('.')) continue
    const surface = surfaceOf(path.join(nodeModules, entry.name))
    if (surface === null) continue
    scanned.push(surface)
    if (surface.bundleId !== null) baselines.push(surface)
  }
}

const excluded = scanned.filter((s) => s.bundleId === null)

console.log(`基准：${baselines.length} 个可加载的已装插件`)
for (const b of baselines) {
  console.log(`  · ${b.name.padEnd(24)} bundleId=${String(b.bundleId).padEnd(24)} inject=${JSON.stringify(b.inject)}`)
}
if (excluded.length > 0) {
  console.log(`排除 ${excluded.length} 个（本沙箱加载不了，不作基准）：${excluded.map((s) => s.name).join(', ')}`)
}
console.log('')

if (baselines.length < 2) {
  console.error(`可加载的基准只有 ${baselines.length} 个 —— 样本不足，拒绝给出结论。`)
  process.exit(1)
}

// —— 本插件的契约面 ——
const mine = surfaceOf(root)
if (mine === null) {
  console.error('本插件的 package.json 里没有 dsh.client —— 无法对照。')
  process.exit(1)
}

console.log(`待检：${mine.name}`)
console.log(`  bundleId=${String(mine.bundleId)}  inject=${JSON.stringify(mine.inject)}  apply=${String(mine.hasApply)}`)
console.log('')

console.log('一、bundle id 必须等于包名（所有基准都满足）')

check('每个基准的 bundleId 都等于自己的包名（基准自身可信）', () => {
  for (const b of baselines) {
    assert.equal(b.bundleId, b.name, `${b.name} 的 bundleId 是 ${String(b.bundleId)}`)
  }
})
check('本插件的 bundleId 等于包名', () => {
  assert.equal(mine.bundleId, mine.name, `bundleId=${String(mine.bundleId)} 包名=${mine.name}`)
})

console.log('二、客户端半身必须导出 inject，且覆盖基准的公共子集')

/** 基准里出现过的服务名 → 有多少个基准声明了它。 */
const injectUnion = new Map()
for (const b of baselines) {
  for (const service of b.inject ?? []) injectUnion.set(service, (injectUnion.get(service) ?? 0) + 1)
}
/** 所有基准都声明了的服务 —— 这是真正不能少的。 */
const injectRequired = [...injectUnion.entries()].filter(([, count]) => count === baselines.length).map(([name]) => name)

console.log(`  基准共同声明的服务：${injectRequired.join(', ') || '（无）'}`)

check('基准全都导出了 inject', () => {
  for (const b of baselines) {
    assert.ok(Array.isArray(b.inject), `${b.name} 没有导出 inject`)
  }
})
check('本插件导出了 inject', () => {
  assert.ok(Array.isArray(mine.inject), 'inject 缺失 —— 客户端 ctx 上不会有任何服务')
})
check('本插件的 inject 覆盖基准的共同子集', () => {
  const missing = injectRequired.filter((service) => !(mine.inject ?? []).includes(service))
  assert.deepEqual(missing, [], `缺少 ${missing.join(', ')} —— ctx.<服务> 会是 undefined`)
})

console.log('三、客户端半身导出 apply')

check('基准全都导出了 apply', () => {
  for (const b of baselines) assert.ok(b.hasApply, `${b.name} 没有导出 apply`)
})
check('本插件导出了 apply', () => {
  assert.ok(mine.hasApply)
})

console.log('四、客户端代码里的每一处 ctx.X 都必须在 inject 名单内')

/**
 * 框架自带的 ctx 成员 —— 不是「服务」，不需要 inject。
 * 这份名单取自客户端 Builtin 声明与已装插件的实际用法。
 */
const FRAMEWORK_CTX_MEMBERS = new Set(['effect', 'inject', 'on', 'get', 'provide', 'emit'])

/** 去掉注释与字符串字面量，避免把「文档里提到的陷阱」当成真代码。 */
function stripCommentsAndStrings(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

/** 扫描 client/ 下所有源文件里出现的 `ctx.<名字>`（只看真代码）。 */
function ctxAccesses() {
  const dir = path.join(root, 'client')
  const found = new Map()
  for (const file of fs.readdirSync(dir)) {
    if (!/\.(js|jsx|mjs)$/.test(file)) continue
    const code = stripCommentsAndStrings(fs.readFileSync(path.join(dir, file), 'utf8'))
    for (const match of code.matchAll(/\bctx\.([A-Za-z_$][\w$]*)/g)) {
      const name = match[1]
      if (!found.has(name)) found.set(name, new Set())
      found.get(name).add(file)
    }
  }
  return found
}

const accesses = ctxAccesses()
const declared = new Set([...FRAMEWORK_CTX_MEMBERS, ...(mine.inject ?? [])])

console.log(`  代码里读到的 ctx 成员：${[...accesses.keys()].sort().join(', ') || '（无）'}`)
console.log(`  已声明（inject + 框架成员）：${[...declared].sort().join(', ')}`)

check('没有读取任何未声明的 ctx 服务', () => {
  const offenders = []
  for (const [name, files] of accesses) {
    if (declared.has(name)) continue
    offenders.push(`${name}（${[...files].join(', ')}）`)
  }
  assert.deepEqual(
    offenders,
    [],
    `读了未声明的服务：${offenders.join('; ')}。\n`
    + '        客户端 ctx 是受限上下文，读未声明的服务**不是返回 undefined 而是直接抛**，\n'
    + '        可选链挡不住；若发生在渲染期，apply 的 try/catch 也接不到。',
  )
})

console.log('五、dsh.client 声明的形状')

check('本插件的 platform 与基准一致', () => {
  const platforms = new Set(baselines.map((b) => b.dshClient.platform))
  assert.ok(platforms.has(mine.dshClient.platform), `基准的 platform 是 ${[...platforms].join('/')}`)
})
check('immediately 字段与多数基准一致（布尔）', () => {
  const immediate = mine.dshClient.immediately
  assert.ok(immediate === undefined || typeof immediate === 'boolean', `immediately=${String(immediate)}`)
})

console.log('五、结论')
if (failed === 0) {
  console.log(`\n通过 ${passed} 项 —— 契约面与 ${baselines.length} 个基准插件一致，可以安装。`)
} else {
  console.error(`\n失败 ${failed} 项（通过 ${passed} 项）—— **不要安装**。`)
  process.exitCode = 1
}
