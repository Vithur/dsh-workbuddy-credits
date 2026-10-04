/**
 * 中英字典一致性检查 —— 少一个键，界面上就会露出裸的 key 名。
 *
 * 跑法：`node scripts/check-locale.mjs`
 */

import assert from 'node:assert/strict'
import { assertParity } from '../client/locale.js'

const { missingInEn, missingInZh } = assertParity()

assert.deepEqual(missingInEn, [], `英文缺键：${missingInEn.join(', ')}`)
assert.deepEqual(missingInZh, [], `中文缺键：${missingInZh.join(', ')}`)

console.log('locale 键一致')