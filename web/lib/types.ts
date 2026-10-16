/**
 * 后端 API 的类型镜像。
 *
 * 约定：后端返回 `null` 表示"该值在业务上不适用"，与"字段缺失"（`undefined`）
 * 是两件不同的事。因此这里统一用 `| null` 而非可选属性 —— 让 TypeScript
 * 强制调用方处理"不适用"这一情况，而不是让它在渲染时悄悄变成空白。
 */

// ── 通用 ────────────────────────────────────────────────────────────────

export type TrustLevel = "trusted" | "degraded" | "untrusted";

export type Quadrant =
  | "cheap_good"
  | "cheap_poor"
  | "rich_good"
  | "rich_poor"
  | "unscorable";

export type CriterionOutcome = "pass" | "fail" | "exempt" | "insufficient_data";

/**
 * 快照新鲜度。
 *
 * 判定在服务端完成（`domain/freshness.py`），前端只负责展示 ——
 * 判定逻辑含「A 股长假最长休市约 10 天」这类领域知识，不该散落在视图层。
 */
export interface DataFreshness {
  as_of: string | null;
  /** 落后天数；null 表示无法计算（无快照或缺「今天」）。 */
  age_days: number | null;
  level: "fresh" | "aging" | "stale" | "unknown";
  message: string;
  /**
   * 结论是否**确定**。
   *
   * `false` 表示我们无法区分「长假休市」与「抓取故障」——
   * 此时文案只说事实、不下断言，把判断留给用户。
   */
  definitive: boolean;
  needs_attention: boolean;
}

/**
 * 数据批次状态 —— 全局事实，每个数据页顶部都展示。
 *
 * 它回答「你看到的数字是什么时候的、还能不能用」。三件事必须分开，
 * 因为性质完全不同：
 *
 * | 字段 | 时长 | 对用户的意义 |
 * |---|---|---|
 * | `running` | ~110 秒（瞬时） | 数据正在更新 |
 * | `freshness` | 天/周（持续） | 结论可能已过期 |
 * | `failed` | 到下次成功 | 数据没更新，原因在此 |
 */
export interface DataStatus {
  /** 最近**成功**的批次。 */
  run: RunInfo | null;
  /** 正在运行的批次；null 表示当前没有抓取在进行。 */
  running: RunInfo | null;
  /** 最近一次失败的批次。 */
  failed: RunInfo | null;
  freshness: DataFreshness | null;
  is_updating: boolean;
  /**
   * 最近一次失败是否发生在最近成功**之后**。
   *
   * 只有这种失败才影响当前数据 —— 三天前失败、之后又成功过的批次
   * 对当下结论没有影响，提示它只会制造噪声。
   */
  failed_after_latest: boolean;
}

export interface RunInfo {
  run_id: number;
  as_of: string;
  trust_level: TrustLevel;
  status: "running" | "succeeded" | "failed";
  summary: string;
  contracts_total: number;
  contracts_passed: number;
  security_count: number;
  observation_count: number;
  allows_scoring: boolean;
  started_at: string | null;
  finished_at: string | null;
}

// ── 判据 ────────────────────────────────────────────────────────────────

export interface Exemption {
  kind: string;
  reason: string;
  source: string;
}

export interface CriterionResult {
  criterion: string;
  label: string;
  outcome: CriterionOutcome;
  outcome_label: string;
  observed: number | null;
  threshold: number | null;
  comparator: string;
  detail: string;
  source: string;
  exemption?: Exemption;
  /** 该判据在当前市场**仅部分适用**（如港股第 2 条缺「长期负债 ≤ 净流动资产」）。 */
  partial: boolean;
}

export interface CriteriaReport {
  regime: string;
  regime_label: string;
  passed: number;
  failed: number;
  exempt: number;
  total: number;
  pass_ratio: number;
  summary: string;
  results: CriterionResult[];
}

export interface MarginOfSafety {
  cheapness: number | null;
  quality: number | null;
  penalty: number;
  mos: number | null;
  scorable: boolean;
  quadrant: Quadrant;
  quadrant_label: string;
  coverage: number;
  breakdown: Record<string, number>;
  notes: string[];
}

// ── 估值 ────────────────────────────────────────────────────────────────

export interface PercentileInfo {
  value: number;
  percentile: number | null;
  percentile_pct: number | null;
  sample_size: number;
  min: number;
  max: number;
  median: number;
  is_low: boolean;
  is_high: boolean;
}

export interface IndexValuation {
  code: string;
  name: string;
  pe: number | null;
  pb: number | null;
  dividend_yield: number | null;
  earnings_yield: number | null;
  as_of: string | null;
  pe_percentile: PercentileInfo | null;
}

export interface BreadthStats {
  total: number;
  below_book: number;
  below_book_ratio: number | null;
  low_pe: number;
  pe_unusable: number;
  pe_unusable_ratio: number | null;
  loss_making: number;
  loss_making_ratio: number | null;
  net_net: number;
}

export interface Methodology {
  equity_band: [number, number];
  neutral: number;
  rebalance_band: number;
  rebalance_fraction: number;
  sources: string[];
  caveat: string;
}

export interface ThermometerReading {
  /** 数据批次状态（全局事实，各页一致）。 */
  status?: DataStatus;
  available: boolean;
  stale: boolean;
  message: string;
  run: RunInfo | null;
  as_of?: string;
  temperature?: number | null;
  earnings_yield?: number | null;
  bond_yield?: number | null;
  equity_risk_premium?: number | null;
  suggested_equity_weight?: number | null;
  suggested_bond_weight?: number | null;
  rebalance_action?: string | null;
  signals?: string[];
  indices?: IndexValuation[];
  breadth?: BreadthStats | null;
  methodology?: Methodology;
}

// ── 标的 ────────────────────────────────────────────────────────────────

/**
 * NCAV 构成质量。
 *
 * 账面 NCAV 没有说明安全边际的**质量**：两家 NCAV 相同的公司，
 * 一家全是现金、另一家全是卖不掉的存货，处境完全不同。
 * 本项目不对存货施加折扣率（格雷厄姆本人说清算价值无法准确估算，
 * 且折扣率高度依赖行业），而是展示事实性构成。
 */
export interface NcavComposition {
  current_assets: number | null;
  cash: number | null;
  receivables: number | null;
  inventory: number | null;
  other: number | null;
  hard_assets: number | null;
  ncav_strict: number | null;
  ncav_ex_inventory: number | null;
  total_liabilities: number | null;
  /** 构成科目是否齐全。不齐全时不展示比例（残差会把缺失算进去）。 */
  complete: boolean;
  missing_components: string[];
  cash_share: number | null;
  receivables_share: number | null;
  inventory_share: number | null;
  other_share: number | null;
  /** 剔除存货后 NCAV 即转负 —— 安全边际完全挂在最弱的资产上。 */
  relies_entirely_on_inventory: boolean;
  methodology: string;
}

/** 市场数据能力画像 —— 哪些判据在该市场不适用或仅部分适用。 */
export interface MarketProfile {
  market: string;
  label: string;
  currency: string;
  metric_count: number;
  /** 完全不适用的判据 → 原因。 */
  unavailable_criteria: Record<string, string>;
  /** 仅部分适用的判据 → 缺什么。 */
  partial_criteria: Record<string, string>;
}

export interface KeyMetric {
  label: string;
  value: number | null;
  unit: string;
  /** ok / loss / neg_equity / missing / exempt / abnormal … */
  status: string;
  usable: boolean;
  reason: string;
  digits: number | null;
}

export interface ScoreRow {
  code: string;
  name: string;
  market: string;
  /** 计价币种（`cny` / `hkd`）。跨市场比较金额必须先看它。 */
  currency: string;
  industry: string | null;
  cheapness: number | null;
  quality: number | null;
  penalty: number;
  mos: number | null;
  quadrant: Quadrant;
  coverage: number;
  breakdown: Record<string, number>;
  notes: string[];
  /** 近 20 日日均成交额（当地货币）。判断"便宜能否兑现"的前置条件。 */
  avg_turnover_20d: number | null;
  /** 价格动量（区间涨跌幅，%）。用于判断"便宜"是否已被市场发现。 */
  price_change_1d: number | null;
  price_change_1m: number | null;
  price_change_1y: number | null;
}

export interface TrendSeries {
  label: string;
  unit: string;
  points: [string, number][];
}

export interface NcavView {
  ncav_strict: number | null;
  ncav_loose: number | null;
  market_cap: number | null;
  discount_strict: number | null;
  discount_loose: number | null;
  unavailable_reason: string;
  note: string;
  /**
   * 该市场的口径差异说明（如港股严格口径不含优先股项）。
   *
   * 有值时必须显示 —— 口径与另一市场不同而用户不知道，
   * 会让跨市场比较得出错误结论。
   */
  caliber_note: string;
}

export interface RiskFlag {
  code: string;
  flag_code: string;
  /** `info` 为"仅提示、不参与扣分"（如港股 GEM 板块属性）。 */
  severity: "critical" | "high" | "medium" | "info";
  severity_label?: string;
  title: string;
  detail: string;
  source_query_id: string;
  evidence: string;
  as_of: string | null;
}

/**
 * 一次查询的溯源记录。
 *
 * ⚠️ 快照里**没有** `skill`（上游的接口标识）与 `trace_id`（上游的调用
 * 追踪号）：本站不公开上游身份，`graham.publish` 在落盘前会整键移除它们。
 * 读者要判断的是"这次解析对不对"，那由 `chunks_info` 与
 * `violations` / `warnings` 回答。
 */
export interface ProvenanceEntry {
  query_id: string;
  key_label: string;
  /**
   * 上游接口标识。**公开档案整键抹除**，故可选 ——
   * 界面按存在就渲染处理，不需要知道任何厂商名。
   */
  skill?: string;
  /** 上游调用追踪号。公开档案抹除，理由同上。 */
  trace_id?: string;
  chunks_info: string[];
  status_code: number;
  row_count: number;
  latency_ms: number;
  passed: boolean;
  violations: string[];
  warnings: string[];
}

export interface StockDetail {
  /** 数据批次状态（全局事实，各页一致）。 */
  status?: DataStatus;
  code: string;
  as_of: string | null;
  run: RunInfo | null;
  security: {
    code: string;
    name: string;
    market: string;
    market_label: string;
    industry: string | null;
    board: string | null;
  };
  key_metrics: Record<string, KeyMetric>;
  /** NCAV 的构成质量：流动资产里有多少是现金/应收款/存货。 */
  composition: NcavComposition;
  /** 所属市场的**数据能力画像**：哪些判据不适用或仅部分适用。 */
  market_profile: MarketProfile;
  score: ScoreRow | null;
  criteria: CriteriaReport | null;
  margin: MarginOfSafety | null;
  ncav: NcavView;
  trend: Record<string, TrendSeries>;
  risk_flags: RiskFlag[];
  provenance: ProvenanceEntry[];
  unavailable_signals: string[];
  methodology_notes: string[];
}

// ── 快照元信息与榜单 ────────────────────────────────────────────────────

/**
 * 快照清单 —— 站点上「这份数据是什么」的唯一来源。
 *
 * 快照日、收录范围都从这里读，**不在页面里另写一份**：
 * 两处各写一份必然分叉，而分叉的表现是页面之间说法不一致。
 */
export interface Manifest {
  schema_version: number;
  as_of: string | null;
  /**
   * **数据**批次的生成时刻（来自库中那条 run 记录），不是发布时刻。
   *
   * 刻意不含发布时刻：manifest 描述数据，发布事件的时间由 git 提交记录。
   * 用墙钟时间会让每次发布的字节都不同，四阶段流水线因此永远收敛不了。
   */
  data_generated_at: string | null;
  source_commit: string | null;
  trust_level: string | null;
  contracts: { total: number | null; passed: number | null };
  published: {
    stocks: number;
    funds: number;
    /** 每个市场的**真实**总量（不是发布条数）。 */
    per_market_total: Record<string, number>;
    stock_per_market: number;
    fund_per_category: number;
  };
  artifacts: { path: string; sha256: string; size: number }[];
  disclaimer: string;
}

export interface MarketInfo {
  market: string;
  label: string;
  /** 计价币种（`CNY` / `HKD`）。 */
  currency: string;
  count: number;
}

/**
 * 筛选器榜单快照。
 *
 * ⚠️ 与 API 时代的 `ScreenerPage` 有本质区别：静态站点**只发布排名靠前的
 * 若干只**，因此 `returned`（本站有多少条）与 `total`（全市场有多少条）
 * 是两个不同的数字，**必须分开展示**。
 *
 * 曾经这里只有一个 `total`。裁剪之后若仍只显示它，页面会写
 * "全市场 8,376 只"而列表里只有 100 条 —— 那是本项目最反对的那种
 * "看起来精确"的失真。
 */
export interface ScreenerSnapshot {
  /** 数据批次状态（全局事实，各页一致）。 */
  status?: DataStatus;
  run: RunInfo | null;
  /** 本站实际发布的条数。 */
  returned: number;
  /** 快照中全市场的真实总量。 */
  total: number;
  /** 每个市场的真实总量（用于说明「本站只收录了其中 N 只」）。 */
  per_market: Record<string, number>;
  industries: string[];
  markets: MarketInfo[];
  rows: ScoreRow[];
  /** 收录范围说明。**必须展示** —— 它是「本站不是全量」的唯一交代。 */
  published_note: string;
}

// ── 数据可信度 ──────────────────────────────────────────────────────────

export interface DataHealth {
  latest: RunInfo | null;
  history: RunInfo[];
  contracts: ProvenanceEntry[];
  unavailable_signals: string[];
  index_codes?: string[];
}



// ── 基金（多因子评分）────────────────────────────────────────────────────

/** 一个因子的得分明细。 */
export interface FundFactorScore {
  key: string;
  label: string;
  /** 原始值（年化收益 / 回撤 / 质量分）。 */
  raw: number;
  /** 同类内百分位（0~100，已按方向调整：越高越好）。 */
  percentile: number;
}

/** 因子的声明（由服务端下发，前端不硬编码口径）。 */
export interface FundFactorSpec {
  key: string;
  label: string;
  weight: number;
  direction: "higher_better" | "lower_better";
  min_age_years: number;
  categories: string[];
  description: string;
  /** 原始值的展示单位后缀（`"%"` / `"pp"` / `""`），由服务端声明。 */
  display_unit: string;
}

/** 入池门槛。 */
export interface UniverseGate {
  key: string;
  label: string;
  reason: string;
}

/**
 * 一只基金的评分行。
 *
 * 关键理解：`score` 是**同类内**的相对位置（0~100），
 * 不是跨类别可比的绝对质量。纯债基金年化 5% 是优秀，
 * 偏股基金年化 5% 是平庸 —— 因此绝不能跨类别比较分数。
 */
export interface FundScoreRow {
  code: string;
  name: string;
  category: string;
  category_label: string;
  score: number | null;
  /** 可得因子权重占比。低于门槛时无综合分。 */
  coverage: number;
  /** 同类排名（1 起）。 */
  rank: number | null;
  /**
   * **名次分母**：该类中参与排名的代表基金数。
   *
   * 与 `rank` 同源（都由同一份已排序集合派生），因此恒有
   * `1 <= rank <= peer_count`。界面上的「第 N / M 名」里的 M 就是它。
   */
  peer_count: number;
  /**
   * 该类别的**候选总数**（份额合并之前）。
   *
   * 与 `peer_count` 是两个不同的量：前者回答"这一类共有多少只基金"，
   * 后者回答"名次一共有几档"。早先把两者合并成一个字段，
   * 于是界面上的分母与名次来自不同集合 —— 那句「第 N / M 名」是错的。
   *
   * 可选：旧快照里没有这个字段（它随 `context` 一起落库）。
   */
  universe_size?: number;
  age_years: number;
  size: number | null;
  factors: FundFactorScore[];
  /** 适用但取不到的因子（数据缺失）。 */
  missing: string[];
  /** 本就不适用的因子及原因（如成立年限不足）。 */
  not_applicable: { key: string; reason: string }[];
  /**
   * 被合并到本行的其它份额代码（同一策略的 A/C/E 等份额）。
   *
   * 榜单按「基础名 + 类别」去重，只保留规模最大的份额作代表 ——
   * 同一策略的不同份额持仓完全相同、只是费率结构不同，
   * 让它们各占一行对用户是冗余。
   */
  share_members: string[];
  /** 该策略的份额总数（含本行）。1 表示无其它份额。 */
  share_group_size: number;
  notes: string[];
  context: {
    /** 持有人结构（机构占比 / 户数是识别「机构定制通道」的依据）。 */
    holders: {
      institutional_ratio: number | null;
      retail_ratio: number | null;
      holder_count: number | null;
      avg_holding_shares: number | null;
      is_single_sponsor_vehicle: boolean;
      has_concentrated_risk: boolean;
      disclosure_note: string;
    };
    /** 收益平稳度明细（逐年收益是识别「单年爆发」的直接证据）。 */
    smoothness: {
      worst: number;
      best: number;
      spread: number;
      positive_years: number;
      total_years: number;
      /** 逐年收益（第 1 年在前）。 */
      years: number[];
    } | null;
    equity_ratio: number | null;
    top10_weight: number | null;
    manager_tenure: number | null;
    holdings_coverage: number;
    cumulative_returns: Record<string, number>;
    drawdowns: Record<string, number>;
  };
}

export interface FundGroup {
  category: string;
  label: string;
  count: number;
  rows: FundScoreRow[];
}

export interface FundListResponse {
  /** 数据批次状态（全局事实，各页一致）。 */
  status?: DataStatus;
  run: RunInfo | null;
  groups: FundGroup[];
  /** 通过门槛进入评分池的基金总数。 */
  universe: number;
  gates: UniverseGate[];
  factors: FundFactorSpec[];
}

export interface EtfRow {
  code: string;
  name: string;
  tracked_index: string;
  management_fee: number | null;
  fund_size: number | null;
}


/** 基金评分的完整详情（比列表多持仓明细）。 */
export interface FundDetail extends FundScoreRow {
  holdings: {
    stock_code: string | null;
    stock_name: string;
    weight: number | null;
    rank: number;
  }[];
}


// ── 搜索（⌘K 命令面板）──────────────────────────────────────────────────

/**
 * 可被搜索到的资产类别 —— 与后端 `graham.domain.search.AssetKind` 一一对应。
 *
 * 它与 `market`（a_share / hk_share / fund）不是同一个轴：
 * `market` 决定币种与判据口径，`kind` 决定**用哪套结论、去哪一页** ——
 * 港股与 A 股同属 `"stock"`（都走个股页），基金是另一个类别。
 *
 * 契约测试（`tests/unit/test_frontend_contracts.py`）断言这个联合
 * 与后端枚举取值完全一致：后端新增一类资产而这里没跟上时，测试会失败。
 */
export type AssetKind = "stock" | "fund";

/** 匹配分层：前缀命中排在中间命中之前（后端随行带出，前端不自己推断）。 */
export type MatchTier = "prefix" | "infix";

/** 个股命中的结论。 */
export interface StockSearchDetail {
  industry: string | null;
  /** 安全边际（%）。 */
  mos: number | null;
}

/**
 * 基金命中的结论 —— **同类**排名，绝不跨类别比较。
 *
 * `rank` 必须与 `category_label`、`peer_count` 一起展示：
 * "第 12 名"离开类别与分母就不可解读。中文类别名由服务端给，
 * 前端不维护类别映射（新增类别时那张表会静默显示英文键名）。
 */
export interface FundSearchDetail {
  category: string;
  category_label: string;
  score: number | null;
  rank: number | null;
  peer_count: number;
  /** 类别候选总数（份额合并之前）；旧快照可能没有。 */
  universe_size?: number;
}

/**
 * 一条搜索结果 —— 判别联合。
 *
 * `kind` 决定 `detail` 的实际形状。用联合而不是"带一堆可选字段的宽对象"，
 * 是为了让新增一类资产时**编译期**就报错（`Record<AssetKind, …>` 与穷尽分支），
 * 而不是运行时读到 `undefined` 后显示空白。
 */
export type SearchHit =
  | {
      kind: "stock";
      code: string;
      name: string;
      match_tier: MatchTier;
      detail: StockSearchDetail;
    }
  | {
      kind: "fund";
      code: string;
      name: string;
      match_tier: MatchTier;
      detail: FundSearchDetail;
    };

/**
 * 精确代码存在、却不在本批次评分结果中的解释。
 *
 * ⚠️ 静态站点**不再产生**这个结构：它需要完整的标的清单才能区分
 * "代码存在但不在评分池里"与"根本没有这个代码"，而本站只收录排名靠前的
 * 部分标的，拿不到那份清单。空结果统一走 `SearchIndex.published_note`
 * 给出的收录范围说明（见 `command-palette.tsx` 的 `ScopeNotice`）。
 *
 * 类型保留在这里是为了记录**曾经有过**的区分口径，它仍是本项目
 * "静默失败要变成响亮失败"这一主张的具体形态。
 */
export interface UnmatchedCode {
  code: string;
  name: string;
  market: string;
  /** 面向人的一句解释，可直接展示。 */
  reason: string;
}

/**
 * 搜索索引里的一条。
 *
 * 形状刻意与后端 `/api/search` 的 `SearchHit` 对齐（少一个 `match_tier` ——
 * 那是**按查询词**算出来的，不能在构建期固化）。于是面板的渲染分支与契约
 * 测试都不需要为静态站点改写。
 */
export interface SearchIndexEntry {
  kind: AssetKind;
  code: string;
  name: string;
  /** 市场标识（`a_share` / `hk_share` / `fund`）。 */
  market: string;
  detail: StockSearchDetail | FundSearchDetail;
}

/** 随站点发布的搜索索引。 */
export interface SearchIndex {
  entries: SearchIndexEntry[];
  /** 收录范围说明 —— 搜不到时要把它展示出来，而不是只说"没有匹配"。 */
  published_note: string;
}

// ── 策略与方法论（仅工作台档案发布）──────────────────────────────────────
//
// ★ 这三组类型描述的是公开档案**扣留**的产物（见 `ui-profiles.json`）。
//   对应的页面必须先确认能力存在（`lib/route-guard.ts`），否则读到的是
//   空数组而不是"没有这一页"。

export interface StrategySummary {
  strategy_id: string;
  label: string;
  description: string;
  hit_count: number;
  universe_size: number;
  selectivity: number | null;
  caveats: string[];
}

export interface StrategyHit {
  code: string;
  name: string;
  industry: string | null;
  rank: number;
  mos: number | null;
  quality: number | null;
  /** 计价币种（`cny` / `hkd`）—— 命中表会同时出现 A 股与港股。 */
  currency: string;
  extra: Record<string, unknown>;
  notes: string[];
  /**
   * 本站是否有这条命中的详情页。
   *
   * 详情页只覆盖快照收录范围内的标的，因此命中列表里会有一部分行点不进去。
   * 前端据此把它们渲染成纯文本，而不是给出一个会 404 的链接 ——
   * 本项目对"边界"的一贯做法是把它说出来。
   */
  has_detail?: boolean;
}

export interface StrategyHitDetailResponse {
  hits: StrategyHit[];
  run: RunInfo | null;
  status?: DataStatus;
}

export interface CriterionSpec {
  id: string;
  label: string;
  orthodox: string;
  modern: string;
  source: string;
  caveat: string | null;
}

export interface QueryContract {
  query_id: string;
  market: string;
  market_label: string;
  skill: string;
  question: string;
  required_metrics: string[];
  row_bounds: [number, number];
  critical: boolean;
  purpose: string;
  notes: string;
}
