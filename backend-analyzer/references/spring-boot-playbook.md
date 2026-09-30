# Spring Boot 项目侦查与追链手册

分析 Spring Boot 项目前必读。本文回答四个问题：技术栈是什么、入口点有哪些、模块怎么划分、一个功能的执行链怎么追。

## 1. 技术栈识别（阶段 0 侦察）

按顺序看这几处，产出"项目技术清单"：

| 看哪里 | 得到什么 |
|---|---|
| `pom.xml` / `build.gradle(.kts)` | Spring Boot 版本、持久层选型（mybatis / mybatis-plus / spring-data-jpa）、中间件客户端（redis、kafka、rabbitmq、xxl-job）、安全选型（spring-security / jwt / sa-token） |
| 根 `pom.xml` 的 `<modules>` | 是否 Maven 多模块工程；每个 module 一个候选业务模块 |
| `application.yml` / `.properties`（含 profile 变体） | 端口、数据源（库型号与库名）、Redis、MQ、第三方配置；配置项里出现的中间件必须反映到架构图 |
| 启动类 `@SpringBootApplication`、`@MapperScan`、`@ComponentScan` | mapper 包位置、扫描范围 |
| `Dockerfile` / `docker-compose.yml` / `k8s` 清单 | 部署形态与依赖服务 |

**微服务特征**：出现 `spring-cloud`、Nacos/Eureka 配置、OpenFeign 接口时，每个服务独立成模块，注册中心/网关/服务间调用关系必须画进模块关系图。

## 2. 入口点枚举（分析范围 = 全部入口点）

用 grep 枚举（下表正则兼容 ripgrep 与 `grep -rE`，注意 `grep` 基础模式要用 `-E`），逐类登记成清单。**漏掉入口点 = 分析不完整**。

| 入口类型 | grep 目标（在 `src/main/java` 下） |
|---|---|
| HTTP 接口 | `@RestController\|@Controller`，再对每个文件抓 `@RequestMapping\|@GetMapping\|@PostMapping\|@PutMapping\|@DeleteMapping\|@PatchMapping` |
| 定时任务 | `@Scheduled\|@Schedulable`，xxl-job 的 `@XxlJob` |
| 消息消费 | `@KafkaListener\|@RabbitListener\|@RocketMQMessageListener\|@JmsListener` |
| 启动/初始化 | `CommandLineRunner\|ApplicationRunner\|@PostConstruct\|ApplicationListener`（登记即可，不必深挖） |
| 异步/事件 | `@Async\|@EventListener\|@TransactionalEventListener` |
| WebSocket | `@ServerEndpoint\|WebSocketHandler` 实现 |

HTTP 接口登记格式：`HTTP方法 完整路径 → 类.方法()`（完整路径 = 类级 @RequestMapping 前缀 + 方法级路径拼出）。这张表是"功能清单"的原始素材，也用于核对有没有漏分析的接口。

## 3. 模块划分（阶段 1）

**原则：模块 = 业务域（做什么事），不是技术分层（怎么分层）。`controller`/`service`/`mapper` 是层，不是模块。**

### 3.1 三种常见布局的划分方法

**布局 A：业务优先分包**（`com.xxx.auth.controller / .service / .mapper`）——每个业务包即一个模块。证据 = 包名 + 该包下 controller 的 URL 前缀一致。

**布局 B：分层优先分包**（顶层 `controller / service / mapper / entity` 平铺）——按以下线索聚类还原业务域，并在文档说明"模块是按证据还原的"：
- URL 前缀聚类：`/api/students/**`、`/api/courses/**`
- 实体/表名前缀聚类：`Student`/`t_student`、`Course`/`t_course`
- Service 命名聚类：`StudentService`、`CourseService`

**布局 C：Maven 多模块 / 微服务**——每个 `<module>` 或每个服务一个模块；公共依赖（`common`、`api`、`client` 包）列为"支撑设施"，不硬拆成业务模块。

### 3.2 支撑设施

`common / core / framework / config / infrastructure / utils` 这类包单独归为一节"支撑设施"，逐项说明它被谁用、提供了什么（统一响应、全局异常、拦截器、鉴权）。**它们是模块间联系的载体，是模块关系图的重要节点。**

### 3.3 划分结果的验收标准

- 每个业务模块都能说出：职责一句话、包含哪些入口点、拥有哪些表；
- 所有入口点都归属到某个模块或支撑设施，没有遗漏；
- 划分理由有证据（包名/URL/表名/构建配置）。

## 4. 追链方法（阶段 2，每个功能）

对功能清单里的每个功能，从入口追到数据落点：

### 4.1 标准调用链

```
HTTP 请求 → Filter/Interceptor（横切）→ Controller 方法
  → Service 方法（业务逻辑、事务边界）
    → Mapper / Repository / JdbcTemplate（持久化）
      → SQL → 表
    → （可能）Redis / MQ / 外部 HTTP / 静态资源
  → 返回 DTO → 统一响应包装
```

- MyBatis 注解 SQL 直接在 Mapper 接口上看；**XML SQL** 用 mapper 接口全限定名 + 方法 id 去resources 下找对应 XML。
- JPA：看 Repository 接口方法名派生的查询 / `@Query`。
- 每一步记下 `文件:行号`，流程图节点直接引用。

### 4.2 横切关注点（必须画进流程）

- **拦截器/过滤器**：`HandlerInterceptor` 实现类、`Filter`、`WebMvcConfigurer.addInterceptors` 的注册与白名单。它们决定"请求先经过什么"，是 auth 模块联系其他模块的关键证据。
- **全局异常处理**：`@RestControllerAdvice`。业务异常的出口，画在流程图"失败分支"。
- **AOP 切面**：`@Aspect`，标注在受影响的方法上。
- **事务边界**：`@Transactional` 在哪个方法、事务内做了哪几步写操作——这对优化评审（一致性/并发问题）至关重要。

### 4.3 模块间联系的三类证据

1. **代码调用**：A 模块的类 import/注入了 B 模块的类（service 调 service、工具类被引用）；
2. **数据耦合**：两个模块的 SQL 读写同一张表，或跨模块 JOIN；
3. **运行时约定**：拦截器写入 request 属性、另一个模块读取；MQ 生产者与消费者；共享缓存 key。

模块关系图上每条边注明联系类型与证据位置。

### 4.4 跳转关系怎么写

- 前后端分离项目：写"接口间的逻辑跳转"——前端为完成某件事会按什么顺序调哪些接口、上一步的什么返回值用于下一步（依据：controller 语义、返回 DTO 字段、代码注释）。**没有前端代码佐证时，跳转结论必须标"推测"。**
- 模板引擎项目（Thymeleaf/Freemarker，controller 返回视图名）：页面跳转 = 返回的视图名 + redirect: 前缀，这是硬证据。
- 状态流转（订单状态、审核流、选课状态）：用 stateDiagram，状态名与合法迁移必须从代码 if/switch、枚举中取证。

## 5. 证据规范

- 格式：`相对项目根路径:行号`，如 `src/main/java/com/demo/campus/auth/service/AuthService.java:24`；
- 每个论断至少一条证据；同一论断多处证据取最关键的一条；
- 流程图节点可在标签尾部附短证据 `(AuthService.java:24)`；
- 代码里查不到依据的结论，写 `> ⚠️ 推测：` 并说明推测依据，宁可少说、不可编造。

## 6. 优化评审检查清单（阶段 3）

逐模块过一遍下面的清单，每条命中都按"现状证据 → 问题 → 影响 → 建议方案 → 预期收益"五段式写出。宁缺毋滥：每条建议都要能指着代码说清。

**安全**
- [ ] 密码明文存储/明文比对（无 BCrypt 等）
- [ ] JWT 密钥、第三方 ak/sk 等敏感配置硬编码
- [ ] 接口未鉴权/越权：用对象 id 直查但不校验归属（如学生 A 能查学生 B 的数据）
- [ ] SQL 注入：MyBatis `${}` 拼接用户输入
- [ ] 登录无失败限制/无验证码

**性能**
- [ ] N+1：循环体内查库/调外部服务（重点看 service 的 for 循环）
- [ ] 无分页的全量查询、`SELECT *`
- [ ] 高频读无缓存且库压力大（结合业务判断，不硬套）
- [ ] 从 SQL 的 WHERE/JOIN 字段看明显缺索引

**正确性与一致性**
- [ ] 多步写库无 `@Transactional`，或事务内调外部接口/发 MQ（大事务）
- [ ] check-then-act 并发问题：先查后写、无锁、无原子条件更新（秒杀/库存/选课类场景重点查）
- [ ] 更新/删除未检查影响行数，失败静默
- [ ] 状态机迁移不校验（任意状态可跳到任意状态）
- [ ] 重复提交无幂等

**结构与可维护性**
- [ ] 跨模块引用错位（如公共 DTO 放在某业务包里被别的模块引用）
- [ ] 上帝类：一个 Service 超过 ~500 行或管多张不相关表
- [ ] 魔法值：状态字符串/数字散落各处，无枚举常量
- [ ] Controller 里写业务/SQL，Service 返回实体当 DTO 用
- [ ] 吞异常（catch 后不记日志不抛出）

**可运维**
- [ ] 日志缺失或全是 System.out
- [ ] 配置无 profile 区分，测试生产同配置

## 7. 大项目裁剪规则

- 业务模块 > 8 个时：按"入口点多、被依赖多"排序，全部模块都做架构级分析；深度分析优先覆盖核心链路模块，其余模块在文档中说明"本轮未深挖"。
- 生成代码/测试代码/前端目录（`src/main/frontend`、`static` 下的 js）不深挖，架构图里标注即可。
