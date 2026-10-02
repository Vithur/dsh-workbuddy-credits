/**
 * 中英文字典。
 *
 * 键值按用途命名，方便查漏。两个语言必须键完全一致 ——
 * 少了任何一个键，界面上就会露出裸的 key 名。
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
  updatedAt: '更新于',

  // 页头
  balancePage: '积分余额',
  balanceHint: '账户总览、用量明细与积分扣除历史',

  // 一行总览
  totalBalance: '账户合计',
  ofCapacity: '总额',
  expiring: '即将过期',
  totalCredits: '本期积分',
  requests: '请求数',
  failed: '失败',
  allOk: '全部成功',
  totalTokens: '总 token',
  cacheHit: '缓存命中率',
  since: '统计起点',

  // 模型倍率
  modelRates: '模型倍率',
  modelRatesHint: '已添加模型与网关当前倍率的对应关系，按倍率降序',
  model: '模型',
  multiplier: '倍率',
  creditsCol: '积分',
  tokensCol: 'token',
  unused: '本期无用量',
  unknownRate: '未知',

  // 小时趋势
  hourlyTrend: '小时趋势',
  hourlyTrendHint: '每个小时的积分消耗',

  // 积分扣除历史
  creditHistory: '积分扣除历史',
  byAccount: '按账号',
  byModel: '按模型',
  account: '账号',
  creditsDeducted: '扣除积分',
  creditsDeductedHint: '按上游 usage.credit 累计',
  matchedTokens: '匹配 Token',
  matchedTokensHint: '与积分同时观测到的 Token',
  avgPer1m: '平均积分 / 1M Token',
  avgPer1mHint: '越低越划算',
  creditSamples: '有效积分样本',
  creditSamplesHint: '缺字段的历史不参与折算',
  cacheHitHint: '上游前缀缓存命中 / (命中+未命中)；低命中意味着费用数倍放大',
  sampleTokens: '有效样本 Token',
  per1m: '积分 / 1M Token',
  creditEmpty: '暂无积分扣除记录；升级前仅含 Token 的历史不会伪造积分。',
  unitAccounts: '个账号',
  unitModelGroups: '个模型倍率分组',
  creditOnlyObserved: '仅统计与积分同时观测到的 Token',

  // 明细表与说明
  noData: '暂无数据',
  scopeNote: '网关按小时聚合，不区分会话：此处为本期整体消耗，非单个会话的量。',
}

export const DICT_EN = {
  pillPeriodHint: 'Whole period',

  loading: 'Loading',
  unreachable: 'Gateway unreachable',
  retry: 'Retry',
  updatedAt: 'Updated',

  balancePage: 'Credit balance',
  balanceHint: 'Account overview, usage detail, and credit deduction history',

  totalBalance: 'All accounts',
  ofCapacity: 'of',
  expiring: 'expiring',
  totalCredits: 'Credits spent',
  requests: 'Requests',
  failed: 'failed',
  allOk: 'all succeeded',
  totalTokens: 'Total tokens',
  cacheHit: 'Cache hit',
  since: 'Since',

  modelRates: 'Model rates',
  modelRatesHint: 'Configured models matched against the gateway current multiplier, priciest first',
  model: 'Model',
  multiplier: 'Rate',
  creditsCol: 'Credits',
  tokensCol: 'Tokens',
  unused: 'No usage this period',
  unknownRate: 'Unknown',

  hourlyTrend: 'Hourly trend',
  hourlyTrendHint: 'Credits consumed each hour',

  creditHistory: 'Credit deduction history',
  byAccount: 'By account',
  byModel: 'By model',
  account: 'Account',
  creditsDeducted: 'Credits deducted',
  creditsDeductedHint: 'Summed from upstream usage.credit',
  matchedTokens: 'Matched tokens',
  matchedTokensHint: 'Tokens observed alongside a credit figure',
  avgPer1m: 'Avg credits / 1M tokens',
  avgPer1mHint: 'Lower is cheaper',
  creditSamples: 'Valid credit samples',
  creditSamplesHint: 'History missing the field is excluded',
  cacheHitHint: 'Upstream prefix-cache hit / (hit + miss); a low rate multiplies cost',
  sampleTokens: 'Sample tokens',
  per1m: 'Credits / 1M tokens',
  creditEmpty: 'No credit deductions recorded yet; token-only history never fabricates credits.',
  unitAccounts: 'accounts',
  unitModelGroups: 'model rate groups',
  creditOnlyObserved: 'counts only tokens observed alongside credits',

  noData: 'No data',
  scopeNote: 'The gateway aggregates hourly and has no session dimension: this is the whole period, not one session.',
}

/** 断言两本字典键一致 —— 由 scripts/check-locale.mjs 调用。 */
export function assertParity() {
  const zh = Object.keys(DICT_ZH).sort()
  const en = Object.keys(DICT_EN).sort()
  const missingInEn = zh.filter((k) => !en.includes(k))
  const missingInZh = en.filter((k) => !zh.includes(k))
  return { missingInEn, missingInZh }
}
