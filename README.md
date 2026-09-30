# xiangmujiexi · 后端项目解析工具（backend-analyzer）

把一个对读者完全陌生的后端项目（主打 Java/Spring Boot），变成一套中文解析文档集：模块拆解、模块关系、每个功能的 Mermaid 流程图、有代码证据的分析、可执行的优化建议——外加一个双击即开的交互式 HTML 报告。

**当前状态：已安装到用户级，可在任何项目里直接使用。**

## 怎么用（日常使用）

1. 用 ZCode 打开要分析的后端项目（或其所在工作区）；
2. 直接说，例如：
   - "帮我分析这个后端项目，我想快速了解它"
   - "拆解一下这个项目的模块，画出每个功能的流程图"
   - "/skill backend-analyzer 用 workflow 深入分析这个项目"
3. 产物落在 `<目标项目根>/docs/analysis/`：
   - `README.md` —— 导读（建议阅读顺序、快速上手路径）
   - `00-architecture.md` —— 总架构（分层图、模块关系图、ER 图、优化建议汇总）
   - `modules/<模块名>.md` —— 每个业务模块一页（功能清单、逐功能流程图与跳转、优化建议五段式）
   - `report.html` —— 双击离线可读的交互式报告（侧边导航、图点击放大）
4. 阅读入口永远是先开 `report.html` 或先读 `README.md`。

**模式选择**：说"快速"走单会话；说"深入/workflow"走多智能体并行；不说就按规模自动（>40 个 Java 文件或 >4 个业务模块自动切 workflow）。

## 组件与分工

| 组件 | 位置 | 作用 |
|---|---|---|
| Skill `backend-analyzer` | `backend-analyzer/`（源码）→ `~/.agents/skills/backend-analyzer/`（安装） | 方法论与入口：分析流水线、质量铁律、Spring Boot 侦查手册、文档模板 |
| Workflow `backend-analyze` | `backend-analyzer/assets/backend-analyze.dwf.ts` | 大项目并行引擎：侦察 → 按模块 fan-out 深挖+独立复核 → 汇总 → 初学者复审 → 生成 HTML |
| 报告生成器 | `backend-analyzer/scripts/build_report.mjs` | 把 docs/analysis 下的 Markdown 编译成单文件自包含 report.html（内联 marked + mermaid，零依赖） |
| 测试夹具 | `fixtures/demo-campus/` | 迷你 Spring Boot 项目（auth/student/course），故意埋了 6 个问题，配套 `expected-findings.md` 验收基准 |

## 修改后如何生效

skill 源码在本工作区 `backend-analyzer/`，**改完必须同步安装目录**：

```bash
cp -r backend-analyzer/* ~/.agents/skills/backend-analyzer/
```

workflow 同理（`assets/backend-analyze.dwf.ts`）。建议每次修改后跑一遍 `fixtures/demo-campus` 回归（见下）。

## 运行测试

对 subagent / 新会话说（用真实用户口吻测试触发与执行）：

1. 单会话模式："帮我分析 fixtures/demo-campus 这个后端项目，我想快速了解它"
2. workflow 模式："用 workflow 深入分析 fixtures/demo-campus"
3. 变体触发："拆解 demo-campus 每个模块，画出每个功能的流程图"

验收对照 `fixtures/demo-campus/expected-findings.md`：6 个埋点问题全部命中、证据行号属实、文档结构与模板一致、`node backend-analyzer/scripts/build_report.mjs --src fixtures/demo-campus/docs/analysis` 退出码 0。

## workflow 的保存

测试通过后可把 workflow 保存为全局（`~/.zcode/workflows/backend-analyze.dwf.ts`），之后任何项目里都能按名调用：

```
CreateWorkflow  saved: { name: "backend-analyze", args: { projectPath: "." } }
```

## 已知边界

- 报告内联 mermaid（约 2.5MB），单文件离线可用是刻意取舍；
- workflow 的 `artifact` 发布要求目标项目在当前工作区**之内**（子目录可以，工作区外不行）；
- `docs/analysis/` 会被重复分析时覆盖更新（增量重跑同一项目是安全的）。
