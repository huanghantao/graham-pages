/**
 * CLI 桥 —— 把工作台的界面接到 Python 引擎上。
 *
 * ## 为什么界面不直接实现业务
 *
 * 发布、配置调度、改通知渠道 —— 这些规则的**唯一实现**都在引擎里
 * （`scripts/publish_site.py`、`graham automation`）。在 TypeScript 里重写
 * 任何一条都会产生第二事实源，而本项目已经因为"两处声明分叉"吃过两次亏：
 * 一次是策略页被从共用源码里删掉，一次是同步脚本用旧快照盖掉新快照。
 *
 * 因此界面这一侧只做三件事：**校验调用方、起子进程、把结果带回来**。
 *
 * ## 为什么抽成模块而不是各路由各写一份
 *
 * 发布与自动化是两个路由，但它们的这两个关注点完全相同：
 * 本机来源校验、解释器探测、stdin 传参。复制一份就意味着"下次改守卫要记得
 * 改两处" —— 而漏改的那一处不会有任何症状。
 *
 * ## 与框架解耦
 *
 * 本模块**不 import Next**：校验函数返回判别联合而不是 `NextResponse`。
 * 这样它可以被单独测试，也保留了"将来换个 HTTP 层"的余地。
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** 仓库根（`web/` 的上一级）。脚本、数据库都相对它定位。 */
export const REPO_ROOT = path.resolve(process.cwd(), "..");

/** 一次 CLI 调用的墙钟上限。全量发布与 ETL 各在数十秒量级。 */
export const CLI_TIMEOUT_MS = 180_000;

/**
 * 解析运行引擎用的解释器。
 *
 * ★ 这是实测踩出来的：直接调 `python3` 会落到**系统解释器**上，而引擎通常
 * 装在项目的 `.venv` 里，于是脚本一开头就 `ModuleNotFoundError: No module
 * named 'graham'` —— 界面只显示一句 import 失败，看不出"该用哪个 python"。
 *
 * 因此按优先级探测，而不是要求用户先设环境变量：
 * 1. `GRAHAM_PYTHON` —— 显式指定（CI、非标准布局）；
 * 2. `<repo>/.venv/bin/python` —— README 推荐的安装方式，命中即用；
 * 3. `python3` —— 兜底（引擎若装进系统解释器，这条能work）。
 */
export function resolvePython(): { executable: string; source: string } {
  const override = process.env.GRAHAM_PYTHON?.trim();
  if (override) return { executable: override, source: "GRAHAM_PYTHON" };

  const venv = path.join(REPO_ROOT, ".venv", "bin", "python");
  if (fs.existsSync(venv)) return { executable: venv, source: "项目 .venv" };

  return { executable: "python3", source: "PATH 上的 python3" };
}

/** 本机来源校验的结论。用判别联合而非抛错/框架对象，便于单独测试。 */
export type LocalCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: number; readonly error: string };

/**
 * 判断请求是否来自本机同源。
 *
 * ⚠️ **能力边界，必须说清**：Next 的 Route Handler 拿到的是 Web `Request`，
 * **取不到 socket 对端地址**，因此做不到 `graham/api/app.py` 里那种
 * `request.client.host` 判定。这里退而求其次，用两个可伪造但**能挡住真实
 * 威胁**的检查：
 *
 * * `Host` 必须是回环地址 —— 挡住 DNS 重绑定（攻击者把域名解析到
 *   127.0.0.1，浏览器就会把请求连到本机服务）；
 * * `Origin` 若存在必须同源 —— 挡住跨站提交（浏览器强制带上 Origin，
 *   且页面脚本改不了它）。
 *
 * 真正的前提是**服务只监听回环**（`next dev` 默认如此）。若把工作台暴露到
 * 局域网或公网，这一层挡不住直接请求 —— 那属于部署错误，不是本函数能兜住的。
 */
export function checkLocalRequest(request: Request): LocalCheck {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  // 去掉端口与 IPv6 方括号后判定回环。用剥壳而不是 `split(":")`：
  // `[::1]:3000` 按冒号切会切碎，而那正是会静默放行/误拒的分支。
  const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  const loopback = ["127.0.0.1", "localhost", "::1"];
  if (!loopback.includes(hostname)) {
    return { ok: false, status: 403, error: "该接口只接受本机请求。" };
  }

  const origin = request.headers.get("origin");
  if (origin !== null) {
    let sameOrigin = false;
    try {
      // 直接比对 `host:port`：Origin 的 host 字段本就含端口（默认端口为空），
      // 与 Host 头形态一致，比手工拆端口可靠。
      sameOrigin = new URL(origin).host.toLowerCase() === host;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) {
      return { ok: false, status: 403, error: "该接口只接受同源请求。" };
    }
  }
  return { ok: true };
}

/** 一次 CLI 调用的结果。 */
export interface CliResult {
  readonly ok: boolean;
  readonly exitCode: number | null;
  readonly elapsedMs: number;
  /** 脚本的原样输出 —— 不解析、不改写，避免与引擎分叉。 */
  readonly stdout: string;
  readonly stderr: string;
  /** 用了哪个解释器。用户改了 `GRAHAM_PYTHON` 却没生效时，这是唯一能看出来的地方。 */
  readonly python: string;
}

/**
 * 起一次 `python -m graham.cli …` 并把结果原样带回来。
 *
 * 载荷走 **stdin 而不是命令行参数**：配置里含 webhook 地址，而 argv 会出现在
 * 进程列表里（`ps aux` 任何人都看得到）。stdin 不进进程列表，也不受 shell
 * 引号转义之苦。
 *
 * Args:
 *   args: 传给 `graham.cli` 的参数（不含解释器与 `-m graham.cli`）。
 *   stdin: 需要写入标准输入的内容；写入类命令用它传 JSON 载荷。
 *   timeoutMs: 墙钟上限。
 *
 * Returns:
 *   调用结果。**进程起不来也算结果**（`exitCode` 为 `null`），而不是抛错 ——
 *   调用方要的是"能用一句话说清为什么失败"，不是一段堆栈。
 */
export function runGrahamCli(
  args: readonly string[],
  options: { stdin?: string; timeoutMs?: number } = {},
): CliResult {
  const python = resolvePython();
  const started = Date.now();
  const result = spawnSync(
    python.executable,
    ["-m", "graham.cli", ...args],
    {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      timeout: options.timeoutMs ?? CLI_TIMEOUT_MS,
      input: options.stdin,
      // 引擎在 repo 根的 src/ 下；非可编辑安装时靠这行兜底。
      env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, "src") },
    },
  );

  return {
    ok: result.status === 0,
    exitCode: result.status,
    elapsedMs: Date.now() - started,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    python: python.executable,
  };
}
