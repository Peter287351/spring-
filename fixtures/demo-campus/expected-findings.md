# demo-campus 验收对照表

本文件是 backend-analyzer 测试的验收基准。分析产出必须命中下表要点，且证据行号能对上实际代码位置。

## 一、模块划分预期

| 模块 | 包 | 说明 |
|---|---|---|
| 认证 auth | com.demo.campus.auth | 登录、JWT、登录拦截器 |
| 学籍 student | com.demo.campus.student | 学生增删改查、班级关联 |
| 选课 course | com.demo.campus.course | 课程浏览、选课、退课、课表 |
| 支撑 common | com.demo.campus.common | 统一响应/全局异常/拦截器注册（支撑层，不单列为业务模块也应说明） |

## 二、必须被发现的问题（埋点）

| # | 问题 | 位置 | 说明 |
|---|---|---|---|
| 1 | 密码明文比对、库内明文存储 | auth/service/AuthService.java login() 内 `user.getPassword().equals(...)`；entity/User.java 注释 | 安全风险，应建议 BCrypt |
| 2 | 学生列表 N+1 查询 | student/service/StudentService.java listStudents()/searchByName() 的 for 循环里逐行调 classMapper.selectById | 应建议 JOIN 或批量 IN 查询 |
| 3 | 选课三步写操作无事务 | course/service/CourseService.java enroll()：insert 选课记录 + changeEnrolled 之间无 @Transactional，中途失败数据不一致 | 应加 @Transactional |
| 4 | 容量判断 check-then-act 并发超卖 | CourseService.enroll()：先 selectById 判容量、后插入，无锁无原子条件更新 | 应改为 `UPDATE ... SET enrolled=enrolled+1 WHERE enrolled<capacity` 原子更新或乐观锁 |
| 5 | 退课未校验有效记录即减人数 | CourseService.drop()：markDropped 影响行数未检查就 changeEnrolled(-1)，重复调用会把人数减成负数 | 应检查影响行数或原子更新 |
| 6 | JWT 密钥硬编码在源码 | auth/util/JwtUtil.java SECRET 常量 | 应移到配置/环境变量 |

## 三、结构预期

- 总架构文档应给出：分层（controller→service→mapper→MySQL）、模块关系（auth 拦截器保护 student/course 全部接口；course 依赖 student 的登录态/用户ID；common 被所有模块依赖）。
- **三层导航（可读性硬要求）**：
  - 每份模块文档 §1 开头有"本模块在全局中的位置"小关系图（以本模块为中心、只画直接相关的边）；
  - 功能清单表"流程"列用页内锚点链接（[图 N-M](#图 N-M)），点击直达流程图；
  - 每份模块文档有"功能跳转地图"（§4）：功能间操作路径 + 跨模块跳转虚线标注 + 典型路径文字说明。
- **编号规则**：模块小节编号统一为 1-6；图编号带模块序号（图 4-1）；图标题注释在 mermaid 块内第一行（报告渲染成可见标题条）。
- 每个业务模块文档应含：功能清单（接口级）、每个核心功能的 Mermaid 流程图（登录流程、列表查询流程、选课流程、退课流程）、涉及的表。
- README 导读应有建议阅读顺序（如：auth → student → course）。
- 所有产出为中文，位于 docs/analysis/ 下，含 report.html。

## 四、加分项（可发现可不发现）

- 登录接口无失败次数限制（可被爆破）。
- searchByName 与 listStudents 重复同一段 N+1 转换逻辑，可抽公共方法。
- markDropped 的 UPDATE 没有 status='ACTIVE' 条件，重复退课会覆盖历史状态。
- PageResult 在 student.dto 包里被 course 模块跨包引用（common 类错放位置）。
