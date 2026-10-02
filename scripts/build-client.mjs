/**
 * 打浏览器半身。
 *
 * ## 这个 id 为什么必须等于包名（踩坑记录）
 *
 * dsh 的 client bundle 不是普通 ESM —— 它是一个**自注册模块**：
 * 内容必须是 `window.__ModuleLoader__.load({ id, factory })`。
 *
 * `id` 不是随便起的名字。宿主的 client-modules 按**包名**给每个插件建模块行
 * （graphRows），加载器注册时用 `stripClientSuffix(registration.id)` 去比对那张表：
 *
 * ```js
 * register(registration) {
 *   const ownerId = stripClientSuffix(registration.id)
 *   if (this.bootstrapIds.has(id) || this.factories.has(id)) {
 *     throw new Error(`client-modules: duplicate factory registration for "${id}" ...`)
 *   }
 * }
 * ```
 *
 * id 对不上会发生什么：加载器 require 包名时找不到已注册的工厂 → **把 bundle 再执行
 * 一次** → 第二次 `load()` 撞上重复注册 → 抛错 → web boot 失败 → **DSH 打不开**。
 * 这不是推测，是本插件真实踩过的坑，崩溃日志原文：
 *
 * ```
 * Uncaught Error: client-modules: duplicate factory registration for "workbuddy-credits"
 * Error: web boot: 1 entry did not activate
 * ```
 *
 * 所以 id **从 package.json 的 name 派生**，不再手写 —— 手写就会漂移。
 *
 * React 也不自己打包进来，而是通过 `factory` 的 `require` 参数向宿主索取。
 * 这些形状都是从已装插件的实际产物里确认的，不是猜的。
 *
 * 跑法：`npm run build`
 */

import { build } from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

// —— 唯一的真相来源：package.json 的 name ——
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const ENTRY_ID = pkg.name

if (typeof ENTRY_ID !== 'string' || ENTRY_ID.length === 0) {
  throw new Error('package.json 里没有可用的 name')
}

const result = await build({
  entryPoints: [path.join(root, 'client/index.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: '__WB_CREDITS__',
  platform: 'browser',
  target: 'es2022',
  jsx: 'transform',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  logLevel: 'warning',
})

const bundled = result.outputFiles[0].text

/**
 * 外壳：外部依赖由宿主提供，`factory` 的 `require` 就是这条通道。
 * `module.exports` 上的 apply/name 是 dsh 期待的插件形状。
 */
const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(ENTRY_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var __external = (id) => require(id);
${bundled}
    return __WB_CREDITS__;
  }
});
`

const outDir = path.join(root, 'dist')
await fs.mkdir(outDir, { recursive: true })
const outFile = path.join(outDir, 'client.js')
await fs.writeFile(outFile, wrapped, 'utf8')

const kb = (Buffer.byteLength(wrapped, 'utf8') / 1024).toFixed(1)
console.log(`已生成 dist/client.js（${kb} KB，entry id "${ENTRY_ID}"，取自 package.json 的 name）`)
