# Hermes 记忆能力架构建议

## 1. 现状判断

当前项目已经有两类“记忆骨架”：

1. `profile` 级文件记忆
   - `MEMORY.md`
   - `USER.md`
   - `SOUL.md`
2. 会话级上下文记忆
   - `sessions/messages` 会话与消息落库
   - 压缩摘要 `chat_compression_snapshots`
   - 群聊上下文摘要 `gc_context_snapshots`

这说明系统并不是没有记忆，而是：

1. 现在更偏“文件型共享记忆”
2. 已经有“会话压缩摘要”
3. 还没有“结构化、可检索、可过期、可分权限”的长期记忆层

所以后续不建议继续把所有能力都堆进 `MEMORY.md / USER.md / SOUL.md`。更合适的方向是：

1. 保留这 3 个文件作为“可读可编辑的记忆展示面”
2. 新增结构化 memory store 作为真实数据源
3. 在 prompt 注入前做分层召回，而不是只读整份 markdown

## 2. 先回答“记给谁”

建议把记忆 scope 固定为 5 层，按优先级从大到小：

1. `system`
   - 全局共享
   - 放产品规则、FAQ、审批约束、平台使用规范
   - 典型内容：产品边界、系统策略、组织级知识
2. `profile`
   - 当前最适合复用你现有架构的一层
   - 一个 profile 就是一个空间，天然适合作为共享工作区记忆
   - 典型内容：团队约定、共享术语、项目背景、渠道说明
3. `user`
   - 用户私有记忆
   - 典型内容：名字、称呼、偏好、上次进行到哪、个人工作习惯
4. `room`
   - 团队/群聊记忆
   - 典型内容：某个群的上下文、会议结论、多人协作状态
5. `agent`
   - agent 自身记忆
   - 典型内容：自我总结、擅长策略、失败回避、风格校准

### 推荐映射到当前项目

1. `MEMORY.md` 先定义为 `profile` 级共享记忆展示面
2. `USER.md` 不再理解成“这个 profile 唯一用户”，而是过渡为“当前用户记忆展示面”
3. `SOUL.md` 定义为 `agent/system persona` 的长期行为记忆展示面

### 用户识别怎么做

当前系统认证更像“单实例访问令牌”，不是多用户身份系统。因此如果要做真正的“一个用户一个空间”，必须先补身份层：

1. 请求上下文里要拿到稳定 `userId`
2. 所有用户记忆必须以 `profile + userId` 作为隔离键
3. 群聊则补 `roomId`
4. agent 记忆补 `agentId`

建议最小识别主键：

1. `profile`
2. `user_id`
3. `room_id`
4. `agent_id`

### 谁能写、谁能读

建议默认权限矩阵：

1. `system`
   - 写：管理员 / 系统任务
   - 读：所有用户、所有 agent
2. `profile`
   - 写：profile owner、管理员、被授权协作者、系统总结器
   - 读：该 profile 下用户和 agent
3. `user`
   - 写：该用户本人、代表该用户服务的 agent、系统抽取器
   - 读：该用户本人、当前为其服务的 agent
4. `room`
   - 写：房间成员、房间 agent、系统总结器
   - 读：房间成员、房间 agent
5. `agent`
   - 写：该 agent、自省任务、管理员
   - 读：该 agent，必要时只暴露摘要给管理员

### 冲突怎么处理

不要覆盖写死，改成“并存 + 判定状态”：

1. 同一事实允许有多条 observation
2. 记录 `confidence/source/updated_at`
3. 当前生效结论用 `active/superseded/disputed`
4. 高优先级来源覆盖低优先级来源
5. 时间新的不一定绝对覆盖时间旧的，管理员写入优先级更高

## 3. 再回答“记什么”

建议记忆内容分 6 类，不要混成一坨 markdown：

1. `fact`
   - 稳定事实
   - 例：名字、角色、公司、项目归属
2. `preference`
   - 偏好
   - 例：喜欢简洁、不喜欢表情、回复要精炼、英文术语保留
3. `episodic`
   - 事件/阶段性上下文
   - 例：上次讨论到哪里、当前卡点、最近决策
4. `procedure`
   - 行为模式 / 处理策略
   - 例：这个用户偏好先给结论再给细节；道歉模板有效
5. `relationship`
   - 关系图谱
   - 例：A 是 B 同事，B 属于某公司，某 agent 属于某 room
6. `policy`
   - 系统或产品规则
   - 例：哪些数据不能持久化，哪些必须审批

### 不同类型的建议

1. 环境地点类记忆
   - 适合 `episodic`
   - 默认短 TTL
   - 只在明确对后续交互有帮助时保留
2. 用户偏好
   - 适合 `preference`
   - 中长期保留
3. 行为模式
   - 适合 `procedure`
   - 不能一次成功就升级为长期规则，要有重复验证
4. 人物关系
   - 适合 `relationship`
   - 最好独立表，不要只存自然语言
5. FAQ / 产品知识
   - 适合 `policy` 或 `fact`
   - 放 `system/profile` 级

### 不建议长期记的内容

1. 高敏感且无长期价值的信息
2. 明显过期的瞬时状态
3. 没有证据来源的猜测
4. 单次失败后得出的负面结论

## 4. 再回答“记多久”

不要做统一永久保存，建议按类型配置 TTL 策略：

1. `fact`
   - 默认 90 到 365 天
   - 例：称呼、身份、稳定项目归属
2. `preference`
   - 默认 30 到 180 天
   - 被反复命中可续期
3. `episodic`
   - 默认 3 到 30 天
   - 例：上次聊到哪、当前阶段、临时任务
4. `procedure`
   - 默认 14 到 60 天
   - 多次验证成功再晋升为长期
5. `relationship`
   - 默认 90 到 365 天
   - 如果有新证据则刷新
6. `policy`
   - 不自动过期
   - 走版本管理和人工失效

### 归档策略

不要把过期直接删除，建议三态：

1. `active`
2. `archived`
3. `expired`

原则：

1. prompt 默认只召回 `active`
2. 搜索页可以看 `archived`
3. `expired` 可作为低优先级候选，必要时人工恢复

### 激活条件

每条记忆建议带激活条件：

1. 按 scope 激活
2. 按 tag 激活
3. 按最近访问续期
4. 按命中次数提升 salience

## 5. 最后回答“怎么取”

建议召回链路固定成 5 段，不要直接全文扫：

1. 精确过滤
   - 先按 `profile/user/room/agent` scope 过滤
2. 规则召回
   - 按 `type/tag/status/ttl` 拿强相关记忆
3. 模糊联想
   - 向量检索或关键词扩展
4. 多跳扩展
   - 从关系边扩一跳或两跳
5. 重排裁剪
   - 按 `priority + confidence + freshness + salience` 排序后注入 prompt

### 推荐的分层召回顺序

1. `system policy`
2. `profile shared`
3. `user private`
4. `room current`
5. `agent self`
6. `recent session summary`
7. `recent raw messages`

### 多跳推理怎么做

如果要支持“xxxx 是谁同事、属于哪个公司、上次在哪个项目提过”，需要关系表：

1. 实体节点：`user/company/project/agent/room`
2. 关系边：`works_with/belongs_to/reports_to/mentioned_in`
3. 查询时允许 1 到 2 跳扩展

## 6. 针对当前代码的落地建议

### V1 不要推翻现有结构

先保留：

1. `MEMORY.md / USER.md / SOUL.md`
2. `sessions/messages`
3. `chat_compression_snapshots`
4. `gc_context_snapshots`

新增一个结构化表 `memory_entries` 即可起步。

### 推荐最小表结构

`memory_entries`

1. `id`
2. `scope_type`
3. `scope_id`
4. `profile`
5. `user_id`
6. `room_id`
7. `agent_id`
8. `memory_type`
9. `title`
10. `content`
11. `tags_json`
12. `status`
13. `confidence`
14. `priority`
15. `salience`
16. `source_type`
17. `source_ref`
18. `created_at`
19. `updated_at`
20. `last_accessed_at`
21. `expires_at`
22. `archived_at`

`memory_edges`

1. `id`
2. `profile`
3. `subject_type`
4. `subject_id`
5. `predicate`
6. `object_type`
7. `object_id`
8. `weight`
9. `source_ref`
10. `created_at`
11. `updated_at`

### 为什么这样最适合当前项目

1. 你已有 `profile` 维度，天然能当第一层隔离
2. `sessions` 表已有 `user_id` 字段，可以直接接入用户记忆分区
3. 群聊已有 `gc_room_members/gc_room_agents`，能直接支持 room/agent scope
4. 现有 `/api/hermes/memory` 可以从“读写三份 markdown”升级为“读写结构化记忆并渲染 markdown 视图”
5. 现有 config 接口已经支持 section 化配置，后续可以直接新增 `memory_policy`

## 7. 分阶段实施顺序

### Phase 1

1. 引入 `memory_entries`
2. 把 `MEMORY.md / USER.md / SOUL.md` 变成结构化数据的视图层
3. 补 `memory_policy` 配置
4. 所有写入都带 `scope + type + ttl`

### Phase 2

1. 给请求补稳定 `userId`
2. 完成 `profile + userId` 私有隔离
3. 增加 room/agent 维度召回

### Phase 3

1. 增加 `memory_edges`
2. 增加语义检索
3. 支持冲突检测、归档、晋升、降级

## 8. 一句话结论

对 Hermes 最合适的方向不是“继续强化 3 份 markdown 文件”，而是：

1. 用 `profile` 继续做空间隔离
2. 用 `user/room/agent` 补细粒度 scope
3. 用结构化 memory store 承载真实长期记忆
4. 用 markdown 文件承载可编辑展示面
5. 用 TTL、权限、冲突状态和分层召回，把记忆从“能存”升级成“能安全地被正确取出”
