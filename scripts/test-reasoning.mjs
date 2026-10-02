/**
 * 推理等级同步的独立真测 —— 纯函数，不碰配置、不联网。
 *
 * 这段逻辑决定了模型菜单里会出现哪些档位，所以必须机械地卡住：
 * 只写网关真的声明的档位、幂等、不碰其他字段。
 *
 * 跑法：`node scripts/test-reasoning.mjs`
 */

import assert from 'node:assert/strict'
import { PI_AI_THINKING_LEVELS, desiredEfforts, planReasoningSync, sameEfforts } from '../src/reasoning.js'

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

console.log('desiredEfforts —— 档位完全以网关「模型与档位」页为准')

test('一档的模型只给一档（cn:hy4-preview）', () => {
  assert.deepEqual(desiredEfforts(['high'], false), { high: 'high' })
})
test('两档的模型只给两档（cn:hy3）', () => {
  assert.deepEqual(desiredEfforts(['low', 'high'], false), { low: 'low', high: 'high' })
})
test('can_disable_thinking 为真时补上 off（cn:glm-5.3-flash）', () => {
  // 网关页面把这一档显示成「off (可关)」。
  assert.deepEqual(desiredEfforts(['low', 'high', 'max'], true), {
    low: 'low',
    high: 'high',
    max: 'max',
    off: 'off',
  })
})
test('off 的线上拼写是字符串 "off"，不是 null', () => {
  // 写成 null 会被 pi-ai 翻译成「整段省略 reasoning 参数」，
  // 对这个网关就等于用它自己的默认档 —— Off 就成了说了不算的控件。
  assert.equal(desiredEfforts(['high'], true).off, 'off')
})
test('can_disable_thinking 为假/缺失时不补 off', () => {
  assert.equal('off' in desiredEfforts(['low', 'high'], false), false)
  assert.equal('off' in desiredEfforts(['low', 'high'], undefined), false)
})
test('五档模型原样保留（global:gpt-5.6-luna）', () => {
  assert.deepEqual(desiredEfforts(['low', 'medium', 'high', 'xhigh', 'max'], true), {
    low: 'low',
    medium: 'medium',
    high: 'high',
    xhigh: 'xhigh',
    max: 'max',
    off: 'off',
  })
})
test('固定档模型（supported_efforts 缺失）不写', () => {
  // 网关页面写「固定档 · 默认 high」的那些。
  assert.equal(desiredEfforts(null, false), null)
  assert.equal(desiredEfforts(undefined, undefined), null)
})
test('空数组不写', () => {
  assert.equal(desiredEfforts([], false), null)
})
test('只有 off 时不写（没有可选的思考档位）', () => {
  assert.equal(desiredEfforts([], true), null)
  assert.equal(desiredEfforts(['off'], true), null)
})
test('pi-ai 不认得的档位被丢掉', () => {
  assert.deepEqual(desiredEfforts(['high', 'ultra', 'turbo'], false), { high: 'high' })
})
test('非字符串项被忽略', () => {
  assert.deepEqual(desiredEfforts(['high', 42, null, ''], false), { high: 'high' })
})
test('pi-ai 档位集合与预期一致', () => {
  assert.deepEqual(PI_AI_THINKING_LEVELS, ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
})

console.log('sameEfforts —— 幂等判定')

test('键值相同即等价（忽略顺序）', () => {
  assert.equal(sameEfforts({ low: 'low', high: 'high' }, { high: 'high', low: 'low' }), true)
})
test('键数不同不等价', () => {
  assert.equal(sameEfforts({ low: 'low' }, { low: 'low', high: 'high' }), false)
})
test('值不同不等价', () => {
  assert.equal(sameEfforts({ high: 'high' }, { high: 'HIGH' }), false)
})
test('null 与字典不等价', () => {
  assert.equal(sameEfforts(null, { high: 'high' }), false)
})

console.log('planReasoningSync —— 只改该改的')

const CURRENT = {
  providers: {
    workbuddy: {
      displayName: 'workbuddy',
      baseURL: 'http://192.168.1.42:7863/v1',
      models: [
        { id: 'cn:glm-5.3-flash', name: 'GLM', contextWindow: 1000000, reasoning: true },
        { id: 'cn:hy4-preview', name: 'Hy4', contextWindow: 1000000 },
        { id: 'cn:not-in-gateway', name: 'X' },
      ],
    },
    'local-swift': { models: [{ id: 'Qwen3.8-27B' }] },
  },
}

const PLAN = planReasoningSync(
  CURRENT,
  'workbuddy',
  new Map([
    ['cn:glm-5.3-flash', { off: 'off', low: 'low', high: 'high', max: 'max' }],
    ['cn:hy4-preview', { high: 'high' }],
  ]),
)

test('为命中的模型写入 reasoningEfforts', () => {
  const models = PLAN.config.providers.workbuddy.models
  assert.deepEqual(models[0].reasoningEfforts, { off: 'off', low: 'low', high: 'high', max: 'max' })
  assert.deepEqual(models[1].reasoningEfforts, { high: 'high' })
})
test('网关没声明的模型原样不动', () => {
  const models = PLAN.config.providers.workbuddy.models
  assert.equal('reasoningEfforts' in models[2], false)
})
test('其他 provider 一个字节都不动', () => {
  assert.deepEqual(PLAN.config.providers['local-swift'], CURRENT.providers['local-swift'])
})
test('provider 的其他字段保留', () => {
  const provider = PLAN.config.providers.workbuddy
  assert.equal(provider.displayName, 'workbuddy')
  assert.equal(provider.baseURL, 'http://192.168.1.42:7863/v1')
})
test('模型的既有字段保留', () => {
  const model = PLAN.config.providers.workbuddy.models[0]
  assert.equal(model.name, 'GLM')
  assert.equal(model.contextWindow, 1000000)
  assert.equal(model.reasoning, true)
})
test('变更清单如实记录', () => {
  assert.equal(PLAN.changes.length, 2)
  assert.equal(PLAN.changes[0].model, 'cn:glm-5.3-flash')
  assert.equal(PLAN.changes[0].from, null)
})
test('不修改传入的原对象', () => {
  assert.equal('reasoningEfforts' in CURRENT.providers.workbuddy.models[0], false)
})

console.log('planReasoningSync —— 幂等')

const AGAIN = planReasoningSync(PLAN.config, 'workbuddy', new Map([
  ['cn:glm-5.3-flash', { off: 'off', low: 'low', high: 'high', max: 'max' }],
  ['cn:hy4-preview', { high: 'high' }],
]))

test('已是最新时不产生任何变更', () => {
  assert.deepEqual(AGAIN.changes, [])
})
test('已是最新时原样返回配置', () => {
  assert.equal(AGAIN.config, PLAN.config)
})

console.log('planReasoningSync —— 边界')

test('空配置不崩', () => {
  const result = planReasoningSync({}, 'workbuddy', new Map([['a', { high: 'high' }]]))
  assert.deepEqual(result.changes, [])
})
test('provider 不存在时不崩', () => {
  const result = planReasoningSync(CURRENT, 'nope', new Map([['a', { high: 'high' }]]))
  assert.deepEqual(result.changes, [])
})
test('models 不是数组时不崩', () => {
  const result = planReasoningSync({ providers: { w: { models: null } } }, 'w', new Map([['a', { high: 'high' }]]))
  assert.deepEqual(result.changes, [])
})
test('目标是 null 时跳过该模型', () => {
  const result = planReasoningSync(CURRENT, 'workbuddy', new Map([['cn:glm-5.3-flash', null]]))
  assert.deepEqual(result.changes, [])
})

console.log(`\n${passed} 项通过`)
