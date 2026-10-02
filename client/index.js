/**
 * 浏览器半身入口。
 *
 * 两个挂载点，对应两处显示：
 *
 * | 位置 | slot | 显示什么 |
 * | --- | --- | --- |
 * | 输入框下方状态栏（最左） | `conversation.composer.dock` | 积分消耗 pill，与原生 `tok/s`、`缓存命中` 同行同款 |
 * | 设置页菜单「积分余额」 | `settings.section` | 账户余额 + 完整用量明细 |
 *
 * 推理等级**不在这里**：它由 Host 半身把网关声明的档位同步进 `llm-pi-ai` 配置，
 * 模型菜单就会原生渲染官方那套 Off/Low/High/Max —— 不替换任何内置控件。
 *
 * @module client/index.js
 */

import React from 'react'
import { LOCALE_NS, DEFAULT_POLL_MS, MIN_POLL_MS } from '../shared/constants.js'
import * as fmt from './format.js'
import { DICT_ZH, DICT_EN } from './locale.js'
import { useSnapshot } from './useSnapshot.js'
import { CreditsDashboard } from './CreditsDashboard.jsx'
import { CreditsPill } from './CreditsPill.jsx'

export const name = 'workbuddy-credits'

export function apply(ctx) {
  // 字典注册走 `ctx.effect` —— 与 dsh-context 完全相同的形状，卸载时自动撤回。
  ctx.effect(
    () =>
      ctx.locale.register(LOCALE_NS, {
        zh: DICT_ZH,
        en: DICT_EN,
      }),
    'workbuddy-credits: dictionaries',
  )
  const t = ctx.locale.bind(LOCALE_NS)

  // 两个挂载点都挂在 slots 注入 fiber 里：`slots` 缺席时整段不生效。
  ctx.inject(['slots'], (c) => {
    const slots = c.slots

    /**
     * 轮询间隔由插件设置提供；取不到就用常量兜底。
     * 下限卡在 MIN_POLL_MS —— 设置是自己配的，不排除有人填 500ms。
     */
    const pollMs = () => {
      const configured = ctx.settings?.get?.()?.pollMs
      return typeof configured === 'number' && configured >= MIN_POLL_MS ? configured : DEFAULT_POLL_MS
    }

    // — 输入框下方状态栏：积分消耗（排最左）—
    // order -1 排在原生 `stats`（order 0）之前；dock 是 flex 横排，所以积分在最左边。
    slots.inject('conversation.composer.dock', () =>
      slots.register(
        {
          name: 'conversation.composer.dock',
          id: 'workbuddy-credits',
          order: -1,
          locale: LOCALE_NS,
        },
        (props) =>
          React.createElement(CreditsPill, {
            ...props,
            t,
            fmt,
            useSnapshot,
            pollMs: pollMs(),
          }),
      ),
    )

    // — 设置页：积分余额（余额 + 明细） —
    slots.inject('settings.section', () =>
      slots.register(
        {
          name: 'settings.section',
          id: 'workbuddy-credits-balance',
          order: 12,
          label: () => t('balancePage'),
          locale: LOCALE_NS,
        },
        (props) =>
          React.createElement(CreditsDashboard, {
            ...props,
            t,
            fmt,
            useSnapshot,
            pollMs: pollMs(),
          }),
      ),
    )
  })
}
