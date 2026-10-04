/**
 * 重建浏览器半身产物 `dist/client.js`。
 *
 * ## 为什么自己手写打包壳
 *
 * 产物不是普通 ESM，而是宿主 `window.__ModuleLoader__` 吃的 CommonJS 工厂：
 * `load({ id, factory })` 里 `factory(require)` 返回模块的 `module.exports`。
 * esbuild 的 `--format=iife` 只能吐出一个不导出的表达式，所以外壳由本文件
 * 拼出来，**中间那段 IIFE 才是 esbuild 生成的**。
 *
 * ## 入口为什么用 `.jsx`
 *
 * 入口本身是纯 ESM（`export const name` / `export function apply`），宿主按
 * `export apply` 认它。esbuild 认 `.jsx` 扩展名，所以入口改名 `.jsx`，
 * 由 `resolve.extensions` 保证它能被解析到。
 *
 * 用法：`node scripts/build-client.mjs`
 */

import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

/**
 * esbuild 走 `createRequire` 解析。
 *
 * 顶层 `import { build } from 'esbuild'` 在两种情况下会直接失败：本仓库没装
 * devDependencies，以及宿主把插件目录塞进全局 `node_modules` 时 ESM 的解析根
 * 不落在插件自己身上。`require` 的解析根跟着本文件走，`NODE_PATH` 一指就通 ——
 * 这样「在别处装一份 esbuild 也能构建」这件事不必写进文档。
 */
const require = createRequire(import.meta.url)
const { build } = require('esbuild')

const ENTRY_ID = 'dsh-workbuddy-credits'

/**
 * 产物的外壳：把 esbuild 的 CJS 产物交回给宿主的模块加载器。
 *
 * ## 为什么必须是 `format: 'cjs'` 而不是 `'iife'`
 *
 * esbuild 的 `iife` 格式**在没给 `globalName` 时会直接丢弃模块导出** ——
 * 产物里连 `__toCommonJS` 都不会出现，`apply` 消失得干干净净。表现是
 * 「宿主加载成功、设置页菜单项整条不见」，没有任何报错。
 * `cjs` 才会老老实实产出 `module.exports = { apply, ... }`，正好是宿主要的形状。
 *
 * `var module = { exports: {} }` 这行要留着：esbuild 生成的 CJS 代码要用它，
 * 宿主加载器也是同样写法。
 */
function wrap(cjs) {
  return `window.__ModuleLoader__.load({
  id: ${JSON.stringify(ENTRY_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${cjs}
    return module.exports;
  }
});
`
}

const result = await build({
  entryPoints: [path.join(root, 'client/index.js')],
  bundle: true,
  // 见 wrap() 的说明：iife 会丢导出，只有 cjs 能交出 module.exports。
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  // React 由宿主注入，插件自带一份会让两份 React 各画各的。
  external: ['react'],
  resolveExtensions: ['.jsx', '.js', '.mjs', '.json'],
  write: false,
  charset: 'utf8',
  legalComments: 'none',
})

const [file] = result.outputFiles
const target = path.join(root, 'dist/client.js')

// 先落盘再回读：产物自身出错时不会把上一版好文件覆盖掉。
const next = wrap(file.text)
await writeFile(target, next, 'utf8')
const written = await readFile(target, 'utf8')

// 校验外壳而不只是校验字节：把工厂函数在一个最小宿主里跑一遍，
// 断言 `apply` / `name` 真的挂上了。历史上出过「产物能加载但整个是空壳」
// 的事故 —— 光看文件大小和字符串完全发现不了。
//
// React 是 external，所以工厂会 require('react')；这里用测试依赖里的真 React
// 而不是 stub —— stub 掉会让「导入即崩」这类问题溜过去。
const react = require('react')
const loader = { loaded: null, load(spec) { this.loaded = spec } }
const run = new Function('window', `${written}\nreturn window.__ModuleLoader__.loaded;`)
const spec = run({ __ModuleLoader__: loader })
if (!spec || typeof spec.factory !== 'function') throw new Error('产物未交给 __ModuleLoader__')
if (spec.id !== ENTRY_ID) throw new Error(`模块 id 不符：${spec.id}`)

const loaded = spec.factory((id) => {
  if (id === 'react') return react
  throw new Error(`产物请求了未声明的外部依赖：${id}`)
})
for (const key of ['name', 'inject', 'apply']) {
  if (!(key in loaded)) throw new Error(`产物缺少导出：${key}`)
}

console.log(`dist/client.js  ${written.length} bytes  导出 ${Object.keys(loaded).sort().join(', ')}`)