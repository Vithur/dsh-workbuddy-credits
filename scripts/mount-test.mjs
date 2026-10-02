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

  // `apply` 直接读 ctx.locale / ctx.effect（与 dsh-context 同一形状），
  // 同时用 ctx.inject 拿 slots —— 两个通道都必须提供。
  const ctx = {
    locale,
    settings: undefined,
    effect: (fn, label) => {
      effects.push({ fn, label })
      // 真实 Cordis 会立即执行注册体并持有返回的 disposer。
      const disposer = fn()
      return () => disposer?.()
    },
    inject: (deps, body) => {
      const injected = {
        slots,
        locale,
        settings: undefined,
        effect: (fn, label) => {
          effects.push({ fn, label })
          const disposer = fn()
          return () => disposer?.()
        },
      }
      body(injected)
      return { dispose: () => {} }
    },
  }

  plugin.apply(ctx)
  return { registrations, effects }
}

console.log('bundle 装载')

const { plugin } = mount()

test('loader 产出了插件对象', () => {
  assert.ok(plugin, 'factory 没有返回内容')
})
test('id 是 workbuddy-credits', () => {
  assert.equal(plugin.id, 'workbuddy-credits')
})
test('导出 name / apply', () => {
  assert.equal(plugin.name, 'workbuddy-credits')
  assert.equal(typeof plugin.apply, 'function')
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
