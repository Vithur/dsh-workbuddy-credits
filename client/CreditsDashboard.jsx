/**
 * 「积分余额」设置页 —— 三段，从上到下。
 *
 * | 段 | 仿谁 | 内容 |
 * | --- | --- | --- |
 * | 概览 | 外观设置的三栏立方体 | 剩余/总额、积分 / 1M Token、缓存命中率 |
 * | 模型 | 会话插件的可折叠卡 | 生效倍率低于阈值的全部模型 |
 * | 账号 | Agent 预设卡 | 国内 / 国际账号与限流状态 |
 *
 * ## 排版是照抄原生设置页的，不是自己发明的
 *
 * 数值全部来自 `app.asar` 里 `dsh-client-ui-*` 的实际 CSS：
 * 内容区 564px（面板 800 − 导航 188 − padding 48）、正文 13px/22px、
 * 卡片 `radius-xl` 20px + `settings-card-stroke` 的 0.5px hairline、
 * 卡片两列 `repeat(2, minmax(0,1fr))` gap 10px。改任何一项前先回去看原生。
 *
 * ## 三条硬约束
 *
 * 1. **没有自己的页头**。标题、描述、图标由原生设置菜单渲染，这里自己再画
 *    一次就是重复。
 * 2. **颜色只留给状态**。原生只有三级文字色 + 四个状态色，层级靠字号、字重、
 *    色深区分。把「免费」「国内」这类普通事实染成彩色，是在暗示它们更重要。
 * 3. **同一张卡里同一个数字只出现一次**。收起态已经显示的，展开区不再重复。
 *
 * ## 卡片必须能自己长出来
 *
 * 模型与账号都是从快照数组 map 出来的，没有任何写死的条目 —— 网关新增模型
 * 或账号后，下一次轮询就多一张卡，结构代码一行都不用动。
 *
 * @module client/CreditsDashboard.jsx
 */

import React from 'react'
import { LOW_RATE_THRESHOLD } from '../shared/constants.js'

const page = {
  fontFamily: 'inherit',
  fontSize: '13px',
  lineHeight: '22px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '8px 0',
  color: 'var(--dsw-alias-label-primary, inherit)',
  minWidth: 0,
}

/* ── 文字三级 + 状态色 ── */
const label = { primary: 'var(--dsw-alias-label-primary, inherit)', secondary: 'var(--dsw-alias-label-secondary, inherit)', tertiary: 'var(--dsw-alias-label-tertiary, inherit)' }
const state = { warn: 'var(--dsw-alias-state-warn-primary, #f2b94b)', error: 'var(--dsw-alias-state-error-primary, #e5484d)' }

/* ── 概览三栏 ── */
const cubeGroup = { display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0' }
const cubeGroupTitle = { fontSize: '14px', fontWeight: 400, lineHeight: '22px' }
const cubeRow = { display: 'flex', alignItems: 'stretch', gap: '8px' }
const cube = {
  flex: 1,
  minWidth: 0,
  border: '0.5px solid var(--dsw-alias-border-l4, rgba(128,128,128,.24))',
  borderRadius: 'var(--dsw-radius-xl, 20px)',
  background: 'transparent',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '4px',
  padding: '20px 12px',
  boxSizing: 'border-box',
}
const cubeValue = {
  fontSize: '22px',
  lineHeight: '28px',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-.01em',
  whiteSpace: 'nowrap',
}
const cubeLabel = { fontSize: '12px', lineHeight: '18px', color: label.secondary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/* ── 分组标题 ── */
const groupHead = { display: 'flex', alignItems: 'baseline', gap: '8px', minHeight: '36px' }
const groupTitle = { fontSize: '13px', fontWeight: 600, lineHeight: '22px' }
const groupSub = { fontSize: '12px', lineHeight: '18px', color: label.tertiary }

/* ── 卡片网格：显式两列 ── */
const cards = {
  display: 'grid',
  // 显式两列，不能用 auto-fill：容器稍窄一点它就塌成一列，一长条很难扫。
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
}
const cardsPreset = { ...cards, gap: '12px' }

const cardShell = {
  border: '0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l4, rgba(128,128,128,.24)))',
  borderRadius: 'var(--dsw-radius-xl, 20px)',
  background: 'var(--dsw-alias-settings-card-fill, transparent)',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflow: 'hidden',
  transition: 'border-color .16s, background .16s',
}

/* ── 可折叠卡 ── */
const foldMain = {
  appearance: 'none',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  background: 'transparent',
  border: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: '12px 14px',
  alignItems: 'stretch',
}
const foldHead = { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }
const foldTitle = { flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 500, lineHeight: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const foldTrailing = { flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', color: label.tertiary }
const foldDesc = {
  fontSize: '12px',
  lineHeight: '18px',
  color: label.tertiary,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
}
const foldMeta = { marginTop: 'auto', paddingTop: '6px', display: 'flex' }
const foldDetails = { display: 'none', borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.12))', background: 'var(--dsw-alias-bg-module-platform, transparent)', padding: '10px 14px 12px' }
const facts = { display: 'grid', gridTemplateColumns: '68px minmax(0, 1fr)', gap: '6px 10px', margin: 0 }
const factKey = { fontSize: '11px', lineHeight: '17px', color: label.tertiary }
const factVal = { margin: 0, fontSize: '12px', lineHeight: '17px', color: label.secondary, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

/* ── 补充说明行：模型 chip 与账号 footer 共用，字形必须完全一致 ──
   `fontFamily: 'inherit'` 是必需的：模型那侧挂在 <code> 上过，浏览器给
   code 的默认字体是等宽体，漏掉这一行字号对上了字形仍然一眼不同。 */
const noteLine = {
  fontFamily: 'inherit',
  fontSize: '12px',
  lineHeight: '18px',
  fontWeight: 400,
  color: label.secondary,
  padding: '1px 6px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontVariantNumeric: 'tabular-nums',
}
const cardIdentity = { ...noteLine, borderRadius: 'var(--dsw-radius-xs, 4px)', background: 'var(--dsw-alias-bg-module-platform, transparent)', maxWidth: '100%' }
const footLink = { ...noteLine, borderRadius: 'var(--dsw-radius-sm, 8px)' }

/* ── Tag：胶囊 999px + corner-shape: round ──
   后者是必须的：原生用通配选择器全局施加 superellipse(1.5)，不写
   corner-shape: round 的话胶囊会被压成椭圆。
   配色档位见下面 `Tag` 的注释。 */
const tag = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  cornerShape: 'round',
  padding: '1px 8px',
  fontSize: '11px',
  lineHeight: '17px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
}
const tagOutline = { ...tag, border: '0.5px solid var(--dsw-alias-border-l4, rgba(128,128,128,.24))', color: label.tertiary }
const tagNeutral = { ...tag, background: 'var(--dsw-alias-bg-module-platform, transparent)', color: label.secondary }
const tagWarning = { ...tag, background: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f2b94b) 12%, transparent)', color: state.warn }

/**
 * 一枚 Tag。`tone` 同时写到 `data-tone` 上而不只是内联样式 ——
 * 内联样式没法在渲染结果里反查「这一枚用的是哪档配色」，而配色档位正是
 * 这个页面最容易被后来者加乱的地方，得能测。
 */
function Tag({ tone, children }) {
  const style = tone === 'warning' ? tagWarning : (tone === 'outline' ? tagOutline : tagNeutral)
  return React.createElement('span', { style, 'data-tone': tone }, children)
}

/* ── 账号卡 ── */
const presetMain = { padding: '14px 16px 12px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }
const presetHead = { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }
const presetName = { fontSize: '15px', fontWeight: 600, lineHeight: '1.4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }
const presetId = { flexShrink: 0, marginLeft: 'auto', fontFamily: 'var(--dsw-font-mono, ui-monospace, monospace)', fontSize: '11px', lineHeight: '21px', color: label.tertiary }
const presetDesc = { color: label.secondary, fontSize: '13px', lineHeight: '1.55', marginBlock: 'auto', overflowWrap: 'anywhere' }
const presetFoot = { borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.12))', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '6px 10px', justifyContent: 'flex-start' }

/* ── 刷新按钮：照 RotMhW_failure button ── */
const iconBtn = {
  border: '0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,.16))',
  borderRadius: 'var(--dsw-radius-sm, 8px)',
  color: label.primary,
  background: 'transparent',
  cursor: 'pointer',
  font: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  fontSize: '12px',
  lineHeight: '18px',
}
const headEnd = { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }

const empty = { fontSize: '13px', lineHeight: '20px', color: label.tertiary, padding: '12px 2px' }

/** 折叠箭头：展开时旋转 180°。尺寸跟原生 IconChevronDownOutlineRegular 的 12。 */
function Chevron({ open }) {
  return React.createElement(
    'svg',
    {
      width: 12,
      height: 12,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      'aria-hidden': 'true',
      style: { flex: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .16s' },
    },
    React.createElement('path', { d: 'M4 6.5l4 4 4-4' }),
  )
}

/** 刷新图标。 */
function RefreshIcon() {
  return React.createElement(
    'svg',
    { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', style: { flex: 'none' } },
    React.createElement('path', { d: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9' }),
    React.createElement('path', { d: 'M13.2 2.6v2.6h-2.6' }),
  )
}

/** 数字转千分位；非有限值一律占位符，绝不显示 undefined / NaN。 */
function thousands(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : fmt.EMPTY
}

/** 概览三栏。`onRefresh` 触发的是整页重新取数，不只是顶部那三个数字。 */
function Overview({ snapshot, t, fmt }) {
  const accounts = snapshot.accountCards ?? []
  const credit = snapshot.creditTotals

  const totalCredits = accounts.reduce((sum, item) => sum + item.credits, 0)
  const totalCapacity = accounts.reduce((sum, item) => sum + item.creditsTotal, 0)

  return React.createElement(
    'div',
    { style: cubeGroup },
    React.createElement(
      'div',
      { style: groupHead },
      React.createElement('span', { style: cubeGroupTitle }, t('creditsGroup')),
      React.createElement(
        'span',
        { style: headEnd },
        React.createElement(
          'button',
          {
            type: 'button',
            style: iconBtn,
            onClick: snapshot.onRefresh,
            disabled: snapshot.loading === true,
            title: t('refreshHint'),
            'aria-busy': snapshot.loading === true,
          },
          React.createElement(RefreshIcon),
          React.createElement('span', null, snapshot.loading === true ? t('refreshing') : t('refresh')),
        ),
      ),
    ),
    React.createElement(
      'div',
      { style: cubeRow },
      React.createElement(
        'div',
        { style: cube },
        React.createElement('div', { style: cubeValue }, fmt.tokens(totalCredits), React.createElement('small', { style: { fontSize: '13px', fontWeight: 400, color: label.secondary } }, `/${fmt.tokens(totalCapacity)}`)),
        React.createElement('div', { style: cubeLabel }, t('balanceRatio')),
      ),
      React.createElement(
        'div',
        { style: cube },
        React.createElement('div', { style: cubeValue }, fmt.rateNumber(credit?.creditsPer1m)),
        React.createElement('div', { style: cubeLabel }, t('avgPer1m')),
      ),
      React.createElement(
        'div',
        { style: cube },
        React.createElement('div', { style: cubeValue }, fmt.cacheRate(credit?.cacheHitTokens, credit?.cacheMissTokens), React.createElement('small', { style: { fontSize: '13px', fontWeight: 400, color: label.secondary } }, '')),
        React.createElement('div', { style: cubeLabel }, t('cacheHit')),
      ),
    ),
  )
}

/** 模型卡：收起态显示倍率与积分，展开态只补收起时看不到的三项。 */
function ModelCard({ row, t, fmt }) {
  const [open, setOpen] = React.useState(false)
  const supports = [
    row.supportsToolCall ? t('capTool') : null,
    row.supportsImages ? t('capVision') : null,
    row.supportsReasoning ? t('capThinking') : null,
  ].filter(Boolean)
  const desc = [...supports, row.promoLabel].filter(Boolean).join(' · ') || fmt.EMPTY
  const detailId = React.useId()

  return React.createElement(
    'li',
    // 展开态的边框色必须与常态**同一个变量**，不能换成 border-l3。
    // 换成低一档时：折叠按钮自带 `border: 0`，浏览器会把这条 border-color
    // 当成未指定而回退到最亮的默认边框色 —— 实测描边从 86飙到 250（纯白），
    // 整排卡片像被点亮。所以展开只改底色，边框一律走cardShell。
    { style: cardShell },
    React.createElement(
      'button',
      {
        type: 'button',
        style: { ...foldMain, background: open ? 'var(--dsw-alias-interactive-bg-hover, transparent)' : 'transparent' },
        'aria-expanded': open,
        'aria-controls': detailId,
        onClick: () => setOpen((value) => !value),
      },
      React.createElement(
        'span',
        { style: foldHead },
        React.createElement('strong', { style: foldTitle, title: row.id }, row.id),
        React.createElement(
          'span',
          { style: foldTrailing },
          React.createElement(Tag, { key: 'rate', tone: 'neutral' }, fmt.rateNumber(row.multiplier)),
          React.createElement(Chevron, { open }),
        ),
      ),
      React.createElement('span', { style: { ...foldDesc, display: open ? 'block' : '-webkit-box' } }, desc),
      React.createElement(
        'span',
        { style: foldMeta },
        // 「32.92 积分」有歧义：是剩余、是倍率、还是本次消耗？写全才不含糊。
        React.createElement('span', { style: cardIdentity }, row.requests > 0 ? `${t('creditsDeducted')} ${fmt.gatewayCredit(row.credits)}` : t('noCredits')),
      ),
    ),
    React.createElement(
      'div',
      { id: detailId, style: { ...foldDetails, display: open ? 'block' : 'none' } },
      React.createElement(
        'dl',
        { style: facts },
        React.createElement('dt', { style: factKey }, t('requests')),
        React.createElement('dd', { style: factVal }, row.requests > 0 ? thousands(row.requests, fmt) : fmt.EMPTY),
        React.createElement('dt', { style: factKey }, t('cacheHit')),
        React.createElement('dd', { style: factVal }, fmt.cacheRate(row.cacheHitTokens, row.cacheMissTokens)),
        React.createElement('dt', { style: factKey }, t('per1mCredits')),
        React.createElement('dd', { style: factVal }, fmt.gatewayCreditRatio(row.creditsPer1m, 1, row.cacheHitTokens + row.cacheMissTokens)),
      ),
    ),
  )
}

/** 模型板块。数组是活的：网关新增模型后多一条就多一张卡。 */
function ModelSection({ models, t, fmt }) {
  const rows = models ?? []
  const rateText = `${LOW_RATE_THRESHOLD}`
  return React.createElement(
    'div',
    null,
    React.createElement(
      'div',
      { style: groupHead },
      React.createElement('span', { style: groupTitle }, t('model')),
      React.createElement('span', { style: groupSub }, `${t('underRate')} ${rateText} · ${rows.length} ${t('countUnit')}`),
    ),
    rows.length === 0
      ? React.createElement('div', { style: empty }, t('noLowRateModel'))
      : React.createElement(
          'ul',
          { style: cards },
          rows.map((row) => React.createElement(ModelCard, { key: row.id, row, t, fmt })),
        ),
  )
}

/** 账号名去掉邮箱后缀 —— `vithur0710@gmail.com` 读成 `vithur0710`。 */
function shortName(nickname) {
  return String(nickname ?? '').replace(/@.*$/, '')
}

/** 账号卡。 */
function AccountCard({ account, t, fmt }) {
  const isCn = account.realm === 'cn'
  const limited = account.limited ?? []
  const head = limited[0]
  const unlockAt = head ? (head.resetAt ?? head.until) : null

  let footer
  if (head) {
    footer = [
      React.createElement(Tag, { key: 'tag', tone: 'warning' }, `${head.model} ${t('rateLimited')}`),
      unlockAt === null ? null : React.createElement('span', { key: 'at', style: footLink, title: `${t('unlockAt')} ${fmt.clockAt(unlockAt)}` }, `${t('unlockAt')} ${fmt.clockAt(unlockAt)}`),
    ]
  } else {
    footer = React.createElement('span', { style: footLink }, t('available'))
  }

  return React.createElement(
    'li',
    { style: cardShell },
    React.createElement(
      'div',
      { style: presetMain },
      React.createElement(
        'div',
        { style: presetHead },
        React.createElement('span', { style: presetName, title: account.nickname }, shortName(account.nickname)),
        React.createElement(Tag, { key: 'realm', tone: 'outline' }, isCn ? t('realmCn') : t('realmGlobal')),
        React.createElement('span', { style: presetId }, account.realm),
      ),
      React.createElement(
        'div',
        { style: presetDesc },
        `${fmt.gatewayCredit(account.credits)}${account.creditsTotal > 0 ? ` / ${fmt.gatewayCredit(account.creditsTotal)}` : ''} ${t('creditsUnit')}`,
      ),
    ),
    React.createElement('div', { style: presetFoot }, footer),
  )
}

/** 账号板块。国内 / 国际混排，靠卡片上的 Tag 区分 —— 原生也是这么并列的。 */
function AccountSection({ accounts, t, fmt }) {
  const rows = accounts ?? []
  return React.createElement(
    'div',
    null,
    React.createElement(
      'div',
      { style: groupHead },
      React.createElement('span', { style: groupTitle }, t('accounts')),
      React.createElement('span', { style: groupSub }, `${rows.length} ${t('countUnit')}`),
    ),
    rows.length === 0
      ? React.createElement('div', { style: empty }, t('noAccounts'))
      : React.createElement(
          'ul',
          { style: cardsPreset },
          rows.map((account) => React.createElement(AccountCard, {
            key: account.uid || `${account.realm}-${account.nickname}`,
            account,
            t,
            fmt,
          })),
        ),
  )
}

/** 设置页主体。 */
export function CreditsDashboard({ t, fmt, useSnapshot, pollMs, ...rest }) {
  const { snapshot, error, loading, refresh } = useSnapshot({ pollMs })

  const state = React.useMemo(() => {
    if (error) return { kind: 'error', text: error }
    if (!snapshot) return { kind: 'loading', text: t('loading') }
    if (snapshot.ok === false) return { kind: 'error', text: snapshot.error ?? t('unreachable') }
    const empty = (snapshot.accountCards?.length ?? 0) === 0 && (snapshot.models?.length ?? 0) === 0
    if (empty) return { kind: 'empty', text: t('noData') }
    return { kind: 'ready' }
  }, [error, snapshot, t])

  if (state.kind === 'loading') {
    return React.createElement('div', { style: { ...page, opacity: 0.7, ...rest } }, state.text)
  }

  if (state.kind === 'error' || state.kind === 'empty') {
    return React.createElement(
      'div',
      { style: { ...page, gap: '10px', ...rest } },
      React.createElement('div', { style: { fontSize: '13px', color: state.kind === 'error' ? state.error : undefined } }, state.text),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: refresh,
          disabled: loading,
          style: { ...iconBtn, alignSelf: 'flex-start' },
        },
        t('retry'),
      ),
    )
  }

  return React.createElement(
    'div',
    { style: { ...page, ...rest } },
    // refresh 是 useSnapshot 给的整页重取：它换掉整份 snapshot，
    // 顶部三张卡、模型列表、账号列表一起更新，不只更新标题行那几个数。
    React.createElement(Overview, { snapshot: { ...snapshot, onRefresh: refresh, loading }, t, fmt }),
    React.createElement(ModelSection, { models: snapshot.models, t, fmt }),
    React.createElement(AccountSection, { accounts: snapshot.accountCards, t, fmt }),
  )
}