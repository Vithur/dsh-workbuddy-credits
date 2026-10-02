/**
 * 打浏览器半身。
 *
 * dsh 的 client bundle 不是普通 ESM —— 它是一个**自注册模块**：
 * 内容必须是 `window.__ModuleLoader__.load({ id, factory })`，且 `id` 必须与
 * patch 层的 entry id 逐字一致。React 也不自己打包进来，而是通过 `factory`
 * 的 `require` 参数向宿主索取 —— 这是从已装插件（dsh-context / status-rotator）
 * 的实际产物里确认的形状，不是猜的。
 *
 * 所以这里用 esbuild 打成 IIFE，外面再裹一层 loader 外壳。
 *
 * 跑法：`npm run build`
 */

import { build } from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const ENTRY_ID = 'workbuddy-credits'

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
console.log(`已生成 dist/client.js（${kb} KB，entry id "${ENTRY_ID}"）`)
