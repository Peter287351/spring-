/* zcode-workflow
description: 深度解析后端项目（主打 Spring Boot）：侦察结构与模块 → 按模块并行深挖并独立复核 → 汇总全局架构与导读 → 初学者视角复审 → 生成单文件 HTML 报告
args:
  projectPath:
    type: string
    required: false
    default: .
    description: 目标后端项目根目录（相对当前工作区，"." 表示工作区本身）
  outDir:
    type: string
    required: false
    default: docs/analysis
    description: 分析文档输出目录（相对项目根）
  reportBuilder:
    type: string
    required: false
    default: ""
    description: HTML 报告生成器脚本（backend-analyzer 技能自带）的绝对路径，如 C:/Users/<你>/.agents/skills/backend-analyzer/scripts/build_report.mjs；留空则无法生成 HTML，请在调用时传入
*/

interface ModuleInfo {
  /** 模块英文短名，用作文档文件名，如 auth、student */
  name: string;
  /** 模块中文名，如「认证模块」 */
  title: string;
  /** 模块主包或目录，相对项目根（拼接 projectPath 后才是工作区路径） */
  path: string;
  /** 职责一句话 */
  summary: string;
  /** 该模块全部入口点：HTTP 方法+路径+类.方法，或定时任务/消费者描述 */
  entryPoints: string[];
  /** 划分为模块的证据：包结构/URL 前缀/表名 */
  evidence: string;
}
interface ReconResult {
  /** 项目名 */
  projectName: string;
  /** 技术栈一句话：框架版本、持久层、数据库、中间件 */
  stackSummary: string;
  /** 业务模块清单（≤10 个，多则合并小的并在 summary 说明） */
  modules: ModuleInfo[];
  /** 支撑设施：common/config 等包提供什么 */
  support: string;
  /** 数据表清单 */
  tables: string[];
}

interface ReviewResult {
  /** 复核是否通过 */
  pass: boolean;
  /** 问题清单，pass 为 true 时可为空 */
  issues: { /** 位置：文档小节或 证据 文件:行号 */ where: string; /** 一句话说清问题 */ problem: string }[];
}
interface ReaderResult {
  issues: { /** 哪一段/哪个小节 */ where: string; /** 什么问题（看不懂/缺证据/缺内容） */ problem: string }[];
}

const projectPath = args.projectPath === undefined ? "." : String(args.projectPath).replace(/\/+$/, "");
const userOutDir = args.outDir === undefined ? "docs/analysis" : String(args.outDir);
const outDir = projectPath === "." ? userOutDir : `${projectPath}/${userOutDir}`;
const builderPath = args.reportBuilder === undefined || String(args.reportBuilder) === ""
  ? ""
  : String(args.reportBuilder);
const skillDir = builderPath.replace(/[\\/]scripts[\\/]build_report\.mjs$/i, "");
const REFS = `${skillDir}/references`;

const COMMON_RULES =
  `通用铁律：\n` +
  `1) 全程中文；2) 每个论断附「相对路径:行号」证据，无代码依据的判断写「> ⚠️ 推测：」；\n` +
  `3) 不修改业务代码，只允许在 ${outDir}/ 下写文件；\n` +
  `4) 模块 = 业务域；5) 单张 Mermaid 图 ≤ 15 节点，标签含特殊字符必须整体加英文引号，节点 id 用英文；\n` +
  `6) 目标项目根目录 = ${projectPath}（相对当前工作区；"." 即工作区本身）：读写源码都用这个前缀拼路径，但文档里引用的证据路径相对项目根书写。\n`;

log(`开始解析后端项目，输出目录：${outDir}`);

// ---------- 阶段 1：侦察 ----------
phase("侦察项目结构与技术栈");
const recon = await agent("侦察员", {
  system: "你是后端项目侦察专家，只读不写，判断有据。",
}).ask<ReconResult>(
  COMMON_RULES +
  `先读方法论（存在才读，不存在就凭摘要执行）：${REFS}/spring-boot-playbook.md\n` +
  `任务：侦察目标项目（根目录 ${projectPath}）。\n` +
  `1) 读构建文件与配置（pom.xml / build.gradle、application*.yml / .properties、启动类）得到技术栈；\n` +
  `2) grep 枚举全部入口点：@RestController/@Controller 及各类 @xxxMapping、@Scheduled、@KafkaListener/@RabbitListener 等；\n` +
  `3) 按业务域划分模块（不是 controller/service 分层包），每个模块给出 name(英文短名)/title(中文)/path(相对项目根)/summary/entryPoints(该模块全部入口点清单)/evidence(划分证据)；模块超过 10 个时合并小的并在 summary 里说明；\n` +
  `4) 列出支撑设施（common/config 等提供了什么）与全部数据表。\n` +
  `只侦察与划分，不写任何文档文件。`
);
log(`侦察完成：${recon.projectName}，${recon.modules.length} 个业务模块：${recon.modules.map((m) => m.name).join("、")}`);

// 进度看板：每个模块一张卡，随状态更新
artifact.board("modules", {
  title: "模块分析进度",
  key: "name",
  status: "status",
  columns: ["已产出", "已复核", "需返工"],
  cardTitle: "name",
  detail: [{ field: "docPath", label: "文档" }],
});

// ---------- 阶段 2：逐模块并行深挖 + 独立复核 ----------
phase("逐模块并行深挖并复核");
const moduleOutcomes = await Promise.all(
  recon.modules.map(async (mod, idx) => {
    const docPath = `${outDir}/modules/${mod.name}.md`;
    const writer = agent(`深挖-${mod.name}`, {
      system: "你是后端架构分析专家：只依据代码说话，流程图忠实反映实现。",
    });

    await writer.ask(
      COMMON_RULES +
      `先读方法论（存在才读）：${REFS}/doc-templates.md、${REFS}/mermaid-rules.md\n` +
      `任务：深挖业务模块「${mod.title}（${mod.name}）」，主包 ${projectPath === "." ? mod.path : `${projectPath}/${mod.path}`}（源码读取路径）。文档内引用证据时仍用相对项目根的路径。\n` +
      `模块概述：${mod.summary}\n` +
      `入口点清单（不得遗漏）：\n${mod.entryPoints.map((e) => `- ${e}`).join("\n")}\n` +
      `按 doc-templates 的模块模板写 ${docPath}：\n` +
      `- 职责与边界、功能清单表（覆盖上面全部入口点）；\n` +
      `- 每个功能一节：设计意图 → Mermaid 流程图（正常+失败分支，关键节点带 文件:行号）→ 步骤表 → 流程跳转 → 设计评价；追链必须追到 SQL 与数据表，拦截器/AOP/事务等横切关注点画进流程；\n` +
      `- 数据表小节；\n` +
      `- 优化建议：过一遍 ${REFS}/spring-boot-playbook.md 第 6 节检查清单，命中的按五段式（现状证据→问题→影响→建议方案→预期收益）写，编号用 O${idx + 1}-1、O${idx + 1}-2……（模块序号 ${idx + 1}），证据行号必须真实。\n` +
      `写完把文档落盘到 ${docPath}。`
    );
    report({ name: mod.name, status: "已产出", docPath }, "modules");

    let verdict: ReviewResult = { pass: true, issues: [] };
    for (let round = 1; round <= 2; round++) {
      const reviewer = agent(`复核-${mod.name}-第${round}轮`, {
        system: "你是证据复核员：独立、挑剔，只读不改，抽查要动真格打开文件核对。",
      });
      verdict = await reviewer.ask<ReviewResult>(
        COMMON_RULES +
        `任务：独立复核刚生成的 ${docPath}（你没参与写作）。\n` +
        `1) 从文档里抽 5 处「文件:行号」证据，打开源文件核对该行号 ±3 行是否真的支撑所述内容；发现虚构、张冠李戴、行号差太远都要记下；\n` +
        `2) 对每张 mermaid 流程图抽 2-3 个关键节点（尤其分支与失败出口），核对代码里的 if/异常处理是否与图中一致；\n` +
        `3) 检查每个 mermaid 块：首行是否是已知图类型（flowchart/sequenceDiagram/stateDiagram-v2/erDiagram 等）、[" 与 "] 数量是否配对；\n` +
        `4) 结构完整性：功能清单是否覆盖模块全部入口点、每个功能是否含设计意图/流程图/步骤表/流程跳转/设计评价、优化建议是否五段式俱全；\n` +
        `5) 图节点数是否超 15。\n` +
        `只报告问题，不修改任何文件。pass = 无实质问题（文字风格类的小瑕疵不算）。`
      );
      if (verdict.pass) {
        report({ name: mod.name, status: "已复核", docPath }, "modules");
        break;
      }
      report({ name: mod.name, status: "需返工", docPath }, "modules");
      if (round === 2) break;
      await writer.ask(
        `独立复核员对 ${docPath} 提出以下问题，逐条修复（改文档本身，用你的文件工具）：\n` +
        JSON.stringify(verdict.issues, null, 2) +
        `\n修复完成后回复"已修复 N 处"。`
      );
    }
    return { mod, docPath, review: verdict };
  })
);
const unresolved = moduleOutcomes.filter((o) => !o.review.pass);
log(`模块深挖完成：${moduleOutcomes.length} 份文档，其中 ${unresolved.length} 份复核仍有未解决问题`);

// ---------- 阶段 3：汇总架构与导读 ----------
phase("汇总全局架构与导读");
const synthesizer = agent("汇总人", {
  system: "你是技术文档主编：面向后端初学者写作，结构严整，引用有据。",
});
await synthesizer.ask(
  COMMON_RULES +
  `先读方法论（存在才读）：${REFS}/doc-templates.md、${REFS}/mermaid-rules.md\n` +
  `背景：项目「${recon.projectName}」已完成 ${moduleOutcomes.length} 份模块文档：\n${moduleOutcomes.map((o) => `- ${o.docPath}（${o.mod.title}）`).join("\n")}\n` +
  `技术栈：${recon.stackSummary}\n支撑设施：${recon.support}\n数据表：${recon.tables.join("、")}\n` +
  `任务：通读全部模块文档（用你的文件工具读），然后写两份文档：\n` +
  `1) ${outDir}/00-architecture.md —— 按 doc-templates 模板 §2：项目概览、系统分层图、模块划分表（含划分证据）、模块关系图（flowchart LR，每条边注明联系类型与证据）、ER 图、一个代表性请求的完整时序图、优化建议汇总表（编号已在各模块文档里带前缀如 O2-1，汇总表用锚点链接到模块文档对应小节）；\n` +
  `2) ${outDir}/README.md —— 按模板 §1：一句话理解项目、建议阅读顺序（说明为什么是这个顺序）、快速上手路径（可执行步骤+证据）、术语速查表。\n` +
  `两份文档里的模块划分、表清单必须与模块文档一致，不得引入模块文档里没有的新论断。`
);

// ---------- 阶段 4：初学者视角独立复审 ----------
phase("初学者视角独立复审");
const coldReader = agent("独立初读者", {
  system: "你是刚入门的后端学习者：没参与写作，以读者视角挑毛病，只读不改。",
});
const coldVerdict = await coldReader.ask<ReaderResult>(
  `任务：以"第一次接触这个项目的初学者"视角冷读 ${outDir}/README.md 和 ${outDir}/00-architecture.md。\n` +
  `列出：哪里看不懂（缺上下文/术语没解释）、哪个论断没有证据或证据存疑（可抽查 文件:行号）、模块关系讲清楚了没有、阅读顺序合理吗、还缺什么。\n` +
  `每条问题给 where（小节/段落）与 problem（一句话）。只报告，不修改文件。`
);
if (coldVerdict.issues.length > 0) {
  await synthesizer.ask(
    `独立初读者对导读与总架构提出以下问题，逐条修复（只改 ${outDir}/README.md 与 ${outDir}/00-architecture.md）：\n` +
    JSON.stringify(coldVerdict.issues, null, 2) +
    `\n修复后回复"已修复 N 处"。`
  );
  log(`初读者复审：${coldVerdict.issues.length} 条问题已交汇总人修复`);
} else {
  log("初读者复审：未发现问题");
}

// ---------- 阶段 5：构建 HTML 并交付 ----------
phase("生成 HTML 报告并交付");
let build = await world.run("node", [builderPath, "--src", outDir], { timeoutMs: 180_000 });
if (build.exitCode !== 0) {
  const fixer = agent("报告修复员");
  await fixer.ask(
    COMMON_RULES +
    `任务：HTML 报告构建失败，报错如下。定位到对应 markdown 文档修复 mermaid 语法（遵守 ${REFS}/mermaid-rules.md），\n` +
    `然后自己用命令 node ${builderPath} --src ${outDir} 重跑，直到退出码 0。不要改业务代码。\n` +
    `stdout:\n${build.stdout}\nstderr:\n${build.stderr}`
  );
  build = await world.run("node", [builderPath, "--src", outDir], { timeoutMs: 180_000 });
}

let reportPublished = false;
try {
  await artifact.file("report", `${outDir}/report.html`, {
    title: "后端项目解析报告",
    description: `${recon.projectName}：${moduleOutcomes.length} 个模块的架构、流程图与优化建议，双击离线可读`,
    primary: true,
  });
  reportPublished = true;
} catch (e) {
  log(`报告发布失败：${e instanceof Error ? e.message : String(e)}（文件仍保留在 ${outDir}/report.html）`);
}

const buildOk = build.exitCode === 0;
return {
  conclusion: buildOk
    ? `已完成「${recon.projectName}」解析：${recon.modules.length} 个模块（${recon.modules.map((m) => m.name).join("、")}）各产出一份带证据与流程图的文档，另有总架构与导读，HTML 报告已生成于 ${outDir}/report.html${reportPublished ? " 并已发布" : ""}。`
    : `文档已完成（${outDir}/），但 HTML 构建仍失败，需要按构建报错手工修复 mermaid 语法后重跑 node ${builderPath} --src ${outDir}。`,
  findings: [
    ...moduleOutcomes.map((o) => ({
      where: o.docPath,
      what: o.review.pass
        ? `${o.mod.title}：模块文档已产出并通过独立证据复核`
        : `${o.mod.title}：文档已产出，但复核仍遗留 ${o.review.issues.length} 个问题`,
      evidence: o.review.pass
        ? `独立复核员抽查 5 处文件:行号证据均属实；mermaid 语法与模板结构完整`
        : o.review.issues.map((i) => `${i.where}: ${i.problem}`).join("；").slice(0, 500),
      status: o.review.pass ? ("verified" as const) : ("unconfirmed" as const),
      severity: o.review.pass ? ("low" as const) : ("medium" as const),
    })),
    ...(coldVerdict.issues.length > 0
      ? [{
          where: `${outDir}/README.md 与 ${outDir}/00-architecture.md`,
          what: `初学者视角复审发现 ${coldVerdict.issues.length} 条可读性/证据问题，已由汇总人修复`,
          evidence: coldVerdict.issues.map((i) => `${i.where}: ${i.problem}`).join("；").slice(0, 500),
          status: "verified" as const,
          severity: "low" as const,
        }]
      : []),
    ...(!buildOk
      ? [{
          where: `${outDir}/report.html`,
          what: "HTML 报告构建失败（退出码非 0）",
          evidence: (build.stderr || build.stdout).slice(0, 500),
          status: "unconfirmed" as const,
          severity: "high" as const,
        }]
      : []),
  ],
  verified: [
    `每个模块文档经独立复核员抽查 5 处文件:行号证据`,
    `README 与总架构经独立的初学者视角复审`,
    `HTML 报告由构建脚本确定性生成，退出码 ${build.exitCode}`,
    `模块划分来自侦察阶段的入口点枚举（全部 controller/定时任务/消费者）`,
  ],
  notCovered: [
    unresolved.length > 0
      ? `${unresolved.map((o) => o.mod.name).join("、")} 模块的复核遗留问题未再复核第二轮`
      : "无",
    "业务代码的正确性未经运行验证（本项目为静态阅读分析，不运行项目）",
  ],
};
