/**
 * 把本插件接到 DSH profile 的 node_modules 上。
 *
 * ## 为什么需要这个脚本
 *
 * `plugin_manager install_bundle file:<本地目录>` 会把插件**拷贝**进
 * `node_modules/dsh-workbuddy-credits`。之后改工作区里的源码，已安装的那份不会
 * 跟着变；再跑一次安装，pnpm 只会说「Already up to date」——它按版本号判断，
 * 不看内容。于是「改了代码但界面没变」这种假象就出现了。
 *
 * 这里改成**目录联接（junction）**：已安装的位置直接指向工作区目录，改完即生效，
 * HMR 也能立刻捡到。`--copy` 可以退回拷贝模式（不想让 node_modules 里出现链接时用）。
 *
 * 跑法：`node scripts/sync-install.mjs`（或 `npm run link`）
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PACKAGE_NAME = 'dsh-workbuddy-credits'
const here = path.resolve(import.meta.dirname, '..')
const profileDir = process.env.DSH_PROFILE_DIR ?? path.join(os.homedir(), '.dsh', 'profiles', 'desktop')
const target = path.join(profileDir, 'node_modules', PACKAGE_NAME)
const useCopy = process.argv.includes('--copy')

/** 需要被安装的条目：运行期真正会读的那些。 */
const ENTRIES = ['index.js', 'package.json', 'cordis.patch.yml', 'src', 'shared', 'dist', 'client', 'README.md', 'LICENSE']

if (!fs.existsSync(profileDir)) {
  console.error(`找不到 profile 目录：${profileDir}`)
  process.exit(1)
}

/** 现在的安装位置是什么形态。 */
function describe() {
  if (!fs.existsSync(target)) return 'missing'
  const stat = fs.lstatSync(target)
  if (stat.isSymbolicLink()) {
    const link = fs.readlinkSync(target)
    return `link -> ${link}`
  }
  return 'directory'
}

console.log(`工作区：${here}`)
console.log(`安装位：${target}`)
console.log(`当前形态：${describe()}`)

// 只在确实是本插件、且确实是待替换的目录/链接时才动它，避免误删别人的包。
if (fs.existsSync(target)) {
  const stat = fs.lstatSync(target)
  const real = fs.realpathSync(target)
  const looksLikeUs = fs.existsSync(path.join(real, 'index.js'))
    && fs.readFileSync(path.join(real, 'package.json'), 'utf8').includes(`"${PACKAGE_NAME}"`)
  if (!looksLikeUs) {
    console.error(`拒绝操作：${target} 看起来不是 ${PACKAGE_NAME}，请人工确认`)
    process.exit(1)
  }
  if (stat.isSymbolicLink() && real === here && !useCopy) {
    console.log('已经是联接，且指向本工作区 —— 无需改动')
    process.exit(0)
  }
  fs.rmSync(target, { recursive: true, force: true })
  console.log('已移除旧的安装副本')
}

if (useCopy) {
  fs.mkdirSync(target, { recursive: true })
  for (const entry of ENTRIES) {
    const from = path.join(here, entry)
    if (!fs.existsSync(from)) continue
    fs.cpSync(from, path.join(target, entry), { recursive: true })
  }
  console.log(`已拷贝 ${ENTRIES.length} 个条目`)
} else {
  fs.symlinkSync(here, target, 'junction')
  console.log('已建立目录联接（junction）—— 以后改工作区源码即时生效')
}

console.log(`完成，当前形态：${describe()}`)
