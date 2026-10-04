/**
 * 中英文字典。
 *
 * 键值按用途命名，方便查漏。两个语言必须键完全一致 ——
 * 少了任何一个键，界面上就会露出裸的key 名。
 *
 * ## 只写界面真正在读的词
 *
 * 这份字典服务于「设置页三段 + 状态栏 pill」，不是说明书。凡是「倍率怎么算的」
 * 「这个窗口多长」这类口径说明，一律不进界面 —— 网关改一次口径，界面上的
 * 说明就变成错的，而正确做法是让 Host 侧算出结果、界面只负责显示。
 *
 * @module client/locale.js
 */

export const DICT_ZH = {
  // 状态栏 pill
  pillPeriodHint: '本期整体消耗',

  // 通用状态
  loading: '读取中',
  unreachable: '网关不可达',
  retry: '重试',
  noData: '暂无数据',

  // 设置页菜单项
  balancePage: '积分余额',

  // 概览三栏
  creditsGroup: '积分',
  refresh: '刷新',
  refreshing: '同步中',
  refreshHint: '重新读取网关的全部数据',
  balanceRatio: '剩余 / 总额',
  avgPer1m: '积分 / 1M Token',
  cacheHit: '缓存命中率',

  // 模型板块
  model: '模型',
  multiplier: '倍率',
  requests: '请求',
  creditsDeducted: '扣除积分',
  noCredits: '本期无扣除',
  per1mCredits: '积分 / 1M Token',
  capTool: '工具',
  capVision: '视觉',
  capThinking: '思考常开',
  underRate: '生效倍率 ≤',
  countUnit: '个',
  noLowRateModel: '当前没有生效倍率低于阈值的模型',

  // 账号板块
  accounts: '账号',
  creditsUnit: '积分',
  realmCn: '国内',
  realmGlobal: '国际',
  available: '可用',
  rateLimited: '限流',
  unlockAt: '解封',
  noAccounts: '网关还没有账号',
}

export const DICT_EN = {
  pillPeriodHint: 'Whole period',

  loading: 'Loading',
  unreachable: 'Gateway unreachable',
  retry: 'Retry',
  noData: 'No data',

  balancePage: 'Credit balance',

  creditsGroup: 'Credits',
  refresh: 'Refresh',
  refreshing: 'Syncing',
  refreshHint: 'Re-read every value from the gateway',
  balanceRatio: 'Remaining / total',
  avgPer1m: 'Credits / 1M tokens',
  cacheHit: 'Cache hit',

  model: 'Models',
  multiplier: 'Rate',
  requests: 'Requests',
  creditsDeducted: 'Deducted',
  noCredits: 'Nothing deducted',
  per1mCredits: 'Credits / 1M tokens',
  capTool: 'Tools',
  capVision: 'Vision',
  capThinking: 'Thinking always on',
  underRate: 'Effective rate ≤',
  countUnit: 'total',
  noLowRateModel: 'No model is currently under the effective-rate threshold',

  accounts: 'Accounts',
  creditsUnit: 'credits',
  realmCn: 'China',
  realmGlobal: 'Global',
  available: 'Available',
  rateLimited: 'rate limited',
  unlockAt: 'Unlocks',
  noAccounts: 'The gateway has no accounts yet',
}

/** 断言两本字典键一致 —— 由 scripts/check-locale.mjs 调用。 */
export function assertParity() {
  const zh = Object.keys(DICT_ZH).sort()
  const en = Object.keys(DICT_EN).sort()
  const missingInEn = zh.filter((k) => !en.includes(k))
  const missingInZh = en.filter((k) => !zh.includes(k))
  return { missingInEn, missingInZh }
}