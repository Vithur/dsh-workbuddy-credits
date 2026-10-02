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
 * ## 两条硬约束（都是踩坑得来的）
 *
 * 1. **只能读 `inject` 里声明过的服务，且访问本身就是操作**。客户端 ctx 是**受限**
 *    Cordis 上下文：没声明的服务不是 `undefined`，而是属性读取直接抛
 *    `cannot get property "x" without inject` —— 所以 `ctx.settings?.get?.()` 这种
 *    可选链**挡不住**。不声明 `ctx.slots` / `ctx.locale` 就拿不到，`apply` 第一行就抛
 *    —— 条目 failed → **web boot 失败 → DSH 打不开**。
 *    已装插件全都声明了（`dsh-context` / `dsh-status-rotator` / `dsh-our-free-model`
 *    都是 `['slots', 'locale']`）。
 *
 * 2. **`apply` 不许抛**。客户端条目失败会直接让 web boot 失败，这是致命的。
 *    所以整个函数体包在 try/catch 里 —— 宁可插件不显示，也不能让 DSH 起不来。
 *    注意 try/catch 只覆盖 `apply` 自身：slot 的组件函数是**渲染期**才调用的，
 *    在那里抛（就是上面那条踩的坑）不会让 boot 失败，但会被 `SlotErrorBoundary`
 *    吞掉，表现成「插件显示已加载、界面却是一片空白」。
 *
 * 推理等级**不在这里**：它由 Host 半身把网关声明的档位同步进 `llm-pi-ai` 配置，
 * 模型菜单就会原生渲染网关声明的那几档 —— 不替换任何内置控件。
 *
 * @module client/index.js
 */

import React from 'react'
import { LOCALE_NS, DEFAULT_POLL_MS } from '../shared/constants.js'
import * as fmt from './format.js'
import { DICT_ZH, DICT_EN } from './locale.js'
import { useSnapshot } from './useSnapshot.js'
import { CreditsDashboard } from './CreditsDashboard.jsx'
import { CreditsPill } from './CreditsPill.jsx'

export const name = 'workbuddy-credits'

/**
 * 客户端 ctx 上必须存在的服务。
 *
 * 少一个都会让 `ctx.<name>` 变成 undefined，而下面的 `apply` 会立刻用到它们。
 * 这是本插件真实崩过 DSH 的原因之一，别删。
 */
export const inject = ['slots', 'locale']

export function apply(ctx) {
  // 客户端条目失败 = web boot 失败 = DSH 打不开。所以这里绝不允许异常逃出去。
  try {
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

    // 轮询间隔取常量：这里没有可读的配置服务（见上方硬约束 1）。
    // — 输入框下方状态栏：积分消耗（排最左）—
    // order -1 排在原生 `stats`（order 0）之前；dock 是 flex 横排，所以积分在最左边。
    ctx.slots.inject('conversation.composer.dock', () =>
      ctx.slots.register(
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
            pollMs: DEFAULT_POLL_MS,
          }),
      ),
    )

    // — 设置页：积分余额（余额 + 明细）—
    ctx.slots.inject('settings.section', () =>
      ctx.slots.register(
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
            pollMs: DEFAULT_POLL_MS,
          }),
      ),
    )
  } catch (error) {
    // 降级：插件不显示，但 DSH 必须能起来。
    // 注意用**全局** `console`，不是 `ctx.console` —— `console` 是客户端 Builtin
    // （和 `React` / `host` / `styles` 同级），不是 ctx 服务。写 `ctx.console` 会读
    // 一个未声明的属性而抛错，正好是上面硬约束 1 说的那个坑；已装插件全都用裸 `console`。
    try {
      console.error('workbuddy-credits: 界面未挂载', error)
    } catch {
      // 连日志通道都不可用，那就彻底安静。
    }
  }
}
