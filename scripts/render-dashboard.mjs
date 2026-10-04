/**
 * 设置页渲染真测的**加载器**。
 *
 * ## 为什么要多这一层
 *
 * `client/CreditsDashboard.jsx` 是 `.jsx` 扩展名，Node 原生 ESM 不认
 * （`ERR_UNKNOWN_FILE_EXTENSION`）；而 React 又必须与宿主是同一份实例，
 * 不能在测试里 mock —— mock 掉的 `createElement` 恰好是最容易写错的一层。
 *
 * 所以拆成两个文件：
 * - 本文件负责「怎么加载」：用 esbuild 把断言体编译成单文件 ESM 再执行，
 *   React 留作 external 走运行时解析；
 * - `render-dashboard.cjs.mjs` 只负责「断言什么」。
 *
 * 断言全部在真实组件上跑：`renderToStaticMarkup` 与浏览器 hydrate 用的是同一份
 * React，断的只有网络与计时器。
 *
 * 跑法：`node scripts/render-dashboard.mjs`
 */

import path from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

// 用 `require` 而不是顶层 `import`：解析根跟本文件走，`NODE_PATH` 一指就通。
const require = createRequire(import.meta.url)
const { build } = require('esbuild')

/**
 * 产物必须落在插件目录内，不能扔 `%TEMP%`。
 *
 * React 是 external：编译产物在运行时才 import 它，而 ESM 的解析根按**产物所在
 * 目录**算。产物在 `%TEMP%` 下就找不到插件的 `node_modules`，直接
 * `ERR_MODULE_NOT_FOUND`。`.render-build/` 已在 `.gitignore` 里，跑完即删。
 */
const scratch = path.join(root, '.render-build')
await mkdir(scratch, { recursive: true })
const bundle = path.join(scratch, `render-${process.pid}.mjs`)

const compiled = await build({
  entryPoints: [process.argv[2] ? path.resolve(here, '..', process.argv[2]) : path.join(here, 'render-dashboard.cjs.mjs')],
  bundle: true,
  // 必须 ESM：断言体用 top-level await，CJS 输出格式不支持。
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: ['react', 'react-dom/server'],
  outfile: bundle,
  logLevel: 'silent',
})

if (compiled.errors.length > 0) {
  console.error(compiled.errors.map((error) => error.text).join('\n'))
  await rm(scratch, { recursive: true, force: true })
  process.exit(1)
}

try {
  // 断言体被打进单文件后已经不知道自己在哪了，仓库根目录只能从外面递进去。
  process.env.WB_CREDITS_ROOT = root
  // argv 在 import 之前被消费掉了，这里补回去给被测脚本用。
  process.argv = [process.argv[0], bundle, ...process.argv.slice(2)]
  await import(pathToFileURL(bundle).href)
} finally {
  await rm(scratch, { recursive: true, force: true })
}