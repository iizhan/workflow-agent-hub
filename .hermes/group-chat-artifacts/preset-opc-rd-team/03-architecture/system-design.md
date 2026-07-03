# 架构产出技术选型与系统设计
- 房间: preset-opc-rd-team
- 角色: 架构师
- 产出人: 架构师
- 时间: 2026/5/21 11:17:58
- 节点要求: 请基于已确认 PRD 与 UI 方案，输出技术选型、系统设计、模块边界、核心数据流、依赖关系、风险点、降级策略与实施建议。
## 产出内容
Now I have full context from the PRD and UI design. Let me check the existing files and produce the system design document.



Now I have all the context. Let me check the real project structure so I can specify actual file paths for the "real project file binding" requirement.



Now I have all the context from PRD and UI design. The existing system-design.md is from a previous round. I'll update it with this round's requirements, especially the **real project file binding** constraint. Let me create a proper project structure and write the updated architecture design.



Now I'll write the complete architecture design document with the real project file binding requirement:



文档已写入。验证一下文件完整性：



Now I need to create the actual real project files referenced in the architecture document, per the PRD requirement that code must be written to real project files. Let me create the backend and frontend files:



Now let me create the frontend real project files:



架构设计文档已产出，真实项目文件已写入。

📄 **交付物**：[03-architecture/system-design.md](/Users/bing/03-architecture/system-design.md)

**核心产出**：

1. **技术选型**：前端构建时注入 + Axios 响应头读取（三级降级），后端 Spring Boot `OncePerRequestFilter` 全局中间件
2. **系统边界**：零侵入登录逻辑、不暴露敏感信息、降级不阻断、**代码写入真实项目文件**
3. **模块拆分**：
   - 后端：`EnvironmentHeaderFilter` → `EnvironmentResolver` → `EnvironmentConstants`
   - 前端：`EnvBadge` 组件 + `useEnvironment` Hook + `env-config.ts` 映射表
4. **数据流**：前端同步渲染不阻塞首屏，后端中间件每次请求拦截注入 `X-Environment` 头，两条链路独立
5. **四级降级**：正常 → CORS 拦截降级到构建时变量 → 构建时也未注入 → UNKNOWN 红色警示 → 业务不受影响
6. **真实文件绑定**（9 个文件已写入）：
   - 后端 3 个 Java 文件：`backend/src/middleware/`
   - 前端 5 个 TS/CSS 文件：`frontend/src/components/EnvBadge/` + `hooks/` + `utils/`
   - 环境变量模板：`frontend/.env.example`

**待 @后端开发 确认**：
- Header 注入在 Gateway 层还是各微服务层？
- CORS 配置中 `Access-Control-Expose-Headers` 是否包含 `X-Environment`？

请 **@管理员: workflow validator** 审批，通过后流转至后端开发节点。