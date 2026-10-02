/**
 * 非中文字符巡检 —— 我在写注释时偶尔会混入缅甸文/泰文之类的字符，
 * 肉眼几乎看不出来，所以用一个脚本机械地扫一遍源文件。
 *
 * 跑法：`node scripts/scan-text.mjs`
 */

import fs from 'node:fs'
import path from 'node:path'

/** 允许出现的字符类：ASCII、中日韩统一表意文字、中文标点、以及常用符号。 */
const ALLOWED =
  /^[\u0000-\u007F\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF\u2018-\u201F\u2026\u2014\u00B7\u2192\u2190\u2713\u2714\u2717\u00D7\u00B1\u2264\u2265\u25A0-\u25FF\u2600-\u26FF]*$/

const ROOT = path.resolve(import.meta.dirname, '..')
const EXCLUDED = new Set(['node_modules', '.git'])
const EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.json', '.md', '.yml'])

const findings = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    if (!EXTENSIONS.has(path.extname(entry.name))) continue
    const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      for (const ch of line) {
        if (!ALLOWED.test(ch)) {
          findings.push({
            file: path.relative(ROOT, full),
            line: index + 1,
            char: ch,
            code: 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'),
            text: line.trim().slice(0, 90),
          })
          break
        }
      }
    })
  }
}

walk(ROOT)

if (findings.length === 0) {
  console.log('未发现异常字符')
} else {
  console.log(`发现 ${findings.length} 处：\n`)
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  ${f.code}  ${JSON.stringify(f.char)}`)
    console.log(`   ${f.text}\n`)
  }
  process.exitCode = 1
}
