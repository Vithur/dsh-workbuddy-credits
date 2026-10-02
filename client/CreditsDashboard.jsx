/**
 * 「积分余额」设置页 —— 账户总览 + 用量明细 + 积分扣除历史。
 *
 * 布局（用户指定）：
 *
 * 1. **一行总览** —— 账户合计与四张本期 KPI 同排，不再铺账户卡片。
 * 2. **小时趋势** —— 什么时候花得最多（一根柱 = 一小时）。
 * 3. **模型倍率** —— 已添加的模型逐个对着网关倍率，贵的排在最上面。
 * 4. **积分扣除历史** —— 照搬网关面板那个板块：按账号 / 按模型两个维度、
 *    五张折算卡与完整表格（倍率、请求、扣除积分、有效样本 Token、
 *    积分 / 1M Token、缓存命中率）。
 *
 * 第 4 段的格式化逐值对齐网关面板自身（见 `format.js` 的 gateway* 系列），
 * 所以同一个数字在网关页和这里长得一样。
 *
 * 底部一行说明不能省：网关按小时聚合、没有会话维度，也没有人民币价格。
 *
 * @module client/CreditsDashboard.jsx
 */

import React from 'react'

const page = {
  fontFamily: 'inherit',
  fontSize: '13px',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
  padding: '20px',
  color: 'var(--text-primary, currentColor)',
}

const card = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid var(--border, rgba(128,128,128,.22))',
  background: 'var(--surface, rgba(128,128,128,.05))',
  minWidth: 0,
}

const cardLabel = { fontSize: '11px', opacity: 0.65, marginBottom: '4px' }
const cardValue = { fontSize: '18px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }
const cardSub = { fontSize: '11px', opacity: 0.55, marginTop: '2px' }

const section = { display: 'flex', flexDirection: 'column', gap: '8px' }
const sectionTitle = { fontSize: '12px', fontWeight: 600, opacity: 0.85 }
const hint = { fontSize: '12px', opacity: 0.6 }

const table = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' }
const th = {
  textAlign: 'left',
  fontWeight: 500,
  opacity: 0.55,
  padding: '4px 8px',
  borderBottom: '1px solid var(--border, rgba(128,128,128,.18))',
  whiteSpace: 'nowrap',
}
const thNum = { ...th, textAlign: 'right' }
const td = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--border, rgba(128,128,128,.10))',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}
const tdNum = { ...td, textAlign: 'right' }
const tdName = { ...td, whiteSpace: 'normal', wordBreak: 'break-all', maxWidth: '240px' }

/** 一行放账户合计 + 四张 KPI —— 用户要求合并成一行。 */
const overviewRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: '10px',
}
const creditKpiRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '10px',
}
const barTrack = { height: '6px', borderRadius: '99px', background: 'rgba(128,128,128,.22)', overflow: 'hidden' }

/** 四角星积分图标 —— 与状态栏 pill、账户合计同一形状。 */
export function CreditMark({ size = 22 }) {
  return React.createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
    React.createElement('path', { d: 'M12 1.7l1.7 6.6L20.3 10l-6.6 1.7L12 18.3l-1.7-6.6L3.7 10l6.6-1.7L12 1.7z', fill: 'currentColor' }),
  )
}

function Bar({ value, max, label, title }) {
  const ratio = max > 0 ? Math.max(0.02, value / max) : 0
  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }, title },
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'flex-end', height: '56px', width: '100%' } },
      React.createElement('div', {
        style: {
          width: '100%',
          height: `${ratio * 100}%`,
          borderRadius: '3px 3px 0 0',
          background: 'var(--accent, #4c8dff)',
          opacity: value > 0 ? 0.9 : 0.25,
        },
      }),
    ),
    React.createElement('span', { style: { fontSize: '10px', opacity: 0.6 } }, label),
  )
}

function Kpi({ label, value, sub, accent }) {
  return React.createElement(
    'div',
    { style: { ...card, ...(accent ? { borderLeft: `3px solid ${accent}` } : {}) } },
    React.createElement('div', { style: cardLabel }, label),
    React.createElement('div', { style: cardValue }, value),
    sub ? React.createElement('div', { style: cardSub }, sub) : null,
  )
}

function ModelRateTable({ matches, t, fmt }) {
  if (!matches?.length) return null
  return React.createElement(
    'div',
    { style: section },
    React.createElement('div', { style: sectionTitle }, t('modelRates')),
    React.createElement('div', { style: hint }, t('modelRatesHint')),
    React.createElement(
      'table',
      { style: table },
      React.createElement(
        'thead',
        null,
        React.createElement(
          'tr',
          null,
          React.createElement('th', { style: th }, t('model')),
          React.createElement('th', { style: th }, t('multiplier')),
          React.createElement('th', { style: thNum }, t('requests')),
          React.createElement('th', { style: thNum }, t('creditsCol')),
          React.createElement('th', { style: thNum }, t('tokensCol')),
        ),
      ),
      React.createElement(
        'tbody',
        null,
        matches.map((m) =>
          React.createElement(
            'tr',
            { key: m.id },
            React.createElement('td', { style: tdName }, m.id),
            React.createElement(
              'td',
              { style: { ...td, color: m.multiplier === 0 ? 'var(--success, #30a46c)' : undefined } },
              m.known ? fmt.multiplier(m.multiplier) : t('unknownRate'),
            ),
            React.createElement('td', { style: tdNum }, m.requests > 0 ? fmt.tokens(m.requests) : '—'),
            React.createElement('td', { style: tdNum }, m.requests > 0 ? fmt.gatewayCredit(m.credits) : t('unused')),
            React.createElement('td', { style: tdNum }, m.requests > 0 ? fmt.compact(m.tokens) : '—'),
          ),
        ),
      ),
    ),
  )
}

function HourlyTrend({ series, t, fmt }) {
  if (!series?.length) return null
  const max = Math.max(...series.map((point) => point.credits), 0.0001)
  return React.createElement(
    'div',
    { style: section },
    React.createElement('div', { style: sectionTitle }, t('hourlyTrend')),
    React.createElement('div', { style: hint }, t('hourlyTrendHint')),
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'flex-end', gap: '4px' } },
      series.map((point) =>
        React.createElement(Bar, {
          key: point.t,
          value: point.credits,
          max,
          label: fmt.hourLabel(point.t),
          title: `${fmt.hourLabel(point.t)} · ${fmt.gatewayCredit(point.credits)} · ${fmt.tokens(point.requests)} 次请求`,
        }),
      ),
    ),
  )
}

/** 缓存命中率单元格：带健康色与命中/未命中绝对量。 */
function CacheCell({ row, fmt }) {
  const text = fmt.cacheRate(row.cacheHitTokens, row.cacheMissTokens)
  if (text === fmt.EMPTY) return React.createElement('span', { style: { opacity: 0.5 } }, text)
  return React.createElement(
    'span',
    {
      style: { color: fmt.cacheColor(row.cacheHitTokens, row.cacheMissTokens) },
      title: `命中 ${fmt.gatewayTokens(row.cacheHitTokens)} / 未命中 ${fmt.gatewayTokens(row.cacheMissTokens)} tok`,
    },
    text,
  )
}

/**
 * 积分扣除历史 —— 照搬网关面板：按账号 / 按模型两个维度共用一张表。
 *
 * 两个维度列数不同（模型多一列倍率），所以表头按维度切换。
 */
function CreditHistory({ snapshot, t, fmt }) {
  const [dimension, setDimension] = React.useState('model')
  const totals = snapshot?.creditTotals
  const models = snapshot?.creditModels ?? []
  const accounts = snapshot?.creditAccounts ?? []
  const rows = dimension === 'model' ? models : accounts

  const tabs = [
    { id: 'account', label: t('byAccount'), count: accounts.length },
    { id: 'model', label: t('byModel'), count: models.length },
  ]

  const tabBar = React.createElement(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
    React.createElement('span', { style: { ...sectionTitle, marginRight: '2px' } }, t('creditHistory')),
    tabs.map((tab) =>
      React.createElement(
        'button',
        {
          key: tab.id,
          type: 'button',
          onClick: () => setDimension(tab.id),
          style: {
            border: '1px solid var(--border, rgba(128,128,128,.25))',
            borderRadius: '6px',
            padding: '3px 9px',
            fontSize: '11.5px',
            cursor: 'pointer',
            background: dimension === tab.id ? 'var(--accent, #4c8dff)' : 'transparent',
            color: dimension === tab.id ? '#fff' : 'inherit',
          },
        },
        `${tab.label} ${tab.count}`,
      ),
    ),
    React.createElement(
      'span',
      { style: { ...hint, marginLeft: 'auto' } },
      `${accounts.length} ${t('unitAccounts')} · ${models.length} ${t('unitModelGroups')} · ${t('creditOnlyObserved')}`,
    ),
  )

  const kpis = totals
    ? React.createElement(
        'div',
        { style: creditKpiRow },
        React.createElement(Kpi, {
          label: t('creditsDeducted'),
          value: fmt.gatewayCredit(totals.credits),
          sub: t('creditsDeductedHint'),
          accent: 'var(--accent, #4c8dff)',
        }),
        React.createElement(Kpi, {
          label: t('matchedTokens'),
          value: fmt.gatewayTokens(totals.creditTokens),
          sub: t('matchedTokensHint'),
        }),
        React.createElement(Kpi, {
          label: t('avgPer1m'),
          value: fmt.gatewayCreditRatio(totals.creditsPer1m, totals.creditSamples, totals.creditTokens),
          sub: t('avgPer1mHint'),
          accent: 'var(--success, #30a46c)',
        }),
        React.createElement(Kpi, {
          label: t('creditSamples'),
          value: String(totals.creditSamples || 0),
          sub: t('creditSamplesHint'),
        }),
        React.createElement(Kpi, {
          label: t('cacheHit'),
          value: fmt.cacheRate(totals.cacheHitTokens, totals.cacheMissTokens),
          sub: t('cacheHitHint'),
        }),
      )
    : null

  const head = React.createElement(
    'thead',
    null,
    React.createElement(
      'tr',
      null,
      React.createElement('th', { style: th }, dimension === 'model' ? t('model') : t('account')),
      dimension === 'model' ? React.createElement('th', { style: th }, t('multiplier')) : null,
      React.createElement('th', { style: thNum }, t('requests')),
      React.createElement('th', { style: thNum }, t('creditsDeducted')),
      React.createElement('th', { style: thNum }, t('sampleTokens')),
      React.createElement('th', { style: thNum }, t('per1m')),
      React.createElement('th', { style: thNum }, t('cacheHit')),
    ),
  )

  const body = React.createElement(
    'tbody',
    null,
    rows.length === 0
      ? React.createElement(
          'tr',
          null,
          React.createElement('td', { style: { ...td, opacity: 0.6 }, colSpan: dimension === 'model' ? 7 : 6 }, t('creditEmpty')),
        )
      : rows.map((row) =>
          React.createElement(
            'tr',
            { key: `${dimension}:${row.key}` },
            React.createElement(
              'td',
              { style: tdName },
              dimension === 'model'
                ? row.key
                : React.createElement(
                    React.Fragment,
                    null,
                    row.nickname || row.key.slice(0, 8) || '—',
                    React.createElement(
                      'div',
                      { style: { fontSize: '10.5px', opacity: 0.55 } },
                      `${row.realm || ''} · ${row.key.slice(0, 8)}`,
                    ),
                  ),
            ),
            dimension === 'model' ? React.createElement('td', { style: td }, fmt.gatewayRate(row.rate)) : null,
            React.createElement('td', { style: tdNum }, fmt.gatewayTokens(row.requests)),
            React.createElement('td', { style: tdNum }, fmt.gatewayCredit(row.credits)),
            React.createElement('td', { style: tdNum }, fmt.gatewayTokens(row.creditTokens)),
            React.createElement('td', { style: tdNum }, fmt.gatewayCreditRatio(row.creditsPer1m, row.creditSamples, row.creditTokens)),
            React.createElement('td', { style: tdNum }, React.createElement(CacheCell, { row, fmt })),
          ),
        ),
  )

  return React.createElement(
    'div',
    { style: section },
    tabBar,
    kpis,
    React.createElement('table', { style: table }, head, body),
  )
}

/** 设置页主体。 */
export function CreditsDashboard({ t, fmt, useSnapshot, pollMs, ...rest }) {
  const { snapshot, error, loading, refresh, at } = useSnapshot({ pollMs })
  const totals = snapshot?.totals
  const balances = snapshot?.balances ?? []

  const state = React.useMemo(() => {
    if (error) return { kind: 'error', text: error }
    if (!snapshot) return { kind: 'loading', text: t('loading') }
    if (snapshot.ok === false) return { kind: 'error', text: snapshot.error ?? t('unreachable') }
    if (!totals && balances.length === 0) return { kind: 'empty', text: t('noData') }
    return { kind: 'ready' }
  }, [error, snapshot, totals, balances.length, t])

  if (state.kind === 'loading') {
    return React.createElement('div', { style: { ...page, opacity: 0.7, ...rest } }, state.text)
  }
  if (state.kind === 'error' || state.kind === 'empty') {
    return React.createElement(
      'div',
      { style: { ...page, gap: '10px', ...rest } },
      React.createElement('h2', { style: { margin: 0, fontSize: '15px', color: state.kind === 'error' ? 'var(--danger, #e5484d)' : undefined } }, t('balancePage')),
      React.createElement('div', { style: { fontSize: '12px', opacity: 0.7 } }, state.text),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: refresh,
          style: {
            alignSelf: 'flex-start',
            padding: '5px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border, rgba(128,128,128,.3))',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '12px',
          },
        },
        t('retry'),
      ),
    )
  }

  const totalCredits = balances.reduce((sum, item) => sum + item.credits, 0)
  const totalCapacity = balances.reduce((sum, item) => sum + item.creditsTotal, 0)
  const totalExpiring = balances.reduce((sum, item) => sum + item.creditsExpiring, 0)
  const remainingPercent = totalCapacity > 0 ? (totalCredits / totalCapacity) * 100 : 0

  return React.createElement(
    'div',
    { style: { ...page, ...rest } },
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      React.createElement(CreditMark, { size: 26 }),
      React.createElement(
        'div',
        null,
        React.createElement('h2', { style: { margin: 0, fontSize: '15px' } }, t('balancePage')),
        React.createElement('p', { style: { ...hint, margin: 0 } }, t('balanceHint')),
      ),
      at ? React.createElement('span', { style: { ...hint, marginLeft: 'auto' } }, `${t('updatedAt')} ${fmt.relativeTime(new Date(at).toISOString())}`) : null,
    ),

    // —— 一行总览：账户合计 + 四张本期 KPI ——
    React.createElement(
      'div',
      { style: overviewRow },
      React.createElement(
        'div',
        { style: { ...card, display: 'flex', flexDirection: 'column', justifyContent: 'center' } },
        React.createElement('div', { style: { ...cardLabel, display: 'flex', alignItems: 'center', gap: '6px' } },
          React.createElement(CreditMark, { size: 15 }),
          t('totalBalance'),
        ),
        React.createElement('div', { style: cardValue }, fmt.credits(totalCredits)),
        React.createElement('div', { style: barTrack }, React.createElement('div', {
          style: {
            width: `${remainingPercent}%`,
            height: '100%',
            background: remainingPercent < 20 ? 'var(--danger, #e5484d)' : 'var(--accent, #4c8dff)',
          },
        })),
        React.createElement('div', { style: cardSub }, `${t('ofCapacity')} ${fmt.credits(totalCapacity)} · ${t('expiring')} ${fmt.credits(totalExpiring)}`),
      ),
      React.createElement(Kpi, {
        label: t('totalCredits'),
        value: fmt.gatewayCredit(totals?.credits),
        sub: `${t('since')} ${fmt.hourLabel(snapshot.since) || '—'}`,
      }),
      React.createElement(Kpi, {
        label: t('requests'),
        value: fmt.tokens(totals?.requests ?? 0),
        sub: totals?.errors > 0 ? `${t('failed')} ${fmt.tokens(totals.errors)}` : t('allOk'),
      }),
      React.createElement(Kpi, { label: t('totalTokens'), value: fmt.compact(totals?.total_tokens ?? 0) }),
      React.createElement(Kpi, { label: t('cacheHit'), value: fmt.percent(totals?.cache_hit_rate ?? 0, 1) }),
    ),

    React.createElement(HourlyTrend, { series: snapshot.series, t, fmt }),
    React.createElement(ModelRateTable, { matches: snapshot.matches, t, fmt }),
    React.createElement(CreditHistory, { snapshot, t, fmt }),

    React.createElement('div', { style: { ...hint, borderTop: '1px solid var(--border, rgba(128,128,128,.14))', paddingTop: '8px', lineHeight: 1.6 } }, t('scopeNote')),
  )
}
