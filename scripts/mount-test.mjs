/**
 * bundle 装载测试 —— 在假的宿主环境里真正执行 dist/client.js。
 *
 * 冒烟测试只检查了「文本里有没有那几个字符串」；这里把产物当作真模块
 * 装进一个模拟 `window.__ModuleLoader__` 的沙箱，验证：
 *   1. factory 能跑完、不抛错；
 *   2. 插件确实注册了自己的两个 slot；
 *   3. 注册的 id / name 与 cordis.patch.yml 对得上。
 *
 * 这是安装前最后一道卡口，也是唯一能在没有真 dsh 的情况下证明 UI 半身活着。
 *
 * 跑法：`node scripts/mount-test.mjs`
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const root = path.resolve(import.meta.dirname, '..')
const dist = fs.readFileSync(path.join(root, 'dist/client.js'), 'utf8')

let passed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (error) {
    console.error(`  FAIL ${name}\n       ${error.message}`)
    process.exitCode = 1
  }
}

/**
 * 搭一个最小宿主：__ModuleLoader__ + require('react')。
 * React 只需要 createElement/hooks 的桩，够验证装配路径即可。
 */
function mount() {
  const registrations = []
  let plugin = null

  const requireStub = (id) => {
    if (id === 'react') {
      return {
        createElement: (type, props, ...children) => ({
          $$typeof: Symbol.for('react.element'),
          type,
          props: { ...(props ?? {}), children: children.length ? children : undefined },
        }),
        useEffect: () => {},
        useState: (init) => [init, () => {}],
        useRef: (init) => ({ current: init }),
        useMemo: (fn) => fn(),
        Fragment: Symbol.for('react.fragment'),
      }
    }
    throw new Error(`未预期的 require: ${id}`)
  }

  const sandbox = {
    console,
    Symbol,
    Date,
    Math,
    JSON,
    window: {
      __ModuleLoader__: {
        load: ({ id, factory }) => {
          plugin = { id, ...factory(requireStub) }
        },
      },
    },
  }
  sandbox.globalThis = sandbox

  vm.createContext(sandbox)
  vm.runInContext(dist, sandbox, { filename: 'client.js' })

  return { plugin, requireStub }
}

/** 跑一遍 apply，用假的 ctx 收集它注册了什么。 */
function applyWithFakeCtx(plugin) {
  const registrations = []
  const effects = []

  const slots = {
    inject: (name, produce) => {
      const saved = registrations.length
      // 立即执行注入体，拿到注册结果 —— 这就是真实 running zero 的行为。
      produce()
      for (const r of registrations.slice(saved)) r.slot = name
      return () => {}
    },
    register: (decl, render) => {
      registrations.push({ decl, render })
      return () => {}
    },
  }

  const locale = {
    register: (ns, dicts) => {
      registrations.push({ ns, dicts })
      return () => {}
    },
    bind: (ns) => (key) => `${ns}.${key}`,
  }

  // 真实客户端 ctx 是**受限**的：只有 `inject` 里声明过的服务才能读，而且读的属性
  // 访问器本身会抛（不是返回 undefined，所以 `ctx.x?.y` 挡不住）。这里用 Proxy 复刻
  // 那个行为 —— 否则测试会给插件递一个真实环境里根本不存在的 `ctx.settings`，
  // 「插件显示已加载、设置页却一片空白」就是这么漏掉线上验证的。
  const raw = {
    locale,
    slots,
    effect: (fn, label) => {
      effects.push({ fn, label })
      // 真实 Cordis 会立即执行注册体并持有返回的 disposer。
      const disposer = fn()
      return () => disposer?.()
    },
    inject: (deps, body) => {
      body(restricted(deps))
      return { dispose: () => {} }
    },
  }
  // ctx 上除了声明过的服务，还有 effect / inject 这些框架自带的成员。
  // **不放 `console`** —— 它是客户端 Builtin（和 React 同级）而不是 ctx 服务，
  // 写 `ctx.console` 在真实环境里会抛；放进来就等于把这个坑遮住。
  const allowed = new Set(['effect', 'inject', ...(plugin.inject ?? [])])

  plugin.apply(restricted(allowed))
  return { registrations, effects }

  /** 按 `inject` 名单造一个受限 ctx：名单外的属性一读就抛，与真实客户端一致。 */
  function restricted(names) {
    const set = names instanceof Set ? names : new Set(names)
    return new Proxy(raw, {
      get: (target, prop) => {
        if (typeof prop === 'symbol' || set.has(prop)) return target[prop]
        throw new Error(`cannot get property "${String(prop)}" without inject`)
      },
    })
  }
}

console.log('bundle 装载')

const { plugin } = mount()

test('loader 产出了插件对象', () => {
  assert.ok(plugin, 'factory 没有返回内容')
})
test('loader id 等于包名（不一致会让 DSH 打不开）', () => {
  // 加载器按包名建模块行；id 对不上会让 bundle 被再执行一次 → 重复注册 → boot 崩。
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.equal(plugin.id, pkg.name)
})
test('导出 name / apply', () => {
  assert.equal(plugin.name, 'workbuddy-credits')
  assert.equal(typeof plugin.apply, 'function')
})
test('**声明了 inject: slots + locale**（缺了会让 DSH 打不开）', () => {
  // 客户端 ctx 是受限上下文：只有列在 inject 里的服务才会出现。不声明的话
  // ctx.slots / ctx.locale 是 undefined，apply 立刻抛 → 条目 failed → web boot 崩。
  assert.ok(Array.isArray(plugin.inject), 'inject 必须是数组')
  assert.ok(plugin.inject.includes('slots'), 'inject 里必须有 slots')
  assert.ok(plugin.inject.includes('locale'), 'inject 里必须有 locale')
})

console.log('apply 装配')

const { registrations, effects } = applyWithFakeCtx(plugin)

test('注册了 locale 字典', () => {
  const dict = registrations.find((r) => r.ns === 'workbuddyCredits')
  assert.ok(dict, '未注册 workbuddyCredits 命名空间')
  assert.ok(dict.dicts.zh && dict.dicts.en, '缺少 zh 或 en 字典')
})

test('挂到 conversation.composer.dock（输入框下方状态栏，排最左）', () => {
  const found = registrations.find((r) => r.slot === 'conversation.composer.dock')
  assert.ok(found, '状态栏没有挂载')
  assert.equal(found.decl.name, 'conversation.composer.dock')
  assert.equal(found.decl.id, 'workbuddy-credits')
  // order -1 排在原生 stats（order 0）之前；dock 是 flex 横排，所以积分在最左边。
  assert.equal(found.decl.order, -1)
})

test('挂到 settings.section（积分余额明细）', () => {
  const found = registrations.filter((r) => r.slot === 'settings.section')
  assert.equal(found.length, 1)
  assert.equal(found[0].decl.id, 'workbuddy-credits-balance')
})

test('侧边栏底部不再挂任何东西', () => {
  assert.equal(registrations.find((r) => r.slot === 'sidebar.footer.action'), undefined, '侧边栏底部应为空')
})

test('推理等级不再占用设置页', () => {
  const ids = registrations.filter((r) => r.slot === 'settings.section').map((r) => r.decl.id)
  assert.ok(!ids.some((id) => id.includes('reasoning')), '设置页不应再有推理等级页')
})

test('两个挂载点都给了渲染函数', () => {
  const views = registrations.filter((r) => ['conversation.composer.dock', 'settings.section'].includes(r.slot))
  assert.equal(views.length, 2)
  for (const v of views) assert.equal(typeof v.render, 'function')
})

test('locale 字典已注册为 dispose 效果', () => {
  assert.ok(effects.some((e) => String(e.label).includes('dictionaries')), '字典注册没走 effect')
})

console.log('渲染路径')

test('状态栏 pill 能渲染出元素', () => {
  const found = registrations.find((r) => r.slot === 'conversation.composer.dock')
  // useSnapshot 桩返回空数据时不应抛错（此时 pill 自己返回 null 也是合法的）
  const el = found.render({})
  assert.ok(el === null || el.$$typeof === Symbol.for('react.element'), '渲染结果类型不对')
})

test('设置页能渲染出元素', () => {
  for (const found of registrations.filter((r) => r.slot === 'settings.section')) {
    const el = found.render({})
    assert.ok(el, '渲染返回空')
    assert.equal(el.$$typeof, Symbol.for('react.element'))
  }
})

console.log(`\n${passed} 项通过`)
