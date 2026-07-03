<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownRenderer from '../chat/MarkdownRenderer.vue'
import type { ChatMessage, RoomAgent } from '@/api/hermes/group-chat'
import { buildCartoonAvatarSvg, isImageAvatarSource } from '@/utils/cartoon-avatar'

const props = defineProps<{
    message: ChatMessage
    agents: RoomAgent[]
    currentUserId?: string
}>()
const { t } = useI18n()

function agentMatchesMessage(agent: RoomAgent): boolean {
    if (agent.agentId === props.message.senderId) return true
    if (props.message.senderId === 'system' || props.message.senderId === props.currentUserId) return false
    return agent.name.trim() === props.message.senderName.trim()
}

const isAgent = computed(() => {
    return props.agents.some(agentMatchesMessage)
})

const isSelf = computed(() => {
    return !!props.currentUserId && props.message.senderId === props.currentUserId
})

const isSystem = computed(() => props.message.senderId === 'system')

const agentInfo = computed(() => {
    return props.agents.find(agentMatchesMessage)
})

const timeStr = computed(() => {
    const d = new Date(props.message.timestamp)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

const avatarSource = computed(() => {
    const senderKey = props.message.senderName || props.message.senderId
    if (isSystem.value) {
        return buildCartoonAvatarSvg(senderKey, { kind: 'system', label: 'SYS' })
    }
    if (isAgent.value) {
        const customAvatar = agentInfo.value?.avatar?.trim()
        if (isImageAvatarSource(customAvatar)) return customAvatar
        return buildCartoonAvatarSvg(customAvatar || senderKey, {
            kind: 'agent',
            label: agentInfo.value?.name || props.message.senderName,
        })
    }
    return buildCartoonAvatarSvg(senderKey, {
        kind: 'user',
        label: props.message.senderName,
    })
})

const avatarIsImage = computed(() => isImageAvatarSource(typeof avatarSource.value === 'string' ? avatarSource.value : ''))

const mentionNames = computed(() => props.agents.map(a => a.name).filter(Boolean))
</script>

<template>
    <div class="group-message" :class="{ agent: isAgent, self: isSelf, system: isSystem }">
        <!-- Avatar -->
        <div class="avatar">
            <img v-if="avatarIsImage" class="avatar-image" :src="avatarSource" :alt="message.senderName || message.senderId">
            <span v-else v-html="avatarSource" />
        </div>

        <div class="msg-body">
            <div class="msg-header">
                <span class="sender-name">{{ message.senderName }}</span>
                <span v-if="isSystem" class="system-tag">{{ t('groupChat.systemTag') }}</span>
                <span v-if="isAgent && agentInfo?.description" class="agent-desc">{{ agentInfo.description }}</span>
            </div>
            <div class="msg-content" :class="{ 'agent-content': isAgent, 'system-content': isSystem }">
                <MarkdownRenderer :content="message.content" :mention-names="mentionNames" />
            </div>
            <span class="msg-time">{{ timeStr }}</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.group-message {
    display: flex;
    gap: 10px;
    padding: 2px 0;

    &.agent,
    &.self {
        flex-direction: row-reverse;

        .msg-body {
            align-items: flex-end;
        }

        .msg-header {
            flex-direction: row-reverse;
        }
    }

    &.agent .msg-content.agent-content {
        background-color: rgba(var(--accent-primary-rgb), 0.06);
    }

    &.self .msg-content {
        background-color: rgba(var(--accent-primary-rgb), 0.1);
    }

    &.system {
        .avatar {
            border-radius: 10px;
            background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.18), rgba(var(--accent-primary-rgb), 0.06));
            border: 1px solid rgba(var(--accent-primary-rgb), 0.16);
        }

        .msg-body {
            max-width: 100%;
        }
    }
}

.avatar {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    margin-top: 2px;
    overflow: hidden;
    border-radius: 8px;

    :deep(svg) {
        width: 36px;
        height: 36px;
    }
}

.avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.msg-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: 85%;
}

.msg-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 2px;

    .sender-name {
        font-size: 13px;
        font-weight: 600;
        color: $text-primary;
    }

    .agent-desc {
        font-size: 11px;
        color: $text-muted;
        font-style: italic;
    }

    .system-tag {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: $accent-primary;
        background: rgba(var(--accent-primary-rgb), 0.1);
        border: 1px solid rgba(var(--accent-primary-rgb), 0.18);
        border-radius: 999px;
        padding: 1px 6px;
    }
}

.msg-time {
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.6;
    margin-top: 2px;
}

.msg-content {
    padding: 10px 14px;
    font-size: 14px;
    line-height: 1.65;
    color: $text-primary;
    border-radius: 10px;
    background-color: $msg-user-bg;
    word-break: break-word;
    overflow-wrap: break-word;

    :deep(.mention-highlight) {
        color: #409eff;
        font-weight: 600;
        cursor: default;
    }

    &.system-content {
        border-left: 3px solid rgba(var(--accent-primary-rgb), 0.5);
        background: linear-gradient(180deg, rgba(var(--accent-primary-rgb), 0.08), rgba(var(--accent-primary-rgb), 0.03));
    }
}
</style>
