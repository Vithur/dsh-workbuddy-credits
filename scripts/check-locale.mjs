/**
 * 字典键校验 —— 中英两本字典必须键完全一致。
 *
 * 少一个键，界面上就会露出裸的 key 名（例如直接显示 `modelRates`），
 * 这种问题在运行时很难一眼看出，所以放在这里机械地卡住。
 *
 * 跑法：`node scripts/check-locale.mjs`
 */

import { assertParity } from '../client/locale.js'

const { missingInEn, missingInZh } = assertParity()

if (missingInEn.length === 0 && missingInZh.length === 0) {
  console.log('中英字典键一致')
} else {
  if (missingInEn.length) console.error(`英文缺键：${missingInEn.join(', ')}`)
  if (missingInZh.length) console.error(`中文缺键：${missingInZh.join(', ')}`)
  process.exitCode = 1
}
