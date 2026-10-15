
import contract from "@/ui-profiles.json";

/**
 * 一个表面**存在**所需的一项前提。
 *
 * ★ 把前提显式建模成数据，而不是在判定函数里写分支 —— 这是本模块的核心
 * 取舍，来自一个真实教训：上一版 `hasCapability` 是 `switch`，每加一项能力
 * 就要改同一个函数。分支一多，"哪些前提"就变成了散在控制流里的知识，
 * 而它本该是一张**读得出来的表**。
 */
export type Requirement =
  /** 需要某个产物已发布 —— 数据不该在界面里"看起来有"。 */
  | { readonly kind: "artifact"; readonly id: string }
  /** 需要运行时进程 —— 写操作、子进程、外部仓库访问都要它。 */
  | { readonly kind: "server" };

/** 需要按档案决定"存不存在"的产品表面。 */
export type Capability = "strategies" | "methodology" | "publishing" | "automation";

/**
 * 每项能力的**前提表** —— 单一事实源。
 *
 * | 能力 | 前提 | 为什么 |
 * |---|---|---|
 * | `strategies` | 策略产物已发布 | 没有数据的页面会渲染成"今天没命中"，比 404 更误导 |
 * | `methodology` | 判据清单与契约已发布 | 同上 |
 * | `publishing` | 服务端 | 要起子进程、写外部仓库 |
 * | `automation` | 服务端 | 要写配置、触发抓取，都是写操作 |
 *
 * ★ **新增一项能力 = 这里加一行**（外加页面首行调 `requireCapability`）。
 * 若该能力还需要服务端，同时把源码路径登记进 `publish_site.py` 的
 * `SERVER_ONLY_SOURCE_PATHS`，让公开投影整条剪除。
 */
const CAPABILITY_REQUIREMENTS: Record<Capability, readonly Requirement[]> = {
  strategies: [{ kind: "artifact", id: "strategies.json" }],
  methodology: [
    { kind: "artifact", id: "methodology.json" },
    { kind: "artifact", id: "contracts.json" },
  ],
  publishing: [{ kind: "server" }],
  automation: [{ kind: "server" }],
};

/** 披露级别 —— 产物发布了，但内部标识要不要露出来。 */
export interface DisclosurePolicy {
  /** 是否展示数据来源身份（厂商名、接口标识、调用追踪号）。 */
  readonly upstreamIdentity: boolean;
  /** 是否展示判据**出处**（书名与章节）。 */
  readonly criterionSources: boolean;
}

export interface UiProfile {
  readonly id: string;
  readonly label: string;
  /**
   * 本部署是否有**服务端**。
   *
   * 这一项决定的不是"要不要渲染"，而是"这个部署能不能执行写操作"：
   * 静态导出（`output: "export"`）没有运行时进程，因此 Route Handler 与
   * Server Action 都不存在。工作台跑在 `next dev` / `next start` 上，有。
   */
  readonly server: boolean;
  /** 未发布的产物。能力判定从它派生，避免"档案叫什么"成为第二事实源。 */
  readonly withheldArtifacts: readonly string[];
  readonly disclosure: DisclosurePolicy;
}

/**
 * 选择档案的环境变量。
 *
 * 带 `NEXT_PUBLIC_` 前缀：构建期由服务端组件与浏览器产物**同时**读取，
 * 从而只有一个取值来源。拆成两个变量（一个给服务端、一个给客户端）必然会
 * 有人只改其中一个，症状是"首屏有策略入口、点进去 404"。
 */
export const PROFILE_ENV = "NEXT_PUBLIC_UI_PROFILE";

interface RawProfile {
  label?: string;
  server?: boolean;
  withheld_artifacts?: string[];
  redact_upstream_identity?: boolean;
  strip_criterion_sources?: boolean;
}

const PROFILES: Record<string, RawProfile> = contract.profiles ?? {};
const DEFAULT_ID: string = contract.default_profile ?? "workbench";

/** 把契约里的一条原始记录物化成档案对象。 */
function materialise(id: string, raw: RawProfile): UiProfile {
  return {
    id,
    label: raw.label ?? id,
    // 缺省 false（保守方向）：漏写 `server` 时应当退化成"没有服务端"，
    // 而不是凭空获得执行写操作的能力。
    server: raw.server === true,
    withheldArtifacts: raw.withheld_artifacts ?? [],
    disclosure: {
      upstreamIdentity: raw.redact_upstream_identity !== true,
      criterionSources: raw.strip_criterion_sources !== true,
    },
  };
}

/**
 * 解析档案标识。
 *
 * 未知标识**抛错**而不是回落到缺省值：一个拼错的 `NEXT_PUBLIC_UI_PROFILE`
 * 若被当成工作台，构建出的公开站会带上策略页与厂商名 —— 而那是不可逆的。
 * 宁可当场失败。
 */
export function resolveUiProfile(raw?: string | null): UiProfile {
  const id = (raw ?? "").trim() || DEFAULT_ID;
  const found = PROFILES[id];
  if (!found) {
    const known = Object.keys(PROFILES).sort().join("、");
    throw new Error(`未知的 UI 档案 ${JSON.stringify(id)}；可选：${known}`);
  }
  return materialise(id, found);
}

/**
 * 构建期注入的档案标识。
 *
 * ★ **必须用字面量属性访问**（`process.env.NEXT_PUBLIC_UI_PROFILE`），不能用
 * `process.env[PROFILE_ENV]`。Next 的静态替换只认前者：它会把这个**字面量
 * 表达式**整个替换成注入的字符串；而计算属性访问在浏览器产物里求值为
 * `undefined`，于是静默落到契约缺省值。
 *
 * 后果不对称，所以这里格外强调：缺省值恰好是 `workbench`，即**公开站会按
 * 工作台档案渲染** —— 导航里出现策略入口、点进去 404。这正是构建期守卫
 * 存在的理由，而它检查的是服务端那一次解析，管不到客户端这一次。
 *
 * 标识本身由 `next.config.ts` 用 :func:`assertSnapshotUsable` 解析**一次**，
 * 再通过 `env` 注入。单点解析 + 单一取值路径 = 构建期与浏览器不可能分叉。
 */
const INJECTED_PROFILE_ID: string | undefined = process.env.NEXT_PUBLIC_UI_PROFILE;

/** 当前构建生效的档案（模块加载时解析一次）。 */
export const UI_PROFILE: UiProfile = resolveUiProfile(INJECTED_PROFILE_ID);

/**
 * 某个表面在当前档案下是否存在。
 *
 * ★ 判据是**前提是否满足**，而不是"档案叫什么" —— 这样两侧不会因为措辞
 * 不同而各说各话：JSON 里把 `strategies.json` 加进 `withheld_artifacts`，
 * 引擎就不再产出它，UI 也同时不再给出入口，只有一处要改。
 *
 * 求值是"**所有前提都满足**"的合取。因此这里没有分支 —— 新增能力改的是
 * `CAPABILITY_REQUIREMENTS` 那张表，而不是本函数。这一点是刻意的：分支
 * 落在函数里时，"这项能力需要什么"就散进了控制流，读不出来。
 */
export function hasCapability(capability: Capability): boolean {
  return CAPABILITY_REQUIREMENTS[capability].every(satisfies);
}

/** 单项前提是否满足。 */
function satisfies(requirement: Requirement): boolean {
  switch (requirement.kind) {
    case "artifact":
      return !UI_PROFILE.withheldArtifacts.includes(requirement.id);
    case "server":
      // 需要真正的运行时进程：写操作要落盘、要起子进程。
      // 静态导出没有运行时，因此这一项在公开站上恒为 false。
      return UI_PROFILE.server;
    default: {
      // ★ 穷尽性守卫。`strict` 不含 `noImplicitReturns`，所以漏掉一个
      // `kind` 时函数会静默返回 `undefined` —— 而 `Array.every` 把
      // `undefined` 当假值，于是**新增的前提会被当成不满足**，页面莫名 404。
      // 这里让它在编译期就报错。
      const exhaustive: never = requirement;
      throw new Error(`未处理的前提类型：${JSON.stringify(exhaustive)}`);
    }
  }
}

/** 当前档案下各能力的状态（供诊断与页面展示）。 */
export function capabilityReport(): { capability: Capability; granted: boolean }[] {
  return (Object.keys(CAPABILITY_REQUIREMENTS) as Capability[]).map((capability) => ({
    capability,
    granted: hasCapability(capability),
  }));
}

/** 是否展示数据来源身份。 */
export function showsUpstreamIdentity(): boolean {
  return UI_PROFILE.disclosure.upstreamIdentity;
}

/** 是否展示判据出处。 */
export function showsCriterionSources(): boolean {
  return UI_PROFILE.disclosure.criterionSources;
}
