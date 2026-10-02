/**
 * 输入框下方状态栏的积分 pill —— 与原生 `48 tok/s`、`缓存命中 91%` 同一行。
 *
 * 样式逐值照抄原生 `StatsPills.module.css`（类名 `iq1doa_root` / `iq1doa_pill`），
 * 包括字号变量、行高变量、间距、内边距与图标尺寸 —— 用户要求「样式大小字体图标
 * 都沿用相同的样式」，所以这里不做任何近似，直接用同一组声明值。
 *
 * 数值来源：优先显示**当前会话选中模型**的积分消耗（会话在网关侧没有独立维度，
 * 网关只按小时/模型/账户聚合）。取不到会话模型时回落到本期整体消耗，并在
 * tooltip 里说明，绝不假装算出了单会话的量。
 *
 * @module client/CreditsPill.jsx
 */

import React from 'react'

/** 原生 pill 的根容器声明，逐值对齐 `iq1doa_root`。 */
const root = {
  boxSizing: 'border-box',
  minWidth: 0,
  maxWidth: '100%',
  fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 1px)',
  lineHeight: 'calc(20px + var(--dsh-content-font-delta-secondary, 0px))',
  justifyContent: 'center',
  gap: '12px',
  display: 'flex',
}

/** 原生单个 pill 的声明，逐值对齐 `iq1doa_pill`。 */
const pill = {
  boxSizing: 'border-box',
  maxWidth: '100%',
  color: 'var(--dsw-alias-label-tertiary)',
  font: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 'inherit',
  whiteSpace: 'nowrap',
  background: '0 0',
  border: 'none',
  borderRadius: '999px',
  alignItems: 'center',
  gap: '6px',
  padding: '1px 8px',
  display: 'inline-flex',
}

/** 原生 pill 内的图标尺寸：14×14，不参与收缩。 */
const icon = { flex: 'none', width: 14, height: 14 }

/**
 * 四角星积分图标 —— **线性**风格。
 *
 * 状态栏里原生那两个图标（转速表、数据库）都是描边线性的，所以这里也必须是
 * 描边而不是实心：实心块在一行线性图标里会显得比它们重一大截。
 * 线宽 1.6 与原生图标集的观感一致。
 */
function CreditStar() {
  return React.createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
      'aria-hidden': true,
      style: icon,
    },
    React.createElement('path', {
      d: 'M12 3.2l1.55 5.05a2 2 0 0 0 1.28 1.28L19.88 11l-5.05 1.55a2 2 0 0 0-1.28 1.28L12 18.88l-1.55-5.05a2 2 0 0 0-1.28-1.28L4.12 11l5.05-1.47a2 2 0 0 0 1.28-1.28L12 3.2z',
    }),
  )
}

/**
 * 解析本会话要显示的积分数字。
 *
 * @param {object|null} snapshot 网关快照
 * @param {object|undefined} modelSelection `modelSelection` 投影
 * @returns {{ value: number|null, scope: 'model'|'period', model: string|null }}
 */
export function resolveCredits(snapshot, modelSelection) {
  const model = modelSelection?.next?.model ?? modelSelection?.lastUsed?.model ?? null
  if (model) {
    const match = (snapshot?.matches ?? []).find((row) => row.id === model)
    if (match) return { value: match.credits, scope: 'model', model }
  }
  const total = snapshot?.totals?.credits
  return {
    value: typeof total === 'number' && Number.isFinite(total) ? total : null,
    scope: 'period',
    model,
  }
}

export function CreditsPill({ t, fmt, useSnapshot, pollMs, useProjection }) {
  const { snapshot, error } = useSnapshot({ pollMs })
  // 投影缺席（组合没有模型选择服务）时返回 undefined，下面的回落会接管。
  const modelSelection = typeof useProjection === 'function' ? useProjection('modelSelection') : undefined
  const { value, scope, model } = resolveCredits(snapshot, modelSelection)

  if (value === null) return null

  const title = scope === 'model' && model
    ? `${model}：本期消耗 ${fmt.credits(value)} 积分`
    : `${t('pillPeriodHint')}：${fmt.credits(value)} 积分`
  if (error) return null

  return React.createElement(
    'div',
    { style: root, 'data-composer-credits': true },
    React.createElement(
      'span',
      { style: pill, title },
      React.createElement(CreditStar),
      fmt.credits(value),
    ),
  )
}
