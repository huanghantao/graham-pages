
import contract from "@/ui-profiles.json";

/**
 * 需要按档案决定"存不存在"的产品表面。
 *
 * ★ 每项能力的**前提不同**，所以在 :func:`hasCapability` 里各自求值：
 *
 * | 能力 | 前提 | 为什么 |
 * |---|---|---|
 * | `strategies` | 策略产物已发布 | 没有数据的页面会渲染成"今天没命中"，比 404 更误导 |
 * | `methodology` | 判据清单与契约已发布 | 同上 |
 * | `publishing` | 本部署**有服务端** | 它要执行写操作，静态导出没有运行时进程 |
 *
 * 新增一项能力 = 这里加一个联合成员 + `hasCapability` 加一个分支 +
 * 页面首行调用 `requireCapability`。若它还需要服务端，则同时把源码路径
 * 登记进 `publish_site.py` 的 `SERVER_ONLY_SOURCE_PATHS`，让公开投影剪掉它。
 */
export type Capability = "strategies" | "methodology" | "publishing";

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

/** 当前构建生效的档案（由环境变量决定，模块加载时解析一次）。 */
export const UI_PROFILE: UiProfile = resolveUiProfile(process.env[PROFILE_ENV]);

/**
 * 某个表面在当前档案下是否存在。
 *
 * ★ 判据是**前提是否满足**，而不是"档案叫什么" —— 这样两侧不会因为措辞
 * 不同而各说各话：JSON 里把 `strategies.json` 加进 `withheld_artifacts`，
 * 引擎就不再产出它，UI 也同时不再给出入口，只有一处要改。
 *
 * 用 `switch` 而不是若干 `if`：新增能力时 `never` 兜底会让**编译期**报错，
 * 而不是悄悄回落到某个默认分支（那正是"新页面在公开站上泄漏"的成因）。
 */
export function hasCapability(capability: Capability): boolean {
  const withheld = (artifact: string) => UI_PROFILE.withheldArtifacts.includes(artifact);

  switch (capability) {
    case "strategies":
      return !withheld("strategies.json");
    case "methodology":
      return !withheld("methodology.json") && !withheld("contracts.json");
    case "publishing":
      // 需要真正的服务端进程：写操作要落盘、要起子进程。
      // 静态导出没有运行时，因此这一项在公开站上恒为 false。
      return UI_PROFILE.server;
    default: {
      const exhaustive: never = capability;
      throw new Error(`未处理的能力：${String(exhaustive)}`);
    }
  }
}

/** 是否展示数据来源身份。 */
export function showsUpstreamIdentity(): boolean {
  return UI_PROFILE.disclosure.upstreamIdentity;
}

/** 是否展示判据出处。 */
export function showsCriterionSources(): boolean {
  return UI_PROFILE.disclosure.criterionSources;
}
