# demo-campus 后端项目解析

> 本文档集由 backend-analyzer 生成，面向第一次接触本项目的后端学习者。
> 生成日期：2026-09-30 ｜ 技术栈：Spring Boot 3.2.5 + MyBatis（注解 SQL）+ MySQL + JJWT ｜ 规模：3 个模块、14 个接口、5 张表

## 一句话理解这个项目

一个教学型的校园管理系统单体后端：登录后，管理员维护学生学籍（班级/学号/联系方式），学生浏览课程并选课退课。项目刻意保留了不少真实工程里常见的坑（明文密码、无事务选课、N+1 查询），非常适合当"问题教材"来读。

## 建议阅读顺序

1. [00-architecture.md](00-architecture.md) —— 先看全局：分层、模块、数据表、模块关系。不懂全局就扎进某个模块，会不知道手里的类在系统里处于什么位置。
2. [modules/auth.md](modules/auth.md) —— 登录鉴权是一切的入口：所有接口都被它的拦截器保护，先懂 JWT 怎么签发和校验，后面每个模块的流程图开头那一步才看得懂。
3. [modules/student.md](modules/student.md) —— 典型的单表 CRUD，最简单，用它建立"设计意图→流程图→步骤表"的阅读节奏，顺便见识 N+1 和静默失败。
4. [modules/course.md](modules/course.md) —— 核心业务：选课含容量控制、状态流转、事务与并发问题，是本套文档里信息量最大的一份，值得细读。

## 快速上手路径（跑起来再看）

1. 执行 `sql/schema.sql` 建库建表（campus 库、5 张表，sql/schema.sql:2-3）；想有数据登录需自行 INSERT 一个 sys_user（无初始化数据脚本）。
2. 确认 MySQL 连接配置与本机一致（application.yml:11-13，root/root123），然后启动 CampusApplication（CampusApplication.java:13）。
3. 先调 `POST /api/auth/login` 拿 token——这是唯一免登录的接口（白名单见 WebMvcConfig.java:21）：
   ```bash
   curl -X POST http://localhost:8080/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"<你的用户名>","password":"<明文密码>"}'
   ```
4. 带 `Authorization: Bearer <token>` 调 `GET /api/students?page=1&size=10`，对照 modules/student.md 图 2-2 观察日志里的 SQL（logging 已开 debug，application.yml:22）——你会看到每行学生都跟一条班级查询，这就是 O2-1 说的 N+1。
5. 再调 `POST /api/courses/{id}/enroll` 选课，对照 modules/course.md 图 3-4 理解"查课→查重→容量→插入→计数"五步及其缺陷。

## 术语速查

| 术语 | 含义 |
|---|---|
| JWT | 无状态登录令牌，本项目拦截器用它校验身份（JwtUtil 签发/解析） |
| 拦截器 | HandlerInterceptor，请求进 Controller 前的关卡，本项目只有登录校验一个 |
| 统一响应 | 所有接口返回 `{code, message, data}` 结构，code=0 成功（Result.java:15） |
| N+1 查询 | 查列表后对每行再单独查一次库，性能杀手，见 student 模块 O2-1 |
| 冗余计数 | t_course.enrolled 用一个数字缓存"已选人数"，随选退课 ±1，省 COUNT 但要自己保证一致（O3-1/O3-2） |
| check-then-act | 先检查再行动的两步写法，两步之间别人可能插进来，导致并发错误（O2-2、O3-1） |
| 幂等 | 同一操作重复执行结果不变；本项目退课接口不满足（O3-2） |
| 越权 | 登录了但角色不够却调通了管理接口，本项目 role 校验缺失（O1-4） |

## 文档地图

```
docs/analysis/
├── README.md            ← 你在这里
├── 00-architecture.md   ← 全局架构 + 优化建议汇总表
├── modules/
│   ├── auth.md          ← 模块 1：认证鉴权
│   ├── student.md       ← 模块 2：学籍管理
│   └── course.md        ← 模块 3：选课管理
└── report.html          ← 双击即开的交互式报告（侧边栏可跨页搜索）
```
