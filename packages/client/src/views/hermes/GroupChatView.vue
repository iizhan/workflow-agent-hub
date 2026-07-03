<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { NButton } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import GroupChatPanel from "@/components/hermes/group-chat/GroupChatPanel.vue";
import { useGroupChatStore } from "@/stores/hermes/group-chat";
import { BRAND_LEGACY_SURFACE_LABELS } from "@/constants/branding";

const store = useGroupChatStore();
const router = useRouter();
const { t } = useI18n();

const collaborationShellRef = ref<HTMLDivElement | null>(null);
const isBootstrapping = ref(true);
const isPreparingWorkspace = computed(() => isBootstrapping.value);
const hasAutoFocusedCollaboration = ref(false);

const activeRoom = computed(() =>
  store.rooms.find((room) => room.id === store.currentRoomId) || store.rooms.find((room) => room.isActive) || null,
);

const activeRuntimeLabel = computed(() => {
  if (!store.currentRoomRuntime) return t("groupChat.summaryRuntimeIdle");
  if (store.currentRoomRuntime.isActive) return t("groupChat.runtimeActive");
  return t("groupChat.runtimeStandby");
});

const workflowStatusLabel = computed(() => {
  const status = store.workflowRunState?.status;
  if (status === "running") return t("groupChat.summaryWorkflowRunning");
  if (status === "paused") return t("groupChat.summaryWorkflowPaused");
  if (status === "completed") return t("groupChat.summaryWorkflowCompleted");
  if (status === "failed") return t("groupChat.summaryWorkflowFailed");
  return t("groupChat.summaryWorkflowIdle");
});

const activeProjectLabel = computed(() =>
  store.currentProject?.project.name || t("groupChat.summaryProjectUnbound"),
);

const activeArtifactCount = computed(() => store.workflowArtifacts.length || store.artifactEntries.length);
const activeAgentCount = computed(() => store.agents.length);
const memberCount = computed(() => store.members.length);
const activeRoomCount = computed(() => store.rooms.filter((room) => room.isActive).length);
const onlineAgentCount = computed(() => store.currentRoomRuntime?.onlineAgents || 0);

type GroupChatPrimaryAction = "focus-collaboration" | "open-history" | "open-applications";

const primaryDecision = computed(() => {
  if (isPreparingWorkspace.value) {
    return {
      action: "focus-collaboration" as GroupChatPrimaryAction,
      tone: "accent" as const,
      eyebrow: t("groupChat.preparingEyebrow"),
      title: t("groupChat.preparingTitle"),
      body: t("groupChat.preparingBody"),
      actionLabel: t("groupChat.preparingAction"),
    };
  }

  if (store.error) {
    return {
      action: "focus-collaboration" as GroupChatPrimaryAction,
      tone: "warning" as const,
      eyebrow: t("groupChat.primaryDecisionErrorEyebrow"),
      title: t("groupChat.primaryDecisionErrorTitle"),
      body: t("groupChat.primaryDecisionErrorBody", { message: store.error }),
      actionLabel: t("groupChat.focusCollaboration"),
    };
  }

  if (store.workflowRunState?.status === "running" || store.workflowRunState?.status === "paused") {
    return {
      action: "focus-collaboration" as GroupChatPrimaryAction,
      tone: "accent" as const,
      eyebrow: t("groupChat.primaryDecisionRunningEyebrow"),
      title: t("groupChat.primaryDecisionRunningTitle", {
        room: activeRoom.value?.name || t("groupChat.summaryRoomNone"),
      }),
      body: t("groupChat.primaryDecisionRunningBody", {
        agents: activeAgentCount.value,
        members: memberCount.value,
      }),
      actionLabel: t("groupChat.focusCollaboration"),
    };
  }

  if (activeRoom.value && activeAgentCount.value > 0) {
    return {
      action: "focus-collaboration" as GroupChatPrimaryAction,
      tone: "calm" as const,
      eyebrow: t("groupChat.primaryDecisionReadyEyebrow"),
      title: t("groupChat.primaryDecisionReadyTitle", { room: activeRoom.value.name }),
      body: t("groupChat.primaryDecisionReadyBody", {
        project: activeProjectLabel.value,
      }),
      actionLabel: t("groupChat.focusCollaboration"),
    };
  }

  if (store.rooms.length > 0) {
    return {
      action: "focus-collaboration" as GroupChatPrimaryAction,
      tone: "default" as const,
      eyebrow: t("groupChat.primaryDecisionRoomEyebrow"),
      title: t("groupChat.primaryDecisionRoomTitle"),
      body: t("groupChat.primaryDecisionRoomBody"),
      actionLabel: t("groupChat.focusCollaboration"),
    };
  }

  return {
    action: "open-applications" as GroupChatPrimaryAction,
    tone: "calm" as const,
    eyebrow: t("groupChat.primaryDecisionEmptyEyebrow"),
    title: t("groupChat.primaryDecisionEmptyTitle"),
    body: t("groupChat.primaryDecisionEmptyBody"),
    actionLabel: t("groupChat.openApplications"),
  };
});

const decisionChecklist = computed(() => [
  { key: "rooms", label: t("groupChat.checklistRooms"), count: store.rooms.length },
  { key: "activeRooms", label: t("groupChat.checklistActiveRooms"), count: activeRoomCount.value },
  { key: "agents", label: t("groupChat.checklistAgents"), count: activeAgentCount.value },
  { key: "members", label: t("groupChat.checklistMembers"), count: memberCount.value },
  { key: "artifacts", label: t("groupChat.checklistArtifacts"), count: activeArtifactCount.value },
]);

const guidePoints = computed(() => [
  t("groupChat.guidePoint1"),
  t("groupChat.guidePoint2"),
]);

function handlePrimaryDecision() {
  if (isPreparingWorkspace.value) return;
  if (primaryDecision.value.action === "open-history") {
    router.push({ name: "hermes.history" });
    return;
  }
  if (primaryDecision.value.action === "open-applications") {
    router.push({ name: "workbench.applications" });
    return;
  }
  collaborationShellRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function focusCollaborationShell(behavior: ScrollBehavior = "auto") {
  collaborationShellRef.value?.scrollIntoView({ behavior, block: "start" });
}

watch(
  () => [isPreparingWorkspace.value, activeRoom.value?.id, store.currentRoomId] as const,
  async ([preparing, activeRoomId, currentRoomId]) => {
    if (preparing) return;
    if (hasAutoFocusedCollaboration.value) return;
    if (!activeRoomId && !currentRoomId) return;
    await nextTick();
    focusCollaborationShell("auto");
    hasAutoFocusedCollaboration.value = true;
  },
  { immediate: true },
);

onMounted(async () => {
  isBootstrapping.value = true;
  hasAutoFocusedCollaboration.value = false;
  store.connect();
  try {
    await store.loadRooms();
    const preferredRoom = store.rooms.find((room) => room.isActive) || store.rooms[0];
    if (preferredRoom?.id && !store.currentRoomId) {
      try {
        await store.joinRoom(preferredRoom.id);
      } catch {
        // Ignore auto-join failure and keep manual room selection available.
      }
    }
    if (store.currentRoomId) {
      await Promise.allSettled([
        store.loadWorkflowArtifacts(store.currentRoomId, 8),
        store.loadWorkflowRunHistory(store.currentRoomId, 8),
      ]);
    }
  } finally {
    isBootstrapping.value = false;
  }
});

onUnmounted(() => {
  store.disconnect();
});
</script>

<template>
  <div class="group-chat-view workbench-page">
    <section class="workbench-page__hero group-chat-view__hero">
      <div class="workbench-page__hero-copy group-chat-view__hero-copy">
        <div class="group-chat-view__hero-heading">
          <div class="workbench-page__eyebrow group-chat-view__hero-eyebrow">{{ BRAND_LEGACY_SURFACE_LABELS.collaborationEyebrow }}</div>
          <h1 class="workbench-page__title group-chat-view__hero-title">{{ BRAND_LEGACY_SURFACE_LABELS.collaborationTitle }}</h1>
        </div>
        <p class="workbench-page__subtitle group-chat-view__hero-subtitle">{{ t("groupChat.heroSubtitle") }}</p>
      </div>
      <div class="workbench-page__actions group-chat-view__hero-actions">
        <NButton secondary @click="router.push({ name: 'hermes.history' })">
          {{ t("groupChat.openHistory") }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.applications' })">
          {{ t("groupChat.openApplications") }}
        </NButton>
      </div>
    </section>

    <section v-if="isPreparingWorkspace" class="group-chat-view__content">
      <div class="group-chat-preparing workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t("groupChat.preparingEyebrow") }}</div>
        <h2 class="group-chat-preparing__title">{{ t("groupChat.preparingTitle") }}</h2>
        <p class="group-chat-preparing__body">{{ t("groupChat.preparingBody") }}</p>
      </div>
    </section>

    <template v-else>
    <section class="group-chat-view__decision-grid">
      <article class="group-chat-guide workbench-panel" :class="`group-chat-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="group-chat-guide__title">{{ primaryDecision.title }}</h2>
        <p class="group-chat-guide__body">{{ primaryDecision.body }}</p>
        <div class="group-chat-guide__points">
          <div v-for="point in guidePoints" :key="point" class="group-chat-guide__point">{{ point }}</div>
        </div>
        <div class="group-chat-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.runs' })">
            {{ t("groupChat.openRuns") }}
          </NButton>
        </div>
      </article>

      <article class="group-chat-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t("groupChat.checklistEyebrow") }}</div>
        <h2 class="group-chat-checklist__title">{{ t("groupChat.checklistTitle") }}</h2>
        <p class="group-chat-checklist__body">{{ t("groupChat.checklistBody") }}</p>
        <div class="group-chat-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="group-chat-checklist__item">
            <span class="group-chat-checklist__label">{{ item.label }}</span>
            <span class="group-chat-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="group-chat-view__summary-grid">
      <article class="group-chat-stat workbench-panel">
        <div class="group-chat-stat__label">{{ t("groupChat.summaryRoom") }}</div>
        <div class="group-chat-stat__value">{{ activeRoom?.name || t("groupChat.summaryRoomNone") }}</div>
        <div class="group-chat-stat__meta">{{ t("groupChat.summaryRoomMeta") }}</div>
      </article>

      <article class="group-chat-stat workbench-panel">
        <div class="group-chat-stat__label">{{ t("groupChat.summaryRuntime") }}</div>
        <div class="group-chat-stat__value">{{ activeRuntimeLabel }}</div>
        <div class="group-chat-stat__meta">
          {{ t("groupChat.summaryRuntimeMeta", { online: onlineAgentCount, total: store.currentRoomRuntime?.totalAgents || 0 }) }}
        </div>
      </article>

      <article class="group-chat-stat workbench-panel">
        <div class="group-chat-stat__label">{{ t("groupChat.summaryWorkflow") }}</div>
        <div class="group-chat-stat__value">{{ workflowStatusLabel }}</div>
        <div class="group-chat-stat__meta">{{ t("groupChat.summaryWorkflowMeta") }}</div>
      </article>

      <article class="group-chat-stat workbench-panel">
        <div class="group-chat-stat__label">{{ t("groupChat.summaryProject") }}</div>
        <div class="group-chat-stat__value group-chat-stat__value--path">{{ activeProjectLabel }}</div>
        <div class="group-chat-stat__meta">{{ t("groupChat.summaryProjectMeta") }}</div>
      </article>
    </section>

    <section class="group-chat-view__content">
      <div ref="collaborationShellRef" class="group-chat-shell workbench-panel workbench-panel--soft">
        <header class="page-header group-chat-shell__header">
          <div class="group-chat-shell__title-group">
            <h2 class="header-title">{{ t("groupChat.workspaceTitle") }}</h2>
            <p class="group-chat-shell__subtitle">{{ t("groupChat.panelSubtitle") }}</p>
          </div>
        </header>

        <div class="group-chat-view__panel-content">
          <GroupChatPanel />
        </div>
      </div>
    </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.group-chat-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.group-chat-view__hero {
  align-items: center;
  gap: 16px;
  padding: 18px 24px 10px;
  border-bottom: 1px solid rgba($color: $border-color, $alpha: 0.7);
}

.group-chat-view__hero-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-chat-view__hero-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px 14px;
}

.group-chat-view__hero-eyebrow {
  margin: 0;
  white-space: nowrap;
}

.group-chat-view__hero-title {
  margin: 0;
  max-width: none;
  font-size: 28px;
  line-height: 1.05;
}

.group-chat-view__hero-subtitle {
  margin: 0;
  max-width: 720px;
  font-size: 13px;
  line-height: 1.55;
}

.group-chat-view__hero-actions {
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.group-chat-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 12px;
}

.group-chat-guide {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-chat-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.group-chat-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.group-chat-guide__title,
.group-chat-checklist__title {
  margin: 0;
  font-size: 25px;
  line-height: 1.2;
  color: $text-primary;
}

.group-chat-guide__body,
.group-chat-checklist__body,
.group-chat-shell__subtitle {
  color: $text-secondary;
  line-height: 1.6;
}

.group-chat-guide__points {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.group-chat-guide__point {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba($color: $border-color, $alpha: 0.9);
  background: rgba(255, 255, 255, 0.74);
  color: $text-secondary;
  font-size: 13px;
  line-height: 1.5;
}

.group-chat-guide__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.group-chat-checklist {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-chat-checklist__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.group-chat-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba($color: $border-color, $alpha: 0.9);
}

.group-chat-checklist__label {
  font-size: 13px;
  color: $text-secondary;
}

.group-chat-checklist__count {
  font-size: 16px;
  font-weight: 700;
  color: $text-primary;
}

.group-chat-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 0 24px 12px;
}

.group-chat-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 112px;
}

.group-chat-stat__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.group-chat-stat__value {
  font-size: 22px;
  line-height: 1.2;
  color: $text-primary;
}

.group-chat-stat__value--path {
  word-break: break-word;
}

.group-chat-stat__meta {
  font-size: 13px;
  color: $text-secondary;
  line-height: 1.5;
}

.group-chat-view__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 20px;
}

.group-chat-preparing {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 240px;
  justify-content: center;
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.group-chat-preparing__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.group-chat-preparing__body {
  margin: 0;
  max-width: 760px;
  color: $text-secondary;
  line-height: 1.7;
}

.group-chat-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-chat-shell__header {
  padding: 0;
}

.group-chat-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-chat-view__panel-content {
  flex: 1;
  min-height: 0;
}

@media (max-width: 1100px) {
  .group-chat-view__decision-grid,
  .group-chat-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .group-chat-view__hero {
    align-items: flex-start;
    padding-top: 16px;
  }

  .group-chat-view__hero-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .group-chat-view__hero-title {
    font-size: 24px;
  }

  .group-chat-view__hero-actions {
    width: 100%;
  }

  .group-chat-view__decision-grid,
  .group-chat-view__summary-grid,
  .group-chat-view__content {
    padding-left: 16px;
    padding-right: 16px;
  }

  .group-chat-guide__points,
  .group-chat-checklist__list {
    grid-template-columns: 1fr;
  }

  .group-chat-guide__title,
  .group-chat-checklist__title {
    font-size: 24px;
  }
}
</style>
