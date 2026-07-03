<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import type { ChatMessage, WorkflowRunHistoryRecord } from '@/api/hermes/group-chat'
import GroupMessageItem from './GroupMessageItem.vue'

const { t } = useI18n()
const store = useGroupChatStore()
const listRef = ref<HTMLDivElement>()
const isNearBottom = ref(true)
const messageScope = ref<'focus' | 'all'>('focus')

type MessageSection = {
    key: string
    kind: 'run' | 'misc'
    title: string
    statusLabel: string
    summary: string
    messages: ChatMessage[]
    runNumber?: number
    hiddenByDefault: boolean
    isFocus: boolean
}

type RunWindow = Pick<WorkflowRunHistoryRecord, 'runNumber' | 'status' | 'startedAt' | 'endedAt' | 'kickoffSummary' | 'currentNodeTitle'>

function checkNearBottom(): void {
    if (!listRef.value) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.value
    isNearBottom.value = scrollHeight - scrollTop - clientHeight < 200
}

function scrollToBottom(force = false): void {
    if (!listRef.value) return
    if (!force && !isNearBottom.value) return
    listRef.value.scrollTop = listRef.value.scrollHeight
    checkNearBottom()
}

function handleScroll(): void {
    checkNearBottom()
}

function workflowRunStatusLabel(status?: string): string {
    if (status === 'running') return t('groupChat.workflowRunStatusRunning')
    if (status === 'completed') return t('groupChat.workflowRunStatusCompleted')
    if (status === 'failed') return t('groupChat.workflowRunStatusFailed')
    if (status === 'cancelled') return t('groupChat.workflowRunStatusCancelled')
    if (status === 'paused') return t('groupChat.workflowRunStatusPaused')
    return t('groupChat.workflowRunStatusIdle')
}

const activeRunNumber = computed(() => {
    const run = store.workflowRunState
    if (!run?.runNumber) return null
    if (run.status !== 'running' && run.status !== 'paused') return null
    return run.runNumber
})

const focusRunNumber = computed(() => {
    return activeRunNumber.value ?? store.workflowRunHistory[0]?.runNumber ?? null
})

const focusRunStatusLabel = computed(() => {
    if (activeRunNumber.value) return workflowRunStatusLabel(store.workflowRunState?.status)
    const latestHistory = store.workflowRunHistory[0]
    return latestHistory ? workflowRunStatusLabel(latestHistory.status) : ''
})

const runWindows = computed<RunWindow[]>(() => {
    const windows = new Map<number, RunWindow>()
    for (const run of store.workflowRunHistory) {
        windows.set(run.runNumber, {
            runNumber: run.runNumber,
            status: run.status,
            startedAt: run.startedAt,
            endedAt: run.endedAt,
            kickoffSummary: run.kickoffSummary,
            currentNodeTitle: run.currentNodeTitle,
        })
    }

    const activeRun = store.workflowRunState
    if (activeRun?.runNumber) {
        const currentNodeTitle = typeof store.workflowCurrentNode?.text === 'string'
            ? store.workflowCurrentNode.text
            : String(store.workflowCurrentNode?.text?.value || '')
        windows.set(activeRun.runNumber, {
            runNumber: activeRun.runNumber,
            status: activeRun.status,
            startedAt: activeRun.startedAt,
            endedAt: activeRun.status === 'running' || activeRun.status === 'paused'
                ? Number.POSITIVE_INFINITY
                : (windows.get(activeRun.runNumber)?.endedAt || activeRun.updatedAt),
            kickoffSummary: activeRun.kickoffSummary || windows.get(activeRun.runNumber)?.kickoffSummary || '',
            currentNodeTitle: currentNodeTitle || windows.get(activeRun.runNumber)?.currentNodeTitle || '',
        })
    }

    return Array.from(windows.values())
        .sort((a, b) => a.startedAt - b.startedAt)
})

const messageSections = computed<MessageSection[]>(() => {
    const sorted = store.sortedMessages
    if (sorted.length === 0) return []

    const runs = runWindows.value
    if (runs.length === 0) {
        return [{
            key: 'misc:all',
            kind: 'misc',
            title: '',
            statusLabel: '',
            summary: '',
            messages: sorted,
            hiddenByDefault: false,
            isFocus: true,
        }]
    }

    const sections: MessageSection[] = []
    let cursor = 0
    const toleranceMs = 1000
    const focusNumber = focusRunNumber.value

    const buildMiscSection = (key: string, messages: ChatMessage[]) => ({
        key,
        kind: 'misc' as const,
        title: t('groupChat.messageListRoomActivity'),
        statusLabel: '',
        summary: '',
        messages,
        hiddenByDefault: false,
        isFocus: false,
    })

    for (const run of runs) {
        const beforeMessages: ChatMessage[] = []
        while (cursor < sorted.length && sorted[cursor].timestamp < run.startedAt) {
            beforeMessages.push(sorted[cursor])
            cursor += 1
        }
        if (beforeMessages.length > 0) {
            sections.push(buildMiscSection(`misc:before:${run.runNumber}`, beforeMessages))
        }

        const runMessages: ChatMessage[] = []
        const runEnd = Number.isFinite(run.endedAt) ? run.endedAt + toleranceMs : Number.POSITIVE_INFINITY
        while (cursor < sorted.length && sorted[cursor].timestamp <= runEnd) {
            runMessages.push(sorted[cursor])
            cursor += 1
        }

        if (runMessages.length > 0) {
            const isFocus = focusNumber === run.runNumber
            sections.push({
                key: `run:${run.runNumber}`,
                kind: 'run',
                title: isFocus
                    ? t(
                        activeRunNumber.value === run.runNumber
                            ? 'groupChat.messageListCurrentRunTitle'
                            : 'groupChat.messageListLatestRunTitle',
                        { number: run.runNumber },
                    )
                    : t('groupChat.changeHistoryRunTitle', { number: run.runNumber }),
                statusLabel: workflowRunStatusLabel(run.status),
                summary: run.kickoffSummary || run.currentNodeTitle || '',
                messages: runMessages,
                runNumber: run.runNumber,
                hiddenByDefault: false,
                isFocus,
            })
        }
    }

    if (cursor < sorted.length) {
        sections.push(buildMiscSection('misc:tail', sorted.slice(cursor)))
    }

    const focusIndex = sections.findIndex(section => section.kind === 'run' && section.runNumber === focusNumber)
    if (focusIndex > 0) {
        return sections.map((section, index) => ({
            ...section,
            hiddenByDefault: index < focusIndex,
        }))
    }

    return sections
})

const hiddenHistoricalSectionCount = computed(() =>
    messageSections.value.filter(section => section.hiddenByDefault).length,
)

const hiddenHistoricalRunCount = computed(() =>
    messageSections.value.filter(section => section.hiddenByDefault && section.kind === 'run').length,
)

const visibleSections = computed(() => {
    if (messageScope.value === 'all') return messageSections.value
    return messageSections.value.filter(section => !section.hiddenByDefault)
})

const showFocusBar = computed(() =>
    !!focusRunNumber.value && hiddenHistoricalSectionCount.value > 0,
)

const focusBarTitle = computed(() => {
    if (!focusRunNumber.value) return ''
    if (activeRunNumber.value === focusRunNumber.value) {
        return t('groupChat.messageListFocusCurrent', {
            number: focusRunNumber.value,
            status: focusRunStatusLabel.value,
        })
    }
    return t('groupChat.messageListFocusLatest', {
        number: focusRunNumber.value,
        status: focusRunStatusLabel.value,
    })
})

const focusBarHint = computed(() => {
    if (messageScope.value === 'all') return t('groupChat.messageListHistoryExpanded')
    return t('groupChat.messageListHistoryCollapsed', {
        count: hiddenHistoricalRunCount.value || hiddenHistoricalSectionCount.value,
    })
})

const focusScopeLabel = computed(() => (
    activeRunNumber.value
        ? t('groupChat.messageListScopeFocusCurrent')
        : t('groupChat.messageListScopeFocusLatest')
))

async function setMessageScope(scope: 'focus' | 'all'): Promise<void> {
    if (messageScope.value === scope) return
    const shouldStickToBottom = isNearBottom.value
    messageScope.value = scope
    await nextTick()
    if (shouldStickToBottom) scrollToBottom(true)
}

watch(() => store.messages.length, async () => {
    await nextTick()
    scrollToBottom()
})

watch(() => focusRunNumber.value, () => {
    messageScope.value = 'focus'
})

defineExpose({ scrollToBottom })
</script>

<template>
    <div ref="listRef" class="message-list" @scroll="handleScroll">
        <div v-if="showFocusBar" class="message-focus-bar">
            <div class="message-focus-bar__copy">
                <div class="message-focus-bar__title">{{ focusBarTitle }}</div>
                <div class="message-focus-bar__hint">{{ focusBarHint }}</div>
            </div>
            <div class="message-focus-bar__scope">
                <button
                    class="message-focus-bar__button"
                    :class="{ 'message-focus-bar__button--active': messageScope === 'focus' }"
                    @click="setMessageScope('focus')"
                >
                    {{ focusScopeLabel }}
                </button>
                <button
                    class="message-focus-bar__button"
                    :class="{ 'message-focus-bar__button--active': messageScope === 'all' }"
                    @click="setMessageScope('all')"
                >
                    {{ t('groupChat.messageListScopeAll') }}
                </button>
            </div>
        </div>
        <div v-if="store.sortedMessages.length === 0" class="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>{{ t('groupChat.noMessages') }}</p>
        </div>
        <template v-else>
            <section
                v-for="section in visibleSections"
                :key="section.key"
                class="message-section"
                :class="{ 'message-section--focus': section.isFocus }"
            >
                <div v-if="section.title" class="message-section__header">
                    <div class="message-section__row">
                        <span class="message-section__title">{{ section.title }}</span>
                        <span v-if="section.statusLabel" class="message-section__status">{{ section.statusLabel }}</span>
                    </div>
                    <p v-if="section.summary" class="message-section__summary">{{ section.summary }}</p>
                </div>
                <GroupMessageItem
                    v-for="msg in section.messages"
                    :key="msg.id"
                    :message="msg"
                    :agents="store.agents"
                    :current-user-id="store.userId"
                />
            </section>
        </template>
    </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.message-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background-color: $bg-card;
}

.message-focus-bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    margin-bottom: 4px;
    border-radius: 14px;
    background: rgba(var(--accent-primary-rgb), 0.08);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.14);
    backdrop-filter: blur(12px);
}

.message-focus-bar__copy {
    min-width: 0;
}

.message-focus-bar__title {
    font-size: 13px;
    font-weight: 700;
    color: $text-primary;
}

.message-focus-bar__hint {
    margin-top: 2px;
    font-size: 12px;
    color: $text-secondary;
}

.message-focus-bar__scope {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.08);
}

.message-focus-bar__button {
    border: 0;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    color: $text-secondary;
    background: transparent;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
        background: rgba(var(--accent-primary-rgb), 0.18);
        transform: translateY(-1px);
    }
}

.message-focus-bar__button--active {
    color: $accent-primary;
    background: rgba(var(--accent-primary-rgb), 0.14);
    box-shadow: 0 6px 14px rgba(var(--accent-primary-rgb), 0.14);
}

.message-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.message-section__header {
    padding: 10px 14px;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.04);
    border: 1px solid rgba(15, 23, 42, 0.08);
}

.message-section--focus .message-section__header {
    background: linear-gradient(180deg, rgba(var(--accent-primary-rgb), 0.12), rgba(var(--accent-primary-rgb), 0.04));
    border-color: rgba(var(--accent-primary-rgb), 0.18);
}

.message-section__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.message-section__title {
    font-size: 13px;
    font-weight: 700;
    color: $text-primary;
}

.message-section__status {
    flex-shrink: 0;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 700;
    color: $accent-primary;
    background: rgba(var(--accent-primary-rgb), 0.1);
}

.message-section__summary {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: $text-secondary;
}

.empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: $text-muted;
    opacity: 0.4;

    p {
        font-size: 14px;
    }
}

@media (max-width: 768px) {
    .message-focus-bar {
        flex-direction: column;
        align-items: stretch;
    }

    .message-focus-bar__scope {
        width: 100%;
    }

    .message-focus-bar__button {
        width: 100%;
    }
}
</style>
