# 旧模块页签与空状态品牌对齐设计

## 1. 本轮目的

在 workbench 页面、登录页和聊天入口已经逐步接入品牌配置层后，本轮继续把旧模块的高曝光外层体验拉齐：

- 浏览器页签标题
- 历史消息空状态

目标是避免出现“新工作台已经升级，但旧模块仍像独立旧产品页面”的割裂感。

## 2. 当前问题判断

虽然 workbench 主链路已经越来越统一，但旧模块仍保留两类明显断层：

1. 浏览器标题没有统一品牌规则
2. 历史消息空状态仍依赖旧的通用聊天空态表达

这会让用户在跨模块切换时，感受到产品语义忽然断开。

## 3. 本轮设计结论

### 3.1 页签标题也属于品牌层

页面标题不仅是技术细节，也是产品感知的一部分。

因此本轮把 `useBranding` 从 workbench 范围扩展到更多旧模块页面，使：

- Chat
- History
- Group Chat
- Files
- Models
- Gateways
- Settings
- Skills
- Memory
- Usage
- Logs
- Jobs
- Kanban
- Channels
- Profiles
- Terminal

都进入统一的标题后缀规则。

### 3.2 历史空状态应有独立语义

聊天主页面的空状态强调“开始对话”，而历史消息区更适合强调“打开既有会话以回顾内容”。

因此不应继续共用同一条空状态文案。

## 4. 本轮工程落点

本轮主要更新：

- `packages/client/src/constants/branding.ts`
- `packages/client/src/composables/useBranding.ts`
- `packages/client/src/components/hermes/chat/HistoryMessageList.vue`

## 5. 下一阶段建议

下一阶段可以继续：

1. 清理其余高曝光硬编码品牌词
2. 继续把旧模块顶部说明文案纳入统一品牌层
3. 评估是否逐步把更多多语言入口文案从静态文本迁移到配置驱动策略
