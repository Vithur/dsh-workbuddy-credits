/**
 * 冒烟测试 —— 校验产物与装配形状，不碰网络。
 *
 * 三件事：
 * 1. `dist/client.js` 的 loader 外壳形状是否正确（entry id、factory、Registrant 导出）；
 * 2. Host 入口能否被 Node 正常导入，且导出 dsh 期待的那一组符号；
 * 3. patch 文件里的 entry id 是否和实现里的一致 —— 三者必须同名，
 *    否则浏览器半身根本不会加载，而失败是静默的。
 *
 * 跑法：`node scripts/smoke.mjs`
 */

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.resolve(import.meta.dirname, '..')

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

console.log('产物与装配形状')

const distPath = path.join(root, 'dist/client.js')
const dist = fs.existsSync(distPath) ? fs.readFileSync(distPath, 'utf8') : ''

test('dist/client.js 已生成', () => {
  assert.ok(fs.existsSync(distPath), '缺少 dist/client.js —— 先跑 npm run build')
})

test('外壳调用 window.__ModuleLoader__.load', () => {
  assert.ok(dist.includes('window.__ModuleLoader__.load('), '缺少 loader 外壳')
})

test('**bundle id 必须等于包名**（不一致会让 DSH 打不开）', () => {
  // 加载器按包名建模块行，用 stripClientSuffix(registration.id) 比对。id 对不上
  // 会让 bundle 被**再执行一次** → duplicate factory registration → web boot 崩。
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.ok(
    dist.includes(`id: ${JSON.stringify(pkg.name)}`),
    `bundle 的 id 必须是 "${pkg.name}"，实际产物里不是`,
  )
})

test('factory 以 require 索取宿主依赖', () => {
  assert.ok(/factory:\s*\(require\)/.test(dist), 'factory 未接收 require')
})

test('React 走宿主索取，未被打进包里', () => {
  assert.ok(/require\("react"\)/.test(dist), 'React 应从宿主 require')
  assert.ok(!/from ["']react["']/.test(dist), 'React 被静态打进了包里')
})

console.log('Host 入口')

const mod = await import('../index.js')

test('导出 name', () => {
  assert.equal(mod.name, 'workbuddy-credits')
})
test('导出 apply', () => {
  assert.equal(typeof mod.apply, 'function')
})
test('inject 为空 —— 不硬依赖任何服务', () => {
  assert.deepEqual(mod.inject, [])
})
test('**不导出 Config** —— 导出它会拖垮 DSH 启动', () => {
  // 导出 Config 就必须是 schemastery schema：Cordis 读 ~standard.validate，
  // 设置服务还要 toJSON / meta / uid。给错形状会让 DSH 直接打不开（已真实发生过一次）。
  // 已装的 6 个第三方插件没有一个导出它，这里守住同一条线。
  assert.equal('Config' in mod, false, '不要导出 Config：配置走 profile 的 cordis.patch.yml')
})

console.log('patch 一致性')

const patch = fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8')

test('patch 声明的 entry id 与实现一致', () => {
  assert.ok(patch.includes('- id: workbuddy-credits'), 'patch 里的 id 不对')
  assert.equal(mod.name, 'workbuddy-credits')
})
test('patch 指向正确的包名', () => {
  assert.ok(patch.includes("name: 'dsh-workbuddy-credits'"), 'patch 的包名与 package.json 不一致')
})

console.log(`\n${passed} 项通过`)
