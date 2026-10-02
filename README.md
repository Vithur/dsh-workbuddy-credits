# dsh-workbuddy-credits

记录 **workbuddy2api** 网关的积分用量。这里的模型计费不是人民币规则，而是**积分倍率** —— 所以这个插件不去套任何价格表，而是直接读网关自己的倍率、余额与推理档位。

## 它显示什么

| 位置 | slot | 内容 |
| --- | --- | --- |
| **输入框下方状态栏（最左）** | `conversation.composer.dock` | 积分消耗 pill，排在原生 `tok/s`、`缓存命中` 左边 |
| **设置 → 积分余额** | `settings.section` | 账户总览 + 用量明细 + 积分扣除历史 |

侧边栏底部**不放任何东西**。

### 状态栏 pill

与原生 `StatsPills` 逐值同款（字号变量、行高变量、间距、内边距、图标 14×14），
`order: -1` 让它排在原生 `stats` 之前 —— 也就是那一行的**最左边**。
图标本身也是**描边线性**风格 —— 原生那两个（转速表、数据库）都是线性的，
放一个实心块进去会显得比它们重一大截。

数值口径：优先显示**当前会话选中模型**的积分消耗（读 `modelSelection` 投影）。
网关没有会话维度，取不到会话模型时回落到本期整体消耗 —— tooltip 会说明是哪一种，
不会假装算出了单会话的量。

### 设置页「积分余额」

1. **一行总览** —— 账户合计（含剩余占比条、即将过期）与四张本期 KPI 同排。
2. **小时趋势** —— 一根柱一小时。
3. **模型倍率** —— 已添加的模型逐个对着网关倍率，贵的排在最上面。
4. **积分扣除历史** —— 照搬网关面板那个板块：

   | 内容 | 来源 |
   | --- | --- |
   | 扣除积分 / 匹配 Token / 平均积分·1M / 有效积分样本 / 缓存命中率 | `totals.credits` / `credit_tokens` / `credits_per_1m_tokens` / `credit_samples` / `cache_hit_*` |
   | 按账号 · 按模型 两个维度的完整表 | `credit_by_account` / `credit_by_model` |

   格式化（`141.88M`、`x0.06`、`5.0522 / 1M`、命中率健康色 90/80 阈值）**逐值对齐网关面板自身**，
   所以同一个数字在网关页和这里长得一样。

## 推理等级：走官方原生菜单

档位选择在**输入框左侧的模型菜单**里，显示官方原版文字 `Off / Low / High / Max`，
不替换任何内置控件。

### 为什么之前不显示

DSH 的模型菜单读模型目录的 `reasoning.efforts`，那份元数据来自适配器的 `resolveModel()`。
`dsh-llm-pi-ai` 的规则是：

| 配置 | 结果 |
| --- | --- |
| `reasoningEfforts: false` | 声明为不支持推理 |
| `reasoningEfforts` 缺席 | 沿用内置目录的能力（手写模型没有 → 无档位） |
| `reasoningEfforts: { low: low, … }` | 每个键一个档位，值是**发给上游的线上拼写**；未声明的档位钉成 `null` |

原先配置里写的是 `reasoning: true` —— 这个字段不产生任何档位，这就是
「网关加进来的模型都不能改推理等级」的根因。

### 插件怎么做

插件在加载时算出每个模型的 `reasoningEfforts`，经 `ctx.configEditor.edit()`
写进 `llm-pi-ai` 配置，模型菜单就会**原生**渲染出档位 —— 与内置 DeepSeek 模型
同一套样式、同一套文字（档位名由适配器按 id 首字母大写生成，插件不自己起名）。

**档位完全以网关「模型与档位」页为准，不给任何保底档：**

| 网关页面显示 | 插件写入 |
| --- | --- |
| `low / high` | `{low, high}` |
| `high` | `{high}` |
| `low / high / max / off (可关)` | `{low, high, max, off}` |
| `固定档 · 默认 high` | **不写**（菜单里不出现档位选择器） |

判断依据就是网关的两个字段：`supported_efforts` 是可选档位，`can_disable_thinking`
为真时补上 `off`（页面显示成「off (可关)」）。所以只有一档的模型菜单里就只有一个，
两档就两个 —— 与网关页面完全一致。

其余规则：

- **只为网关清单里认得的模型写**；清单里没有的 id 不写，免得凭空承诺。
- **`Off` 发的是字面量 `"off"`**，不是「省略参数」。pi-ai 的约定里 `off` 配 `null`
  表示整段省略 reasoning 参数 —— 对这个网关就等于用它自己的默认档
  （`default_effort: high`），那 `Off` 就成了说了不算的控件。实测网关接受
  `reasoning_effort: "off"`，所以发字面量才是真的。
- **幂等**：算出来与现状一致时**不写盘**，不会每次加载都改配置文件。
- **只碰** `providers.<id>.models[].reasoningEfforts`，其他字段原样带过。
- 用 `syncReasoning: false` 可整体关掉，插件就完全不动配置。

### 上下文长度核对

`npm run check:context` 会把 profile 里已添加的模型与网关「模型与档位」页逐项比对
（上下文长度、最大输出）。两边按同一把尺子（1000 进制）显示，避免把
`393216 → 393K` 误判成差 9K。当前实测 **6 个模型全部一致**。

模型清单从 `cordis.patch.yml` **真读**，不写死 —— 用户随时会增删模型。

## 数据来源

| 接口 | 用途 |
| --- | --- |
| `GET /panel/api/models` | 倍率（`credits`）+ 推理等级（`supported_efforts`） |
| `GET /panel/api/usage` | 用量汇总与积分扣除历史 |
| `GET /panel/api/overview` | 账户余额、过期、请求状态、模型成本 |

`/v1/models` 作为倍率回退，兼容关闭面板路由的网关版本。

密钥只经 `credentials` 服务解析，**永不离开 Host 半身** —— 浏览器只拿得到 `/api` 围栏内的快照，
`route-test` 里有一条断言专门守这一点。

## 倍率的三种形态

| 形态 | 例子 | 解析为 |
| --- | --- | --- |
| `x` 前缀 | `x0.79` | `0.79` |
| `credits` 后缀 | `0.71 credits` | `0.71` |
| 零值 | `x0.00` | `0`（免费，而非未知） |

空字符串才判为**未知倍率**，与「免费」区分开。

DSH 配置的模型 id 带 realm 前缀（`cn:hy4-preview`），用量维度给的是裸名（`hy4-preview`）；
比对前统一剥离前缀并优先精确匹配 —— 不做这步，`cn:` 与 `global:` 两条同名路由会互相串数据。

## 安装

在 DSH 里用插件管理器从 GitHub 装：

```sh
dsh plugin --profile desktop add github:vithur/dsh-workbuddy-credits
```

或在插件市场里填 `github:vithur/dsh-workbuddy-credits`。

安装后需要**重启 DSH**：宿主插件模块在进程内只加载一次，装上不会当场生效。
浏览器半身可以热重载，宿主半身不行。

### 本地开发

```sh
npm run link          # 把工作区联接到 profile 的 node_modules（目录联接）
npm run link:copy     # 退回拷贝模式
```

用联接是因为 `plugin_manager install_bundle file:<目录>` 会**拷贝**进 node_modules，
之后改源码不生效；再跑一次 pnpm 只会说「Already up to date」——它按版本号判断、
不看内容，于是出现「改了代码但界面没变」的假象。

> 改 `index.js` / `src/` 后要重启 DSH；只改 `client/` 并重新 `npm run build` 则不用。

## 装不崩的保证

这个插件**真的把用户的 DSH 搞崩过一次**，所以下面两条不是口头承诺，而是机械验证的性质：

```sh
npm run preflight   # 94 项检查，退出码非 0 就**不要装**
```

| 性质 | 为什么 | 怎么验 |
| --- | --- | --- |
| **不导出 `Config`** | 宿主对没有 `Config` 的插件原样放行；一旦导出就必须是 schemastery schema，给错形状会走宿主的配置解析路径 —— **致命** | `preflight` 断言 `'Config' in mod === false`；`smoke` / `route-test` 各有一条 |
| **`apply` 永不抛异常** | 插件的失败不该有机会变成宿主的启动失败 | `preflight` 拿 **11 种恶意 ctx × 7 种畸形配置 = 77 种组合**跑 `apply`，全部必须正常返回 |
| **异步路径不产生未处理 rejection** | Node 会把未处理的 rejection 升级成进程级异常，这是「插件搞崩宿主」最典型的形态 | `preflight` 全程挂 `unhandledRejection` 监听，出现即判失败 |
| **Host 依赖链无外部包** | 外部依赖解析失败会让条目激活失败 | `preflight` 递归收集 `index.js` 的整条 import 链，断言全是相对路径 |

### 万一还是崩了：不依赖 DSH 的恢复

DSH 起不来时按这两步删，**不需要 DSH 能打开**：

1. 编辑 `~/.dsh/profiles/desktop/cordis.patch.yml`，删掉 `- id: workbuddy-credits` 那一行（含它下面的 `config:` 块）
2. 编辑 `~/.dsh/profiles/desktop/package.json`，把 `dependencies` 里的 `"dsh-workbuddy-credits"` 删掉，并把 `dsh.profile.bundles` 里的 `"dsh-workbuddy-credits"` 删掉
3. 可选：删掉 `~/.dsh/profiles/desktop/node_modules/dsh-workbuddy-credits` 目录

改完直接启动 DSH 即可 —— 它按这两份配置组装插件树，不依赖任何缓存。

### 安装后建议的验证顺序

```sh
npm run preflight   # 装之前先跑，通过再装
# 装上并重启 DSH
# 看一眼 GUI：状态栏最左应有积分 pill，设置页应有「积分余额」
```

宿主插件模块在进程内只加载一次，所以**装完必须重启**才生效；装完没反应不等于坏了。

## 配置

**插件刻意不导出 `Config`** —— 这一条是踩过坑才定下来的，详见文末「踩坑记录」。
所以没有自动生成的设置表单，配置写在 profile 的 `cordis.patch.yml` 里：

```yaml
- id: workbuddy-credits
  disabled: false
  config:
    baseUrl: http://192.168.1.42:7863
    syncReasoning: false
```

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `baseUrl` | `http://192.168.1.42:7863` | 网关地址 |
| `apiKeyRef` | `WORKBUDDY_API_KEY` | 凭据 ref（环境变量名） |
| `apiKey` | 空 | 仅当凭据读不到时的回落 |
| `providers` | 空 | 限定统计哪些 provider；留空表示全部 |
| `rowLimit` | `10` | 各维度表格最多显示行数 |
| `reasoningProvider` | `workbuddy` | 推理等级同步到哪个 provider |
| `syncReasoning` | **`false`** | 是否把 `reasoningEfforts` 写进 `llm-pi-ai` 配置 |

`syncReasoning` **默认关**：这是插件唯一会改动用户配置的行为，而改配置一旦写坏，
下一次启动就可能起不来。要开就显式写一行 `syncReasoning: true`。

## 开发

```sh
npm install
npm run build       # 打 dist/client.js
npm run verify      # 离线全量：字典 + 字符 + 解析 + 格式化 + 推理 + 路由 + 产物 + 装载
npm test            # 解析 + 格式化 + 推理 + 路由
npm run smoke       # 产物形状
npm run mount       # 模拟宿主装载

$env:WORKBUDDY_API_KEY = "wb2a_..."
npm run test:live      # 对真实网关跑端到端（模型清单读自真配置）
npm run check:context  # 已添加模型 vs 网关「模型与档位」页的上下文/最大输出
npm run probe:efforts  # 实测网关接受哪些 reasoning_effort 值（用免费模型）
```

### 六层测试各守什么

| 层 | 抓什么 |
| --- | --- |
| `test-parse` | 倍率三种形态、realm 前缀、积分扣除口径（`credit_tokens` 而非 `total_tokens`） |
| `test-format` | 与网关面板逐值一致的缩写规则、命中率健康色阈值 |
| `test-reasoning` | 档位以网关为准、`off` 的线上拼写、幂等、不碰其他字段 |
| `route-test` | **不导出 `Config`**、默认不改配置、路由两条分支、密钥不外泄 |
| `smoke` | 产物 loader 形状、patch 三处 id 一致、**不导出 `Config`** |
| `mount-test` | 产物当**真模块**装载、`apply` 真跑、各挂载点真渲染 |

## 踩坑记录

这些都是真发生过的，写下来免得重犯。

### 导出 `Config` 会让 DSH 直接打不开

`Config` 必须是 **schemastery schema**，普通对象和自实现的 Standard Schema 都不行：

| 写法 | 后果 |
| --- | --- |
| 普通对象 | Cordis `_resolveConfig` 读 `undefined.validate` → 条目激活失败 |
| 自实现 Standard Schema | Cordis 过了，但设置服务投影时调 `schema.toJSON()` → **DSH 起不来** |
| 不导出（本插件的选择） | Cordis 原样放行；设置服务跳过没有 schema 的条目 |

关键在于设置服务（`@deepseek-ai/dsh-settings`）会把 schema 投影成表单，它要的是
schemastery 的 `toJSON` / `meta` / `uid`，Standard Schema 只是入场券。
而 `describe()` 有 `fiber.state !== 2` 的门禁 —— **只有激活成功的条目才会被投影**，
所以第二个雷要等到「修好激活问题、重启之后」才炸。这就是「装完还能用、重启就打不开」的由来。

已装的 6 个第三方插件没有一个导出 `Config`，这是惯例。

### 注入出来的子上下文要带 `effect`

路由注册体包在 `c.effect(() => register(...))` 里，假的注入上下文缺 `effect` 会让注册
被 `try/catch` 静默吞掉 —— 表现是「插件活着但没有任何界面」。

### 别把 schema 当值摊开

`{ ...Config, ...config }` 摊开的是 schema 描述对象，不是配置值，会让
`config.reasoningProvider` 变成对象、同步静默失效。不导出 `Config` 之后这个问题
从根上消失了。

## License

MIT
