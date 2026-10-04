window.__ModuleLoader__.load({
  id: "dsh-workbuddy-credits",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react4 = __toESM(require("react"), 1);

// shared/constants.js
var LOCALE_NS = "workbuddyCredits";
var API_ROUTE = "/api/workbuddy-credits/usage";
var DEFAULT_POLL_MS = 3e4;
var LOW_RATE_THRESHOLD = 0.2;

// client/format.js
var format_exports = {};
__export(format_exports, {
  EMPTY: () => EMPTY,
  balancePercent: () => balancePercent,
  cacheColor: () => cacheColor,
  cacheRate: () => cacheRate,
  clockAt: () => clockAt,
  clockOf: () => clockOf,
  compact: () => compact,
  countdown: () => countdown,
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
  rateNumber: () => rateNumber,
  relativeTime: () => relativeTime,
  shortTokens: () => shortTokens,
  tokens: () => tokens,
  trimFixed: () => trimFixed
});
var EMPTY = "—";
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
  if (value === 0) return "免费";
  return `x${value}`;
}
function hourLabel(t) {
  if (typeof t !== "string") return EMPTY;
  const at = t.indexOf("T");
  if (at < 0) return t;
  if (at === t.length - 1) return EMPTY;
  return t.slice(at + 1) + " 时";
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
  if (seconds < 0) return "刚刚";
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}
function effortLabel(value) {
  const labels = { low: "低", medium: "中", high: "高", xhigh: "极高", max: "最大" };
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
function rateNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY;
  return value.toFixed(2);
}
function shortTokens(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return EMPTY;
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n));
}
function countdown(ms, now = Date.now()) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return EMPTY;
  const remain = Math.round((ms - now) / 1e3);
  if (remain <= 0) return EMPTY;
  if (remain < 60) return `${remain} 秒`;
  if (remain < 3600) return `${Math.floor(remain / 60)} 分`;
  if (remain < 86400) return `${Math.floor(remain / 3600)} 小时`;
  return `${Math.floor(remain / 86400)} 天`;
}
function clockAt(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return EMPTY;
  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const md = `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, "0")}`;
  const today = /* @__PURE__ */ new Date();
  const todayMd = `${today.getMonth() + 1}-${String(today.getDate()).padStart(2, "0")}`;
  return md === todayMd ? `${hh}:${mm}` : `${md} ${hh}:${mm}`;
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
  pillPeriodHint: "本期整体消耗",
  // 通用状态
  loading: "读取中",
  unreachable: "网关不可达",
  retry: "重试",
  noData: "暂无数据",
  // 设置页菜单项
  balancePage: "积分余额",
  // 概览三栏
  creditsGroup: "积分",
  refresh: "刷新",
  refreshing: "同步中",
  refreshHint: "重新读取网关的全部数据",
  balanceRatio: "剩余 / 总额",
  avgPer1m: "积分 / 1M Token",
  cacheHit: "缓存命中率",
  // 模型板块
  model: "模型",
  multiplier: "倍率",
  requests: "请求",
  creditsDeducted: "扣除积分",
  noCredits: "本期无扣除",
  per1mCredits: "积分 / 1M Token",
  capTool: "工具",
  capVision: "视觉",
  capThinking: "思考常开",
  underRate: "生效倍率 ≤",
  countUnit: "个",
  noLowRateModel: "当前没有生效倍率低于阈值的模型",
  // 账号板块
  accounts: "账号",
  creditsUnit: "积分",
  realmCn: "国内",
  realmGlobal: "国际",
  available: "可用",
  rateLimited: "限流",
  unlockAt: "解封",
  noAccounts: "网关还没有账号"
};
var DICT_EN = {
  pillPeriodHint: "Whole period",
  loading: "Loading",
  unreachable: "Gateway unreachable",
  retry: "Retry",
  noData: "No data",
  balancePage: "Credit balance",
  creditsGroup: "Credits",
  refresh: "Refresh",
  refreshing: "Syncing",
  refreshHint: "Re-read every value from the gateway",
  balanceRatio: "Remaining / total",
  avgPer1m: "Credits / 1M tokens",
  cacheHit: "Cache hit",
  model: "Models",
  multiplier: "Rate",
  requests: "Requests",
  creditsDeducted: "Deducted",
  noCredits: "Nothing deducted",
  per1mCredits: "Credits / 1M tokens",
  capTool: "Tools",
  capVision: "Vision",
  capThinking: "Thinking always on",
  underRate: "Effective rate ≤",
  countUnit: "total",
  noLowRateModel: "No model is currently under the effective-rate threshold",
  accounts: "Accounts",
  creditsUnit: "credits",
  realmCn: "China",
  realmGlobal: "Global",
  available: "Available",
  rateLimited: "rate limited",
  unlockAt: "Unlocks",
  noAccounts: "The gateway has no accounts yet"
};

// client/useSnapshot.js
var import_react = require("react");
async function fetchSnapshot(signal) {
  try {
    const response = await fetch(API_ROUTE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal
    });
    if (!response.ok) {
      return { ok: false, error: `接口返回 HTTP ${response.status}` };
    }
    const payload = await response.json();
    if (payload?.ok === false) return { ok: false, error: payload.error ?? "未知错误" };
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
        setError(result.error ?? "读取失败");
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
var import_react2 = __toESM(require("react"), 1);
var page = {
  fontFamily: "inherit",
  fontSize: "13px",
  lineHeight: "22px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  padding: "8px 0",
  color: "var(--dsw-alias-label-primary, inherit)",
  minWidth: 0
};
var label = { primary: "var(--dsw-alias-label-primary, inherit)", secondary: "var(--dsw-alias-label-secondary, inherit)", tertiary: "var(--dsw-alias-label-tertiary, inherit)" };
var state = { warn: "var(--dsw-alias-state-warn-primary, #f2b94b)", error: "var(--dsw-alias-state-error-primary, #e5484d)" };
var cubeGroup = { display: "flex", flexDirection: "column", gap: "8px", padding: "16px 0" };
var cubeGroupTitle = { fontSize: "14px", fontWeight: 400, lineHeight: "22px" };
var cubeRow = { display: "flex", alignItems: "stretch", gap: "8px" };
var cube = {
  flex: 1,
  minWidth: 0,
  border: "0.5px solid var(--dsw-alias-border-l4, rgba(128,128,128,.24))",
  borderRadius: "var(--dsw-radius-xl, 20px)",
  background: "transparent",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "4px",
  padding: "20px 12px",
  boxSizing: "border-box"
};
var cubeValue = {
  fontSize: "22px",
  lineHeight: "28px",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-.01em",
  whiteSpace: "nowrap"
};
var cubeLabel = { fontSize: "12px", lineHeight: "18px", color: label.secondary, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
var groupHead = { display: "flex", alignItems: "baseline", gap: "8px", minHeight: "36px" };
var groupTitle = { fontSize: "13px", fontWeight: 600, lineHeight: "22px" };
var groupSub = { fontSize: "12px", lineHeight: "18px", color: label.tertiary };
var cards = {
  display: "grid",
  // 显式两列，不能用 auto-fill：容器稍窄一点它就塌成一列，一长条很难扫。
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  margin: 0,
  padding: 0,
  listStyle: "none"
};
var cardsPreset = { ...cards, gap: "12px" };
var cardShell = {
  border: "0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l4, rgba(128,128,128,.24)))",
  borderRadius: "var(--dsw-radius-xl, 20px)",
  background: "var(--dsw-alias-settings-card-fill, transparent)",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  overflow: "hidden",
  transition: "border-color .16s, background .16s"
};
var foldMain = {
  appearance: "none",
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
  background: "transparent",
  border: 0,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "12px 14px",
  alignItems: "stretch"
};
var foldHead = { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 };
var foldTitle = { flex: 1, minWidth: 0, fontSize: "14px", fontWeight: 500, lineHeight: "20px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
var foldTrailing = { flex: "none", display: "inline-flex", alignItems: "center", gap: "8px", color: label.tertiary };
var foldDesc = {
  fontSize: "12px",
  lineHeight: "18px",
  color: label.tertiary,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical"
};
var foldMeta = { marginTop: "auto", paddingTop: "6px", display: "flex" };
var foldDetails = { display: "none", borderTop: "0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.12))", background: "var(--dsw-alias-bg-module-platform, transparent)", padding: "10px 14px 12px" };
var facts = { display: "grid", gridTemplateColumns: "68px minmax(0, 1fr)", gap: "6px 10px", margin: 0 };
var factKey = { fontSize: "11px", lineHeight: "17px", color: label.tertiary };
var factVal = { margin: 0, fontSize: "12px", lineHeight: "17px", color: label.secondary, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
var noteLine = {
  fontFamily: "inherit",
  fontSize: "12px",
  lineHeight: "18px",
  fontWeight: 400,
  color: label.secondary,
  padding: "1px 6px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontVariantNumeric: "tabular-nums"
};
var cardIdentity = { ...noteLine, borderRadius: "var(--dsw-radius-xs, 4px)", background: "var(--dsw-alias-bg-module-platform, transparent)", maxWidth: "100%" };
var footLink = { ...noteLine, borderRadius: "var(--dsw-radius-sm, 8px)" };
var tag = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  cornerShape: "round",
  padding: "1px 8px",
  fontSize: "11px",
  lineHeight: "17px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  boxSizing: "border-box"
};
var tagOutline = { ...tag, border: "0.5px solid var(--dsw-alias-border-l4, rgba(128,128,128,.24))", color: label.tertiary };
var tagNeutral = { ...tag, background: "var(--dsw-alias-bg-module-platform, transparent)", color: label.secondary };
var tagWarning = { ...tag, background: "color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f2b94b) 12%, transparent)", color: state.warn };
function Tag({ tone, children }) {
  const style = tone === "warning" ? tagWarning : tone === "outline" ? tagOutline : tagNeutral;
  return import_react2.default.createElement("span", { style, "data-tone": tone }, children);
}
var presetMain = { padding: "14px 16px 12px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 };
var presetHead = { display: "flex", alignItems: "center", gap: "6px", minWidth: 0 };
var presetName = { fontSize: "15px", fontWeight: 600, lineHeight: "1.4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
var presetId = { flexShrink: 0, marginLeft: "auto", fontFamily: "var(--dsw-font-mono, ui-monospace, monospace)", fontSize: "11px", lineHeight: "21px", color: label.tertiary };
var presetDesc = { color: label.secondary, fontSize: "13px", lineHeight: "1.55", marginBlock: "auto", overflowWrap: "anywhere" };
var presetFoot = { borderTop: "0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,.12))", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", padding: "6px 10px", justifyContent: "flex-start" };
var iconBtn = {
  border: "0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,.16))",
  borderRadius: "var(--dsw-radius-sm, 8px)",
  color: label.primary,
  background: "transparent",
  cursor: "pointer",
  font: "inherit",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  fontSize: "12px",
  lineHeight: "18px"
};
var headEnd = { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "8px" };
var empty = { fontSize: "13px", lineHeight: "20px", color: label.tertiary, padding: "12px 2px" };
function Chevron({ open }) {
  return import_react2.default.createElement(
    "svg",
    {
      width: 12,
      height: 12,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      "aria-hidden": "true",
      style: { flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .16s" }
    },
    import_react2.default.createElement("path", { d: "M4 6.5l4 4 4-4" })
  );
}
function RefreshIcon() {
  return import_react2.default.createElement(
    "svg",
    { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: { flex: "none" } },
    import_react2.default.createElement("path", { d: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9" }),
    import_react2.default.createElement("path", { d: "M13.2 2.6v2.6h-2.6" })
  );
}
function thousands(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : fmt.EMPTY;
}
function Overview({ snapshot, t, fmt: fmt2 }) {
  const accounts = snapshot.accountCards ?? [];
  const credit = snapshot.creditTotals;
  const totalCredits = accounts.reduce((sum, item) => sum + item.credits, 0);
  const totalCapacity = accounts.reduce((sum, item) => sum + item.creditsTotal, 0);
  return import_react2.default.createElement(
    "div",
    { style: cubeGroup },
    import_react2.default.createElement(
      "div",
      { style: groupHead },
      import_react2.default.createElement("span", { style: cubeGroupTitle }, t("creditsGroup")),
      import_react2.default.createElement(
        "span",
        { style: headEnd },
        import_react2.default.createElement(
          "button",
          {
            type: "button",
            style: iconBtn,
            onClick: snapshot.onRefresh,
            disabled: snapshot.loading === true,
            title: t("refreshHint"),
            "aria-busy": snapshot.loading === true
          },
          import_react2.default.createElement(RefreshIcon),
          import_react2.default.createElement("span", null, snapshot.loading === true ? t("refreshing") : t("refresh"))
        )
      )
    ),
    import_react2.default.createElement(
      "div",
      { style: cubeRow },
      import_react2.default.createElement(
        "div",
        { style: cube },
        import_react2.default.createElement("div", { style: cubeValue }, fmt2.tokens(totalCredits), import_react2.default.createElement("small", { style: { fontSize: "13px", fontWeight: 400, color: label.secondary } }, `/${fmt2.tokens(totalCapacity)}`)),
        import_react2.default.createElement("div", { style: cubeLabel }, t("balanceRatio"))
      ),
      import_react2.default.createElement(
        "div",
        { style: cube },
        import_react2.default.createElement("div", { style: cubeValue }, fmt2.rateNumber(credit?.creditsPer1m)),
        import_react2.default.createElement("div", { style: cubeLabel }, t("avgPer1m"))
      ),
      import_react2.default.createElement(
        "div",
        { style: cube },
        import_react2.default.createElement("div", { style: cubeValue }, fmt2.cacheRate(credit?.cacheHitTokens, credit?.cacheMissTokens), import_react2.default.createElement("small", { style: { fontSize: "13px", fontWeight: 400, color: label.secondary } }, "")),
        import_react2.default.createElement("div", { style: cubeLabel }, t("cacheHit"))
      )
    )
  );
}
function ModelCard({ row, t, fmt: fmt2 }) {
  const [open, setOpen] = import_react2.default.useState(false);
  const supports = [
    row.supportsToolCall ? t("capTool") : null,
    row.supportsImages ? t("capVision") : null,
    row.supportsReasoning ? t("capThinking") : null
  ].filter(Boolean);
  const desc = [...supports, row.promoLabel].filter(Boolean).join(" · ") || fmt2.EMPTY;
  const detailId = import_react2.default.useId();
  return import_react2.default.createElement(
    "li",
    // 展开态的边框色必须与常态**同一个变量**，不能换成 border-l3。
    // 换成低一档时：折叠按钮自带 `border: 0`，浏览器会把这条 border-color
    // 当成未指定而回退到最亮的默认边框色 —— 实测描边从 86飙到 250（纯白），
    // 整排卡片像被点亮。所以展开只改底色，边框一律走cardShell。
    { style: cardShell },
    import_react2.default.createElement(
      "button",
      {
        type: "button",
        style: { ...foldMain, background: open ? "var(--dsw-alias-interactive-bg-hover, transparent)" : "transparent" },
        "aria-expanded": open,
        "aria-controls": detailId,
        onClick: () => setOpen((value) => !value)
      },
      import_react2.default.createElement(
        "span",
        { style: foldHead },
        import_react2.default.createElement("strong", { style: foldTitle, title: row.id }, row.id),
        import_react2.default.createElement(
          "span",
          { style: foldTrailing },
          import_react2.default.createElement(Tag, { key: "rate", tone: "neutral" }, fmt2.rateNumber(row.multiplier)),
          import_react2.default.createElement(Chevron, { open })
        )
      ),
      import_react2.default.createElement("span", { style: { ...foldDesc, display: open ? "block" : "-webkit-box" } }, desc),
      import_react2.default.createElement(
        "span",
        { style: foldMeta },
        // 「32.92 积分」有歧义：是剩余、是倍率、还是本次消耗？写全才不含糊。
        import_react2.default.createElement("span", { style: cardIdentity }, row.requests > 0 ? `${t("creditsDeducted")} ${fmt2.gatewayCredit(row.credits)}` : t("noCredits"))
      )
    ),
    import_react2.default.createElement(
      "div",
      { id: detailId, style: { ...foldDetails, display: open ? "block" : "none" } },
      import_react2.default.createElement(
        "dl",
        { style: facts },
        import_react2.default.createElement("dt", { style: factKey }, t("requests")),
        import_react2.default.createElement("dd", { style: factVal }, row.requests > 0 ? thousands(row.requests, fmt2) : fmt2.EMPTY),
        import_react2.default.createElement("dt", { style: factKey }, t("cacheHit")),
        import_react2.default.createElement("dd", { style: factVal }, fmt2.cacheRate(row.cacheHitTokens, row.cacheMissTokens)),
        import_react2.default.createElement("dt", { style: factKey }, t("per1mCredits")),
        import_react2.default.createElement("dd", { style: factVal }, fmt2.gatewayCreditRatio(row.creditsPer1m, 1, row.cacheHitTokens + row.cacheMissTokens))
      )
    )
  );
}
function ModelSection({ models, t, fmt: fmt2 }) {
  const rows = models ?? [];
  const rateText = `${LOW_RATE_THRESHOLD}`;
  return import_react2.default.createElement(
    "div",
    null,
    import_react2.default.createElement(
      "div",
      { style: groupHead },
      import_react2.default.createElement("span", { style: groupTitle }, t("model")),
      import_react2.default.createElement("span", { style: groupSub }, `${t("underRate")} ${rateText} · ${rows.length} ${t("countUnit")}`)
    ),
    rows.length === 0 ? import_react2.default.createElement("div", { style: empty }, t("noLowRateModel")) : import_react2.default.createElement(
      "ul",
      { style: cards },
      rows.map((row) => import_react2.default.createElement(ModelCard, { key: row.id, row, t, fmt: fmt2 }))
    )
  );
}
function shortName(nickname) {
  return String(nickname ?? "").replace(/@.*$/, "");
}
function AccountCard({ account, t, fmt: fmt2 }) {
  const isCn = account.realm === "cn";
  const limited = account.limited ?? [];
  const head = limited[0];
  const unlockAt = head ? head.resetAt ?? head.until : null;
  let footer;
  if (head) {
    footer = [
      import_react2.default.createElement(Tag, { key: "tag", tone: "warning" }, `${head.model} ${t("rateLimited")}`),
      unlockAt === null ? null : import_react2.default.createElement("span", { key: "at", style: footLink, title: `${t("unlockAt")} ${fmt2.clockAt(unlockAt)}` }, `${t("unlockAt")} ${fmt2.clockAt(unlockAt)}`)
    ];
  } else {
    footer = import_react2.default.createElement("span", { style: footLink }, t("available"));
  }
  return import_react2.default.createElement(
    "li",
    { style: cardShell },
    import_react2.default.createElement(
      "div",
      { style: presetMain },
      import_react2.default.createElement(
        "div",
        { style: presetHead },
        import_react2.default.createElement("span", { style: presetName, title: account.nickname }, shortName(account.nickname)),
        import_react2.default.createElement(Tag, { key: "realm", tone: "outline" }, isCn ? t("realmCn") : t("realmGlobal")),
        import_react2.default.createElement("span", { style: presetId }, account.realm)
      ),
      import_react2.default.createElement(
        "div",
        { style: presetDesc },
        `${fmt2.gatewayCredit(account.credits)}${account.creditsTotal > 0 ? ` / ${fmt2.gatewayCredit(account.creditsTotal)}` : ""} ${t("creditsUnit")}`
      )
    ),
    import_react2.default.createElement("div", { style: presetFoot }, footer)
  );
}
function AccountSection({ accounts, t, fmt: fmt2 }) {
  const rows = accounts ?? [];
  return import_react2.default.createElement(
    "div",
    null,
    import_react2.default.createElement(
      "div",
      { style: groupHead },
      import_react2.default.createElement("span", { style: groupTitle }, t("accounts")),
      import_react2.default.createElement("span", { style: groupSub }, `${rows.length} ${t("countUnit")}`)
    ),
    rows.length === 0 ? import_react2.default.createElement("div", { style: empty }, t("noAccounts")) : import_react2.default.createElement(
      "ul",
      { style: cardsPreset },
      rows.map((account) => import_react2.default.createElement(AccountCard, {
        key: account.uid || `${account.realm}-${account.nickname}`,
        account,
        t,
        fmt: fmt2
      }))
    )
  );
}
function CreditsDashboard({ t, fmt: fmt2, useSnapshot: useSnapshot2, pollMs, ...rest }) {
  const { snapshot, error, loading, refresh } = useSnapshot2({ pollMs });
  const state2 = import_react2.default.useMemo(() => {
    if (error) return { kind: "error", text: error };
    if (!snapshot) return { kind: "loading", text: t("loading") };
    if (snapshot.ok === false) return { kind: "error", text: snapshot.error ?? t("unreachable") };
    const empty2 = (snapshot.accountCards?.length ?? 0) === 0 && (snapshot.models?.length ?? 0) === 0;
    if (empty2) return { kind: "empty", text: t("noData") };
    return { kind: "ready" };
  }, [error, snapshot, t]);
  if (state2.kind === "loading") {
    return import_react2.default.createElement("div", { style: { ...page, opacity: 0.7, ...rest } }, state2.text);
  }
  if (state2.kind === "error" || state2.kind === "empty") {
    return import_react2.default.createElement(
      "div",
      { style: { ...page, gap: "10px", ...rest } },
      import_react2.default.createElement("div", { style: { fontSize: "13px", color: state2.kind === "error" ? state2.error : void 0 } }, state2.text),
      import_react2.default.createElement(
        "button",
        {
          type: "button",
          onClick: refresh,
          disabled: loading,
          style: { ...iconBtn, alignSelf: "flex-start" }
        },
        t("retry")
      )
    );
  }
  return import_react2.default.createElement(
    "div",
    { style: { ...page, ...rest } },
    // refresh 是 useSnapshot 给的整页重取：它换掉整份 snapshot，
    // 顶部三张卡、模型列表、账号列表一起更新，不只更新标题行那几个数。
    import_react2.default.createElement(Overview, { snapshot: { ...snapshot, onRefresh: refresh, loading }, t, fmt: fmt2 }),
    import_react2.default.createElement(ModelSection, { models: snapshot.models, t, fmt: fmt2 }),
    import_react2.default.createElement(AccountSection, { accounts: snapshot.accountCards, t, fmt: fmt2 })
  );
}

// client/CreditsPill.jsx
var import_react3 = __toESM(require("react"), 1);
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
function CreditsPill({ t, fmt: fmt2, useSnapshot: useSnapshot2, pollMs, useProjection }) {
  const { snapshot, error } = useSnapshot2({ pollMs });
  const modelSelection = typeof useProjection === "function" ? useProjection("modelSelection") : void 0;
  const { value, scope, model } = resolveCredits(snapshot, modelSelection);
  if (value === null) return null;
  const title = scope === "model" && model ? `${model}：本期消耗 ${fmt2.credits(value)} 积分` : `${t("pillPeriodHint")}：${fmt2.credits(value)} 积分`;
  if (error) return null;
  return import_react3.default.createElement(
    "div",
    { style: root, "data-composer-credits": true },
    import_react3.default.createElement(
      "span",
      { style: pill, title },
      import_react3.default.createElement(CreditStar),
      fmt2.credits(value)
    )
  );
}

// client/index.js
var name = "workbuddy-credits";
var inject = ["slots", "locale"];
function apply(ctx) {
  try {
    ctx.effect(
      () => ctx.locale.register(LOCALE_NS, {
        zh: DICT_ZH,
        en: DICT_EN
      }),
      "workbuddy-credits: dictionaries"
    );
    const t = ctx.locale.bind(LOCALE_NS);
    ctx.slots.inject(
      "conversation.composer.dock",
      () => ctx.slots.register(
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
          pollMs: DEFAULT_POLL_MS
        })
      )
    );
    ctx.slots.inject(
      "settings.section",
      () => ctx.slots.register(
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
          pollMs: DEFAULT_POLL_MS
        })
      )
    );
  } catch (error) {
    try {
      console.error("workbuddy-credits: 界面未挂载", error);
    } catch {
    }
  }
}

    return module.exports;
  }
});
