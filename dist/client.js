window.__ModuleLoader__.load({
  id: "workbuddy-credits",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var __external = (id) => require(id);
var __WB_CREDITS__ = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name2 in all)
      __defProp(target, name2, { get: all[name2], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // client/index.js
  var index_exports = {};
  __export(index_exports, {
    apply: () => apply,
    name: () => name
  });
  var import_react4 = __toESM(__require("react"), 1);

  // shared/constants.js
  var LOCALE_NS = "workbuddyCredits";
  var API_ROUTE = "/api/workbuddy-credits/usage";
  var DEFAULT_POLL_MS = 3e4;
  var MIN_POLL_MS = 5e3;

  // client/format.js
  var format_exports = {};
  __export(format_exports, {
    EMPTY: () => EMPTY,
    balancePercent: () => balancePercent,
    cacheColor: () => cacheColor,
    cacheRate: () => cacheRate,
    clockOf: () => clockOf,
    compact: () => compact,
    credits: () => credits,
    dateLabel: () => dateLabel,
    effortLabel: () => effortLabel,
    gatewayCredit: () => gatewayCredit,
    gatewayCreditRatio: () => gatewayCreditRatio,
    gatewayRate: () => gatewayRate,
    gatewayTokens: () => gatewayTokens,
    hourLabel: () => hourLabel,
    multiplier: () => multiplier,
    percent: () => percent,
    relativeTime: () => relativeTime,
    tokens: () => tokens,
    trimFixed: () => trimFixed
  });
  var EMPTY = "\u2014";
  function credits(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY;
    if (value === 0) return "0";
    if (Math.abs(value) >= 1e3) return value.toFixed(2);
    if (Math.abs(value) >= 1) return value.toFixed(2);
    return value.toFixed(4);
  }
  function tokens(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY;
    return Math.round(value).toLocaleString("en-US");
  }
  function compact(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY;
    const abs = Math.abs(value);
    if (abs >= 1e6) return (value / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return (value / 1e3).toFixed(1) + "k";
    return String(Math.round(value));
  }
  function percent(value, digits = 1) {
    if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY;
    return `${value.toFixed(digits)}%`;
  }
  function multiplier(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY;
    if (value === 0) return "\u514D\u8D39";
    return `x${value}`;
  }
  function hourLabel(t) {
    if (typeof t !== "string") return EMPTY;
    const at = t.indexOf("T");
    if (at < 0) return t;
    if (at === t.length - 1) return EMPTY;
    return t.slice(at + 1) + " \u65F6";
  }
  function clockOf(iso) {
    if (typeof iso !== "string") return EMPTY;
    const at = iso.indexOf("T");
    if (at < 0) return EMPTY;
    return iso.slice(at + 1, at + 6);
  }
  function relativeTime(iso, now = Date.now()) {
    if (typeof iso !== "string") return EMPTY;
    const at = Date.parse(iso);
    if (!Number.isFinite(at)) return EMPTY;
    const seconds = Math.round((now - at) / 1e3);
    if (seconds < 0) return "\u521A\u521A";
    if (seconds < 60) return "\u521A\u521A";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} \u5206\u949F\u524D`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} \u5C0F\u65F6\u524D`;
    return `${Math.floor(seconds / 86400)} \u5929\u524D`;
  }
  function effortLabel(value) {
    const labels = { low: "\u4F4E", medium: "\u4E2D", high: "\u9AD8", xhigh: "\u6781\u9AD8", max: "\u6700\u5927" };
    return labels[value] ?? value;
  }
  function dateLabel(value) {
    if (typeof value !== "string" || !value || value.startsWith("0001-")) return EMPTY;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;
    return new Date(parsed).toLocaleString("zh-CN", { hour12: false });
  }
  function balancePercent(balance) {
    if (!Number.isFinite(balance?.creditsTotal) || balance.creditsTotal <= 0) return 0;
    return Math.max(0, Math.min(100, balance.credits / balance.creditsTotal * 100));
  }
  function trimFixed(value) {
    const text = String(value);
    if (!text.includes(".")) return text;
    return text.replace(/0+$/, "").replace(/\.$/, "");
  }
  function gatewayTokens(value) {
    const n = Number(value || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(n);
  }
  function gatewayCredit(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return EMPTY;
    return trimFixed(n.toFixed(2));
  }
  function gatewayRate(rate) {
    const text = String(rate ?? "").trim();
    return text ? "x" + text : EMPTY;
  }
  function gatewayCreditRatio(value, samples, tokens2) {
    if (!samples || !tokens2) return EMPTY;
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return EMPTY;
    return trimFixed(n.toFixed(4)) + " / 1M";
  }
  function cacheRate(hit, miss) {
    const h = Number(hit || 0);
    const m = Number(miss || 0);
    const total = h + m;
    if (!total) return EMPTY;
    return String(Math.round(h / total * 1e3) / 10) + "%";
  }
  function cacheColor(hit, miss) {
    const h = Number(hit || 0);
    const m = Number(miss || 0);
    const total = h + m;
    if (!total) return "var(--dsw-alias-label-tertiary, rgba(128,128,128,.8))";
    const pct = h / total * 100;
    if (pct >= 90) return "var(--success, #30a46c)";
    if (pct >= 80) return "var(--warning, #f2b94b)";
    return "var(--danger, #e5484d)";
  }

  // client/locale.js
  var DICT_ZH = {
    // 状态栏 pill
    pillPeriodHint: "\u672C\u671F\u6574\u4F53\u6D88\u8017",
    // 通用状态
    loading: "\u8BFB\u53D6\u4E2D",
    unreachable: "\u7F51\u5173\u4E0D\u53EF\u8FBE",
    retry: "\u91CD\u8BD5",
    updatedAt: "\u66F4\u65B0\u4E8E",
    // 页头
    balancePage: "\u79EF\u5206\u4F59\u989D",
    balanceHint: "\u8D26\u6237\u603B\u89C8\u3001\u7528\u91CF\u660E\u7EC6\u4E0E\u79EF\u5206\u6263\u9664\u5386\u53F2",
    // 一行总览
    totalBalance: "\u8D26\u6237\u5408\u8BA1",
    ofCapacity: "\u603B\u989D",
    expiring: "\u5373\u5C06\u8FC7\u671F",
    totalCredits: "\u672C\u671F\u79EF\u5206",
    requests: "\u8BF7\u6C42\u6570",
    failed: "\u5931\u8D25",
    allOk: "\u5168\u90E8\u6210\u529F",
    totalTokens: "\u603B token",
    cacheHit: "\u7F13\u5B58\u547D\u4E2D\u7387",
    since: "\u7EDF\u8BA1\u8D77\u70B9",
    // 模型倍率
    modelRates: "\u6A21\u578B\u500D\u7387",
    modelRatesHint: "\u5DF2\u6DFB\u52A0\u6A21\u578B\u4E0E\u7F51\u5173\u5F53\u524D\u500D\u7387\u7684\u5BF9\u5E94\u5173\u7CFB\uFF0C\u6309\u500D\u7387\u964D\u5E8F",
    model: "\u6A21\u578B",
    multiplier: "\u500D\u7387",
    creditsCol: "\u79EF\u5206",
    tokensCol: "token",
    unused: "\u672C\u671F\u65E0\u7528\u91CF",
    unknownRate: "\u672A\u77E5",
    // 小时趋势
    hourlyTrend: "\u5C0F\u65F6\u8D8B\u52BF",
    hourlyTrendHint: "\u6BCF\u4E2A\u5C0F\u65F6\u7684\u79EF\u5206\u6D88\u8017",
    // 积分扣除历史
    creditHistory: "\u79EF\u5206\u6263\u9664\u5386\u53F2",
    byAccount: "\u6309\u8D26\u53F7",
    byModel: "\u6309\u6A21\u578B",
    account: "\u8D26\u53F7",
    creditsDeducted: "\u6263\u9664\u79EF\u5206",
    creditsDeductedHint: "\u6309\u4E0A\u6E38 usage.credit \u7D2F\u8BA1",
    matchedTokens: "\u5339\u914D Token",
    matchedTokensHint: "\u4E0E\u79EF\u5206\u540C\u65F6\u89C2\u6D4B\u5230\u7684 Token",
    avgPer1m: "\u5E73\u5747\u79EF\u5206 / 1M Token",
    avgPer1mHint: "\u8D8A\u4F4E\u8D8A\u5212\u7B97",
    creditSamples: "\u6709\u6548\u79EF\u5206\u6837\u672C",
    creditSamplesHint: "\u7F3A\u5B57\u6BB5\u7684\u5386\u53F2\u4E0D\u53C2\u4E0E\u6298\u7B97",
    cacheHitHint: "\u4E0A\u6E38\u524D\u7F00\u7F13\u5B58\u547D\u4E2D / (\u547D\u4E2D+\u672A\u547D\u4E2D)\uFF1B\u4F4E\u547D\u4E2D\u610F\u5473\u7740\u8D39\u7528\u6570\u500D\u653E\u5927",
    sampleTokens: "\u6709\u6548\u6837\u672C Token",
    per1m: "\u79EF\u5206 / 1M Token",
    creditEmpty: "\u6682\u65E0\u79EF\u5206\u6263\u9664\u8BB0\u5F55\uFF1B\u5347\u7EA7\u524D\u4EC5\u542B Token \u7684\u5386\u53F2\u4E0D\u4F1A\u4F2A\u9020\u79EF\u5206\u3002",
    unitAccounts: "\u4E2A\u8D26\u53F7",
    unitModelGroups: "\u4E2A\u6A21\u578B\u500D\u7387\u5206\u7EC4",
    creditOnlyObserved: "\u4EC5\u7EDF\u8BA1\u4E0E\u79EF\u5206\u540C\u65F6\u89C2\u6D4B\u5230\u7684 Token",
    // 明细表与说明
    noData: "\u6682\u65E0\u6570\u636E",
    scopeNote: "\u7F51\u5173\u6309\u5C0F\u65F6\u805A\u5408\uFF0C\u4E0D\u533A\u5206\u4F1A\u8BDD\uFF1A\u6B64\u5904\u4E3A\u672C\u671F\u6574\u4F53\u6D88\u8017\uFF0C\u975E\u5355\u4E2A\u4F1A\u8BDD\u7684\u91CF\u3002"
  };
  var DICT_EN = {
    pillPeriodHint: "Whole period",
    loading: "Loading",
    unreachable: "Gateway unreachable",
    retry: "Retry",
    updatedAt: "Updated",
    balancePage: "Credit balance",
    balanceHint: "Account overview, usage detail, and credit deduction history",
    totalBalance: "All accounts",
    ofCapacity: "of",
    expiring: "expiring",
    totalCredits: "Credits spent",
    requests: "Requests",
    failed: "failed",
    allOk: "all succeeded",
    totalTokens: "Total tokens",
    cacheHit: "Cache hit",
    since: "Since",
    modelRates: "Model rates",
    modelRatesHint: "Configured models matched against the gateway current multiplier, priciest first",
    model: "Model",
    multiplier: "Rate",
    creditsCol: "Credits",
    tokensCol: "Tokens",
    unused: "No usage this period",
    unknownRate: "Unknown",
    hourlyTrend: "Hourly trend",
    hourlyTrendHint: "Credits consumed each hour",
    creditHistory: "Credit deduction history",
    byAccount: "By account",
    byModel: "By model",
    account: "Account",
    creditsDeducted: "Credits deducted",
    creditsDeductedHint: "Summed from upstream usage.credit",
    matchedTokens: "Matched tokens",
    matchedTokensHint: "Tokens observed alongside a credit figure",
    avgPer1m: "Avg credits / 1M tokens",
    avgPer1mHint: "Lower is cheaper",
    creditSamples: "Valid credit samples",
    creditSamplesHint: "History missing the field is excluded",
    cacheHitHint: "Upstream prefix-cache hit / (hit + miss); a low rate multiplies cost",
    sampleTokens: "Sample tokens",
    per1m: "Credits / 1M tokens",
    creditEmpty: "No credit deductions recorded yet; token-only history never fabricates credits.",
    unitAccounts: "accounts",
    unitModelGroups: "model rate groups",
    creditOnlyObserved: "counts only tokens observed alongside credits",
    noData: "No data",
    scopeNote: "The gateway aggregates hourly and has no session dimension: this is the whole period, not one session."
  };

  // client/useSnapshot.js
  var import_react = __require("react");
  async function fetchSnapshot(signal) {
    try {
      const response = await fetch(API_ROUTE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        signal
      });
      if (!response.ok) {
        return { ok: false, error: `\u63A5\u53E3\u8FD4\u56DE HTTP ${response.status}` };
      }
      const payload = await response.json();
      if (payload?.ok === false) return { ok: false, error: payload.error ?? "\u672A\u77E5\u9519\u8BEF" };
      return { ok: true, snapshot: payload?.snapshot ?? null };
    } catch (error) {
      if (error?.name === "AbortError") return { ok: false, error: null, aborted: true };
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  function useSnapshot({ pollMs, enabled = true }) {
    const [snapshot, setSnapshot] = (0, import_react.useState)(null);
    const [error, setError] = (0, import_react.useState)(null);
    const [loading, setLoading] = (0, import_react.useState)(true);
    const [at, setAt] = (0, import_react.useState)(null);
    const token = (0, import_react.useRef)(0);
    const [nonce, setNonce] = (0, import_react.useState)(0);
    (0, import_react.useEffect)(() => {
      if (!enabled) {
        setLoading(false);
        return;
      }
      const mine = ++token.current;
      let timer;
      const run = async (signal) => {
        setLoading(true);
        const result = await fetchSnapshot(signal);
        if (token.current !== mine) return;
        if (result.aborted) return;
        if (result.ok) {
          setSnapshot(result.snapshot);
          setError(null);
          setAt(Date.now());
        } else {
          setError(result.error ?? "\u8BFB\u53D6\u5931\u8D25");
        }
        setLoading(false);
      };
      const controller = new AbortController();
      run(controller.signal);
      const interval = Number.isFinite(pollMs) && pollMs > 0 ? Math.max(1e3, pollMs) : null;
      if (interval !== null) {
        timer = setInterval(() => {
          const next = new AbortController();
          run(next.signal);
        }, interval);
      }
      return () => {
        token.current++;
        controller.abort();
        if (timer) clearInterval(timer);
      };
    }, [pollMs, enabled, nonce]);
    const refresh = () => setNonce((n) => n + 1);
    return { snapshot, error, loading, refresh, at };
  }

  // client/CreditsDashboard.jsx
  var import_react2 = __toESM(__require("react"), 1);
  var page = {
    fontFamily: "inherit",
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "20px",
    color: "var(--text-primary, currentColor)"
  };
  var card = {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid var(--border, rgba(128,128,128,.22))",
    background: "var(--surface, rgba(128,128,128,.05))",
    minWidth: 0
  };
  var cardLabel = { fontSize: "11px", opacity: 0.65, marginBottom: "4px" };
  var cardValue = { fontSize: "18px", fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 };
  var cardSub = { fontSize: "11px", opacity: 0.55, marginTop: "2px" };
  var section = { display: "flex", flexDirection: "column", gap: "8px" };
  var sectionTitle = { fontSize: "12px", fontWeight: 600, opacity: 0.85 };
  var hint = { fontSize: "12px", opacity: 0.6 };
  var table = { width: "100%", borderCollapse: "collapse", fontSize: "12px" };
  var th = {
    textAlign: "left",
    fontWeight: 500,
    opacity: 0.55,
    padding: "4px 8px",
    borderBottom: "1px solid var(--border, rgba(128,128,128,.18))",
    whiteSpace: "nowrap"
  };
  var thNum = { ...th, textAlign: "right" };
  var td = {
    padding: "6px 8px",
    borderBottom: "1px solid var(--border, rgba(128,128,128,.10))",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap"
  };
  var tdNum = { ...td, textAlign: "right" };
  var tdName = { ...td, whiteSpace: "normal", wordBreak: "break-all", maxWidth: "240px" };
  var overviewRow = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "10px"
  };
  var creditKpiRow = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px"
  };
  var barTrack = { height: "6px", borderRadius: "99px", background: "rgba(128,128,128,.22)", overflow: "hidden" };
  function CreditMark({ size = 22 }) {
    return import_react2.default.createElement(
      "svg",
      { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
      import_react2.default.createElement("path", { d: "M12 1.7l1.7 6.6L20.3 10l-6.6 1.7L12 18.3l-1.7-6.6L3.7 10l6.6-1.7L12 1.7z", fill: "currentColor" })
    );
  }
  function Bar({ value, max, label, title }) {
    const ratio = max > 0 ? Math.max(0.02, value / max) : 0;
    return import_react2.default.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1, minWidth: 0 }, title },
      import_react2.default.createElement(
        "div",
        { style: { display: "flex", alignItems: "flex-end", height: "56px", width: "100%" } },
        import_react2.default.createElement("div", {
          style: {
            width: "100%",
            height: `${ratio * 100}%`,
            borderRadius: "3px 3px 0 0",
            background: "var(--accent, #4c8dff)",
            opacity: value > 0 ? 0.9 : 0.25
          }
        })
      ),
      import_react2.default.createElement("span", { style: { fontSize: "10px", opacity: 0.6 } }, label)
    );
  }
  function Kpi({ label, value, sub, accent }) {
    return import_react2.default.createElement(
      "div",
      { style: { ...card, ...accent ? { borderLeft: `3px solid ${accent}` } : {} } },
      import_react2.default.createElement("div", { style: cardLabel }, label),
      import_react2.default.createElement("div", { style: cardValue }, value),
      sub ? import_react2.default.createElement("div", { style: cardSub }, sub) : null
    );
  }
  function ModelRateTable({ matches, t, fmt }) {
    if (!matches?.length) return null;
    return import_react2.default.createElement(
      "div",
      { style: section },
      import_react2.default.createElement("div", { style: sectionTitle }, t("modelRates")),
      import_react2.default.createElement("div", { style: hint }, t("modelRatesHint")),
      import_react2.default.createElement(
        "table",
        { style: table },
        import_react2.default.createElement(
          "thead",
          null,
          import_react2.default.createElement(
            "tr",
            null,
            import_react2.default.createElement("th", { style: th }, t("model")),
            import_react2.default.createElement("th", { style: th }, t("multiplier")),
            import_react2.default.createElement("th", { style: thNum }, t("requests")),
            import_react2.default.createElement("th", { style: thNum }, t("creditsCol")),
            import_react2.default.createElement("th", { style: thNum }, t("tokensCol"))
          )
        ),
        import_react2.default.createElement(
          "tbody",
          null,
          matches.map(
            (m) => import_react2.default.createElement(
              "tr",
              { key: m.id },
              import_react2.default.createElement("td", { style: tdName }, m.id),
              import_react2.default.createElement(
                "td",
                { style: { ...td, color: m.multiplier === 0 ? "var(--success, #30a46c)" : void 0 } },
                m.known ? fmt.multiplier(m.multiplier) : t("unknownRate")
              ),
              import_react2.default.createElement("td", { style: tdNum }, m.requests > 0 ? fmt.tokens(m.requests) : "\u2014"),
              import_react2.default.createElement("td", { style: tdNum }, m.requests > 0 ? fmt.gatewayCredit(m.credits) : t("unused")),
              import_react2.default.createElement("td", { style: tdNum }, m.requests > 0 ? fmt.compact(m.tokens) : "\u2014")
            )
          )
        )
      )
    );
  }
  function HourlyTrend({ series, t, fmt }) {
    if (!series?.length) return null;
    const max = Math.max(...series.map((point) => point.credits), 1e-4);
    return import_react2.default.createElement(
      "div",
      { style: section },
      import_react2.default.createElement("div", { style: sectionTitle }, t("hourlyTrend")),
      import_react2.default.createElement("div", { style: hint }, t("hourlyTrendHint")),
      import_react2.default.createElement(
        "div",
        { style: { display: "flex", alignItems: "flex-end", gap: "4px" } },
        series.map(
          (point) => import_react2.default.createElement(Bar, {
            key: point.t,
            value: point.credits,
            max,
            label: fmt.hourLabel(point.t),
            title: `${fmt.hourLabel(point.t)} \xB7 ${fmt.gatewayCredit(point.credits)} \xB7 ${fmt.tokens(point.requests)} \u6B21\u8BF7\u6C42`
          })
        )
      )
    );
  }
  function CacheCell({ row, fmt }) {
    const text = fmt.cacheRate(row.cacheHitTokens, row.cacheMissTokens);
    if (text === fmt.EMPTY) return import_react2.default.createElement("span", { style: { opacity: 0.5 } }, text);
    return import_react2.default.createElement(
      "span",
      {
        style: { color: fmt.cacheColor(row.cacheHitTokens, row.cacheMissTokens) },
        title: `\u547D\u4E2D ${fmt.gatewayTokens(row.cacheHitTokens)} / \u672A\u547D\u4E2D ${fmt.gatewayTokens(row.cacheMissTokens)} tok`
      },
      text
    );
  }
  function CreditHistory({ snapshot, t, fmt }) {
    const [dimension, setDimension] = import_react2.default.useState("model");
    const totals = snapshot?.creditTotals;
    const models = snapshot?.creditModels ?? [];
    const accounts = snapshot?.creditAccounts ?? [];
    const rows = dimension === "model" ? models : accounts;
    const tabs = [
      { id: "account", label: t("byAccount"), count: accounts.length },
      { id: "model", label: t("byModel"), count: models.length }
    ];
    const tabBar = import_react2.default.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
      import_react2.default.createElement("span", { style: { ...sectionTitle, marginRight: "2px" } }, t("creditHistory")),
      tabs.map(
        (tab) => import_react2.default.createElement(
          "button",
          {
            key: tab.id,
            type: "button",
            onClick: () => setDimension(tab.id),
            style: {
              border: "1px solid var(--border, rgba(128,128,128,.25))",
              borderRadius: "6px",
              padding: "3px 9px",
              fontSize: "11.5px",
              cursor: "pointer",
              background: dimension === tab.id ? "var(--accent, #4c8dff)" : "transparent",
              color: dimension === tab.id ? "#fff" : "inherit"
            }
          },
          `${tab.label} ${tab.count}`
        )
      ),
      import_react2.default.createElement(
        "span",
        { style: { ...hint, marginLeft: "auto" } },
        `${accounts.length} ${t("unitAccounts")} \xB7 ${models.length} ${t("unitModelGroups")} \xB7 ${t("creditOnlyObserved")}`
      )
    );
    const kpis = totals ? import_react2.default.createElement(
      "div",
      { style: creditKpiRow },
      import_react2.default.createElement(Kpi, {
        label: t("creditsDeducted"),
        value: fmt.gatewayCredit(totals.credits),
        sub: t("creditsDeductedHint"),
        accent: "var(--accent, #4c8dff)"
      }),
      import_react2.default.createElement(Kpi, {
        label: t("matchedTokens"),
        value: fmt.gatewayTokens(totals.creditTokens),
        sub: t("matchedTokensHint")
      }),
      import_react2.default.createElement(Kpi, {
        label: t("avgPer1m"),
        value: fmt.gatewayCreditRatio(totals.creditsPer1m, totals.creditSamples, totals.creditTokens),
        sub: t("avgPer1mHint"),
        accent: "var(--success, #30a46c)"
      }),
      import_react2.default.createElement(Kpi, {
        label: t("creditSamples"),
        value: String(totals.creditSamples || 0),
        sub: t("creditSamplesHint")
      }),
      import_react2.default.createElement(Kpi, {
        label: t("cacheHit"),
        value: fmt.cacheRate(totals.cacheHitTokens, totals.cacheMissTokens),
        sub: t("cacheHitHint")
      })
    ) : null;
    const head = import_react2.default.createElement(
      "thead",
      null,
      import_react2.default.createElement(
        "tr",
        null,
        import_react2.default.createElement("th", { style: th }, dimension === "model" ? t("model") : t("account")),
        dimension === "model" ? import_react2.default.createElement("th", { style: th }, t("multiplier")) : null,
        import_react2.default.createElement("th", { style: thNum }, t("requests")),
        import_react2.default.createElement("th", { style: thNum }, t("creditsDeducted")),
        import_react2.default.createElement("th", { style: thNum }, t("sampleTokens")),
        import_react2.default.createElement("th", { style: thNum }, t("per1m")),
        import_react2.default.createElement("th", { style: thNum }, t("cacheHit"))
      )
    );
    const body = import_react2.default.createElement(
      "tbody",
      null,
      rows.length === 0 ? import_react2.default.createElement(
        "tr",
        null,
        import_react2.default.createElement("td", { style: { ...td, opacity: 0.6 }, colSpan: dimension === "model" ? 7 : 6 }, t("creditEmpty"))
      ) : rows.map(
        (row) => import_react2.default.createElement(
          "tr",
          { key: `${dimension}:${row.key}` },
          import_react2.default.createElement(
            "td",
            { style: tdName },
            dimension === "model" ? row.key : import_react2.default.createElement(
              import_react2.default.Fragment,
              null,
              row.nickname || row.key.slice(0, 8) || "\u2014",
              import_react2.default.createElement(
                "div",
                { style: { fontSize: "10.5px", opacity: 0.55 } },
                `${row.realm || ""} \xB7 ${row.key.slice(0, 8)}`
              )
            )
          ),
          dimension === "model" ? import_react2.default.createElement("td", { style: td }, fmt.gatewayRate(row.rate)) : null,
          import_react2.default.createElement("td", { style: tdNum }, fmt.gatewayTokens(row.requests)),
          import_react2.default.createElement("td", { style: tdNum }, fmt.gatewayCredit(row.credits)),
          import_react2.default.createElement("td", { style: tdNum }, fmt.gatewayTokens(row.creditTokens)),
          import_react2.default.createElement("td", { style: tdNum }, fmt.gatewayCreditRatio(row.creditsPer1m, row.creditSamples, row.creditTokens)),
          import_react2.default.createElement("td", { style: tdNum }, import_react2.default.createElement(CacheCell, { row, fmt }))
        )
      )
    );
    return import_react2.default.createElement(
      "div",
      { style: section },
      tabBar,
      kpis,
      import_react2.default.createElement("table", { style: table }, head, body)
    );
  }
  function CreditsDashboard({ t, fmt, useSnapshot: useSnapshot2, pollMs, ...rest }) {
    const { snapshot, error, loading, refresh, at } = useSnapshot2({ pollMs });
    const totals = snapshot?.totals;
    const balances = snapshot?.balances ?? [];
    const state = import_react2.default.useMemo(() => {
      if (error) return { kind: "error", text: error };
      if (!snapshot) return { kind: "loading", text: t("loading") };
      if (snapshot.ok === false) return { kind: "error", text: snapshot.error ?? t("unreachable") };
      if (!totals && balances.length === 0) return { kind: "empty", text: t("noData") };
      return { kind: "ready" };
    }, [error, snapshot, totals, balances.length, t]);
    if (state.kind === "loading") {
      return import_react2.default.createElement("div", { style: { ...page, opacity: 0.7, ...rest } }, state.text);
    }
    if (state.kind === "error" || state.kind === "empty") {
      return import_react2.default.createElement(
        "div",
        { style: { ...page, gap: "10px", ...rest } },
        import_react2.default.createElement("h2", { style: { margin: 0, fontSize: "15px", color: state.kind === "error" ? "var(--danger, #e5484d)" : void 0 } }, t("balancePage")),
        import_react2.default.createElement("div", { style: { fontSize: "12px", opacity: 0.7 } }, state.text),
        import_react2.default.createElement(
          "button",
          {
            type: "button",
            onClick: refresh,
            style: {
              alignSelf: "flex-start",
              padding: "5px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border, rgba(128,128,128,.3))",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: "12px"
            }
          },
          t("retry")
        )
      );
    }
    const totalCredits = balances.reduce((sum, item) => sum + item.credits, 0);
    const totalCapacity = balances.reduce((sum, item) => sum + item.creditsTotal, 0);
    const totalExpiring = balances.reduce((sum, item) => sum + item.creditsExpiring, 0);
    const remainingPercent = totalCapacity > 0 ? totalCredits / totalCapacity * 100 : 0;
    return import_react2.default.createElement(
      "div",
      { style: { ...page, ...rest } },
      import_react2.default.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        import_react2.default.createElement(CreditMark, { size: 26 }),
        import_react2.default.createElement(
          "div",
          null,
          import_react2.default.createElement("h2", { style: { margin: 0, fontSize: "15px" } }, t("balancePage")),
          import_react2.default.createElement("p", { style: { ...hint, margin: 0 } }, t("balanceHint"))
        ),
        at ? import_react2.default.createElement("span", { style: { ...hint, marginLeft: "auto" } }, `${t("updatedAt")} ${fmt.relativeTime(new Date(at).toISOString())}`) : null
      ),
      // —— 一行总览：账户合计 + 四张本期 KPI ——
      import_react2.default.createElement(
        "div",
        { style: overviewRow },
        import_react2.default.createElement(
          "div",
          { style: { ...card, display: "flex", flexDirection: "column", justifyContent: "center" } },
          import_react2.default.createElement(
            "div",
            { style: { ...cardLabel, display: "flex", alignItems: "center", gap: "6px" } },
            import_react2.default.createElement(CreditMark, { size: 15 }),
            t("totalBalance")
          ),
          import_react2.default.createElement("div", { style: cardValue }, fmt.credits(totalCredits)),
          import_react2.default.createElement("div", { style: barTrack }, import_react2.default.createElement("div", {
            style: {
              width: `${remainingPercent}%`,
              height: "100%",
              background: remainingPercent < 20 ? "var(--danger, #e5484d)" : "var(--accent, #4c8dff)"
            }
          })),
          import_react2.default.createElement("div", { style: cardSub }, `${t("ofCapacity")} ${fmt.credits(totalCapacity)} \xB7 ${t("expiring")} ${fmt.credits(totalExpiring)}`)
        ),
        import_react2.default.createElement(Kpi, {
          label: t("totalCredits"),
          value: fmt.gatewayCredit(totals?.credits),
          sub: `${t("since")} ${fmt.hourLabel(snapshot.since) || "\u2014"}`
        }),
        import_react2.default.createElement(Kpi, {
          label: t("requests"),
          value: fmt.tokens(totals?.requests ?? 0),
          sub: totals?.errors > 0 ? `${t("failed")} ${fmt.tokens(totals.errors)}` : t("allOk")
        }),
        import_react2.default.createElement(Kpi, { label: t("totalTokens"), value: fmt.compact(totals?.total_tokens ?? 0) }),
        import_react2.default.createElement(Kpi, { label: t("cacheHit"), value: fmt.percent(totals?.cache_hit_rate ?? 0, 1) })
      ),
      import_react2.default.createElement(HourlyTrend, { series: snapshot.series, t, fmt }),
      import_react2.default.createElement(ModelRateTable, { matches: snapshot.matches, t, fmt }),
      import_react2.default.createElement(CreditHistory, { snapshot, t, fmt }),
      import_react2.default.createElement("div", { style: { ...hint, borderTop: "1px solid var(--border, rgba(128,128,128,.14))", paddingTop: "8px", lineHeight: 1.6 } }, t("scopeNote"))
    );
  }

  // client/CreditsPill.jsx
  var import_react3 = __toESM(__require("react"), 1);
  var root = {
    boxSizing: "border-box",
    minWidth: 0,
    maxWidth: "100%",
    fontSize: "calc(var(--dsh-content-font-size-secondary, 13px) - 1px)",
    lineHeight: "calc(20px + var(--dsh-content-font-delta-secondary, 0px))",
    justifyContent: "center",
    gap: "12px",
    display: "flex"
  };
  var pill = {
    boxSizing: "border-box",
    maxWidth: "100%",
    color: "var(--dsw-alias-label-tertiary)",
    font: "inherit",
    fontVariantNumeric: "tabular-nums",
    lineHeight: "inherit",
    whiteSpace: "nowrap",
    background: "0 0",
    border: "none",
    borderRadius: "999px",
    alignItems: "center",
    gap: "6px",
    padding: "1px 8px",
    display: "inline-flex"
  };
  var icon = { flex: "none", width: 14, height: 14 };
  function CreditStar() {
    return import_react3.default.createElement(
      "svg",
      {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinejoin: "round",
        strokeLinecap: "round",
        "aria-hidden": true,
        style: icon
      },
      import_react3.default.createElement("path", {
        d: "M12 3.2l1.55 5.05a2 2 0 0 0 1.28 1.28L19.88 11l-5.05 1.55a2 2 0 0 0-1.28 1.28L12 18.88l-1.55-5.05a2 2 0 0 0-1.28-1.28L4.12 11l5.05-1.47a2 2 0 0 0 1.28-1.28L12 3.2z"
      })
    );
  }
  function resolveCredits(snapshot, modelSelection) {
    const model = modelSelection?.next?.model ?? modelSelection?.lastUsed?.model ?? null;
    if (model) {
      const match = (snapshot?.matches ?? []).find((row) => row.id === model);
      if (match) return { value: match.credits, scope: "model", model };
    }
    const total = snapshot?.totals?.credits;
    return {
      value: typeof total === "number" && Number.isFinite(total) ? total : null,
      scope: "period",
      model
    };
  }
  function CreditsPill({ t, fmt, useSnapshot: useSnapshot2, pollMs, useProjection }) {
    const { snapshot, error } = useSnapshot2({ pollMs });
    const modelSelection = typeof useProjection === "function" ? useProjection("modelSelection") : void 0;
    const { value, scope, model } = resolveCredits(snapshot, modelSelection);
    if (value === null) return null;
    const title = scope === "model" && model ? `${model}\uFF1A\u672C\u671F\u6D88\u8017 ${fmt.credits(value)} \u79EF\u5206` : `${t("pillPeriodHint")}\uFF1A${fmt.credits(value)} \u79EF\u5206`;
    if (error) return null;
    return import_react3.default.createElement(
      "div",
      { style: root, "data-composer-credits": true },
      import_react3.default.createElement(
        "span",
        { style: pill, title },
        import_react3.default.createElement(CreditStar),
        fmt.credits(value)
      )
    );
  }

  // client/index.js
  var name = "workbuddy-credits";
  function apply(ctx) {
    ctx.effect(
      () => ctx.locale.register(LOCALE_NS, {
        zh: DICT_ZH,
        en: DICT_EN
      }),
      "workbuddy-credits: dictionaries"
    );
    const t = ctx.locale.bind(LOCALE_NS);
    ctx.inject(["slots"], (c) => {
      const slots = c.slots;
      const pollMs = () => {
        const configured = ctx.settings?.get?.()?.pollMs;
        return typeof configured === "number" && configured >= MIN_POLL_MS ? configured : DEFAULT_POLL_MS;
      };
      slots.inject(
        "conversation.composer.dock",
        () => slots.register(
          {
            name: "conversation.composer.dock",
            id: "workbuddy-credits",
            order: -1,
            locale: LOCALE_NS
          },
          (props) => import_react4.default.createElement(CreditsPill, {
            ...props,
            t,
            fmt: format_exports,
            useSnapshot,
            pollMs: pollMs()
          })
        )
      );
      slots.inject(
        "settings.section",
        () => slots.register(
          {
            name: "settings.section",
            id: "workbuddy-credits-balance",
            order: 12,
            label: () => t("balancePage"),
            locale: LOCALE_NS
          },
          (props) => import_react4.default.createElement(CreditsDashboard, {
            ...props,
            t,
            fmt: format_exports,
            useSnapshot,
            pollMs: pollMs()
          })
        )
      );
    });
  }
  return __toCommonJS(index_exports);
})();

    return __WB_CREDITS__;
  }
});
