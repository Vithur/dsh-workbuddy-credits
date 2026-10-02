/**
 * 装机前自检 —— 机械验证「这个插件不会把 DSH 搞崩」。
 *
 * ## 为什么需要它
 *
 * 这个插件真的把用户的 DSH 搞崩过一次：导出的 `Config` 形状不对，异常发生在
 * 宿主的**配置解析路径**上，DSH 直接起不来。事后总结出的两条硬性质，这里逐条
 * 机械验证，不靠人工复述：
 *
 * 1. **不导出 `Config`** —— 宿主对没有 `Config` 的插件原样放行；一旦导出就必须是
 *    schemastery schema（Cordis 读 `~standard.validate`，设置服务还要
 *    `toJSON` / `meta` / `uid`），给错形状就是致命的。
 * 2. **`apply` 永不抛异常** —— 缺服务、服务为 null、服务方法抛异常，都必须正常返回。
 *    宿主对「条目激活失败」是降级处理，但插件不该给宿主任何失败的机会。
 *
 * 另外还查：模块只依赖相对路径（外部依赖解析失败会让条目激活失败）、
 * 浏览器半身的 loader 外壳形状、`package.json` 的 `dsh` 声明。
 *
 * 跑法：`node scripts/preflight.mjs`（退出码非 0 表示**不要装**）
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')

/**
 * 未处理的 promise rejection 会被 Node 升级成进程级异常 —— 这是插件拖垮宿主
 * 最典型的形态。这里全程监听，最后把它算成一条硬失败，而不是让自检脚本自己崩掉。
 */
const unhandledRejections = []
process.on('unhandledRejection', (reason) => {
  unhandledRejections.push(reason instanceof Error ? reason.message : String(reason))
})

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

console.log('一、Host 模块能否安全加载')

const mod = await import('../index.js')

check('导入不抛异常', () => {
  assert.equal(typeof mod, 'object')
})
check('**不导出 Config**（最关键的一条）', () => {
  assert.equal('Config' in mod, false, '导出 Config 会走宿主的配置解析路径，给错形状就是致命的')
})
check('导出 apply 函数', () => {
  assert.equal(typeof mod.apply, 'function')
})
check('inject 是数组（不硬依赖任何服务）', () => {
  assert.ok(Array.isArray(mod.inject))
})

console.log('二、只依赖相对路径（外部依赖解析失败会让条目激活失败）')

const hostSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8')
const importSpecifiers = [...hostSource.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])

check('index.js 的 import 全部是相对路径', () => {
  const external = importSpecifiers.filter((spec) => !spec.startsWith('./') && !spec.startsWith('../'))
  assert.deepEqual(external, [], `出现了外部依赖：${external.join(', ')}`)
})

/** 递归收集一个模块引到的所有本地文件，再检查它们的 import。 */
function collectLocalImports(entry, seen = new Set()) {
  if (seen.has(entry)) return seen
  seen.add(entry)
  if (!fs.existsSync(entry)) return seen
  const source = fs.readFileSync(entry, 'utf8')
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = match[1]
    if (!spec.startsWith('.')) {
      seen.add(`EXTERNAL:${spec}`)
      continue
    }
    collectLocalImports(path.resolve(path.dirname(entry), spec), seen)
  }
  return seen
}

check('整条 Host 依赖链都没有外部依赖', () => {
  const files = collectLocalImports(path.join(root, 'index.js'))
  const external = [...files].filter((f) => f.startsWith('EXTERNAL:'))
  assert.deepEqual(external, [], `依赖链里有外部包：${external.join(', ')}`)
})

console.log('三、apply 面对恶意 ctx 必须不抛')

/** 一组极端组合：服务缺失、为 null、方法抛异常。 */
const HOSTILE = [
  ['完全空对象', () => ({})],
  ['get 返回 undefined', () => ({ get: () => undefined })],
  ['get 抛异常', () => ({ get: () => { throw new Error('get 坏了') } })],
  ['inject 抛异常', () => ({ inject: () => { throw new Error('inject 坏了') } })],
  ['effect 抛异常', () => ({ effect: () => { throw new Error('effect 坏了') } })],
  ['logger 抛异常', () => ({ logger: { info: () => { throw new Error('info 坏了') }, warn: () => { throw new Error('warn 坏了') } } })],
  ['logger 是 null', () => ({ logger: null })],
  ['注入回调里的子 ctx 抛异常', () => ({ inject: (_deps, body) => { body({ get: () => { throw new Error('子 ctx 坏了') }, effect: () => { throw new Error('子 effect 坏了') } }) } })],
  ['所有服务都是 null', () => ({ get: () => null, inject: () => {}, effect: () => {}, logger: null })],
  ['connection 的 register 抛异常', () => ({
    inject: (deps, body) => {
      if (deps.includes('connection')) {
        body({ get: () => ({ fetch: { register: () => { throw new Error('register 坏了') } } }) })
      }
    },
  })],
  ['configEditor 的 edit 抛异常', () => ({
    inject: (deps, body) => {
      if (deps.includes('configEditor')) {
        body({ effect: (fn) => { fn(); return () => {} }, get: () => ({ entries: () => [], edit: () => { throw new Error('edit 坏了') } }) })
      }
    },
  })],
]

/** 几组畸形配置：缺键、类型错、null、非对象。 */
const CONFIGS = [
  ['undefined', undefined],
  ['null', null],
  ['空对象', {}],
  ['字符串', 'not-an-object'],
  ['数字', 42],
  ['类型全错', { baseUrl: 42, providers: 'workbuddy', rowLimit: 'abc', syncReasoning: 'yes' }],
  ['显式开启同步', { baseUrl: 'http://127.0.0.1:1', syncReasoning: true }],
]

for (const [ctxName, makeCtx] of HOSTILE) {
  for (const [configName, config] of CONFIGS) {
    check(`apply 不抛 —— ctx=${ctxName} / config=${configName}`, () => {
      mod.apply(makeCtx(), config)
    })
  }
}

console.log('四、package.json 的 dsh 声明')

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

check('包名与 cordis.patch.yml 里的 name 一致', () => {
  const patch = fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8')
  assert.ok(patch.includes(`name: '${pkg.name}'`), 'patch 里的包名对不上')
})
check('声明了 bundle.patch', () => {
  assert.equal(typeof pkg.dsh?.bundle?.patch, 'string')
})
check('声明了 client 半身与 platform', () => {
  assert.equal(pkg.dsh?.client?.platform, 'web')
})
check('exports["./client"] 指向真实存在的文件', () => {
  const client = pkg.exports?.['./client']
  assert.equal(typeof client, 'string')
  assert.ok(fs.existsSync(path.join(root, client)), `${client} 不存在`)
})
check('main 指向真实存在的文件', () => {
  assert.ok(fs.existsSync(path.join(root, pkg.main)), `${pkg.main} 不存在`)
})

console.log('五、浏览器半身的 loader 外壳')

const bundle = fs.readFileSync(path.join(root, pkg.exports['./client']), 'utf8')

check('调用 window.__ModuleLoader__.load', () => {
  assert.ok(bundle.includes('window.__ModuleLoader__.load('))
})
check('entry id 与包名后缀一致', () => {
  assert.ok(bundle.includes(`id: "workbuddy-credits"`))
})
check('factory 只通过 require 向宿主索取依赖', () => {
  assert.ok(/factory:\s*\(require\)/.test(bundle))
})
check('React 没被打进包里（走宿主模块表）', () => {
  assert.ok(/require\("react"\)/.test(bundle), 'React 应当从宿主 require')
})

check('在沙箱里装载不抛异常', () => {
  const sandbox = {
    console,
    Symbol,
    Date,
    Math,
    JSON,
    window: { __ModuleLoader__: { load: () => {} } },
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(bundle, sandbox, { filename: 'client.js' })
})

console.log('六、异步路径不得产生未处理的 rejection')

// apply 会「发射后不管」地踢起异步同步，所以先让它跑完再结算。
await new Promise((resolve) => setTimeout(resolve, 200))

check('全程没有未处理的 promise rejection', () => {
  assert.deepEqual(unhandledRejections, [], `出现了 ${unhandledRejections.length} 条未处理 rejection`)
})

console.log('七、结论')

if (failed === 0) {
  console.log(`\n通过 ${passed} 项 —— 可以安装。`)
} else {
  console.error(`\n失败 ${failed} 项（通过 ${passed} 项）—— **不要安装**。`)
  process.exitCode = 1
}
