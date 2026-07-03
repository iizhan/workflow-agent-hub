<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  NButton,
  NTabPane,
  NTabs,
  NSpin,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/hermes/settings";
import { useAppStore } from "@/stores/hermes/app";
import DisplaySettings from "@/components/hermes/settings/DisplaySettings.vue";
import AgentSettings from "@/components/hermes/settings/AgentSettings.vue";
import MemorySettings from "@/components/hermes/settings/MemorySettings.vue";
import SessionSettings from "@/components/hermes/settings/SessionSettings.vue";
import PrivacySettings from "@/components/hermes/settings/PrivacySettings.vue";
import ModelSettings from "@/components/hermes/settings/ModelSettings.vue";
import AccountSettings from "@/components/hermes/settings/AccountSettings.vue";
import { BRAND_LEGACY_SURFACE_LABELS } from "@/constants/branding";

const settingsStore = useSettingsStore();
const appStore = useAppStore();
const router = useRouter();
const { t } = useI18n();

const settingsShellRef = ref<HTMLDivElement | null>(null);

const gatewayHealthy = computed(() => appStore.gatewayStatus === "running");
const backendHealthy = computed(() => appStore.connected);

const enabledDisplaySignals = computed(() =>
  [
    settingsStore.display.streaming,
    settingsStore.display.compact,
    settingsStore.display.show_reasoning,
    settingsStore.display.show_cost,
    settingsStore.display.inline_diffs,
    settingsStore.display.bell_on_complete,
  ].filter(Boolean).length,
);

const memoryEnabled = computed(() => !!settingsStore.memory.memory_enabled);
const userProfileEnabled = computed(() => !!settingsStore.memory.user_profile_enabled);
const privacyRedactionEnabled = computed(() => !!settingsStore.privacy.redact_pii);
const manualApprovalEnabled = computed(() => settingsStore.approvals.mode === "manual");

const platformConfiguredCount = computed(() => {
  const sources = [
    settingsStore.platforms,
    settingsStore.telegram,
    settingsStore.discord,
    settingsStore.slack,
    settingsStore.whatsapp,
    settingsStore.matrix,
    settingsStore.wecom,
    settingsStore.feishu,
    settingsStore.dingtalk,
    settingsStore.weixin,
  ];

  return sources.reduce((count, item) => count + (hasConfiguredValues(item) ? 1 : 0), 0);
});

const sessionModeLabel = computed(() => {
  const mode = settingsStore.sessionReset.mode;
  if (mode === "both") return t("settings.session.modeBoth");
  if (mode === "idle") return t("settings.session.modeIdle");
  if (mode === "hourly") return t("settings.session.modeHourly");
  return t("settings.summarySessionModeUnset");
});

const approvalModeLabel = computed(() =>
  manualApprovalEnabled.value
    ? t("settings.summaryApprovalManual")
    : t("settings.summaryApprovalOff"),
);

const memoryLabel = computed(() => {
  if (memoryEnabled.value && userProfileEnabled.value) {
    return t("settings.summaryMemoryFull");
  }
  if (memoryEnabled.value) return t("settings.summaryMemoryConversation");
  return t("settings.summaryMemoryOff");
});

type SettingsPrimaryAction = "focus-settings" | "open-gateways" | "open-applications";

const primaryDecision = computed(() => {
  if (!backendHealthy.value) {
    return {
      action: "open-gateways" as SettingsPrimaryAction,
      tone: "warning" as const,
      eyebrow: t("settings.primaryDecisionBackendEyebrow"),
      title: t("settings.primaryDecisionBackendTitle"),
      body: t("settings.primaryDecisionBackendBody"),
      actionLabel: t("settings.openGateways"),
    };
  }

  if (!gatewayHealthy.value) {
    return {
      action: "open-gateways" as SettingsPrimaryAction,
      tone: "warning" as const,
      eyebrow: t("settings.primaryDecisionGatewayEyebrow"),
      title: t("settings.primaryDecisionGatewayTitle"),
      body: t("settings.primaryDecisionGatewayBody"),
      actionLabel: t("settings.openGateways"),
    };
  }

  if (manualApprovalEnabled.value || privacyRedactionEnabled.value || memoryEnabled.value) {
    return {
      action: "focus-settings" as SettingsPrimaryAction,
      tone: "accent" as const,
      eyebrow: t("settings.primaryDecisionGovernEyebrow"),
      title: t("settings.primaryDecisionGovernTitle"),
      body: t("settings.primaryDecisionGovernBody"),
      actionLabel: t("settings.focusSettings"),
    };
  }

  if (enabledDisplaySignals.value > 0 || platformConfiguredCount.value > 0) {
    return {
      action: "focus-settings" as SettingsPrimaryAction,
      tone: "calm" as const,
      eyebrow: t("settings.primaryDecisionReviewEyebrow"),
      title: t("settings.primaryDecisionReviewTitle"),
      body: t("settings.primaryDecisionReviewBody"),
      actionLabel: t("settings.focusSettings"),
    };
  }

  return {
    action: "open-applications" as SettingsPrimaryAction,
    tone: "calm" as const,
    eyebrow: t("settings.primaryDecisionEmptyEyebrow"),
    title: t("settings.primaryDecisionEmptyTitle"),
    body: t("settings.primaryDecisionEmptyBody"),
    actionLabel: t("settings.openApplications"),
  };
});

const decisionChecklist = computed(() => [
  { key: "display", label: t("settings.checklistDisplay"), count: enabledDisplaySignals.value },
  { key: "memory", label: t("settings.checklistMemory"), count: memoryEnabled.value ? 1 : 0 },
  { key: "profile", label: t("settings.checklistUserProfile"), count: userProfileEnabled.value ? 1 : 0 },
  { key: "approval", label: t("settings.checklistApprovals"), count: manualApprovalEnabled.value ? 1 : 0 },
  { key: "platforms", label: t("settings.checklistPlatforms"), count: platformConfiguredCount.value },
]);

function hasConfiguredValues(value: Record<string, any> | undefined): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some((entry): boolean => {
    if (entry === null || entry === undefined) return false;
    if (typeof entry === "string") return entry.trim().length > 0;
    if (typeof entry === "number") return entry > 0;
    if (typeof entry === "boolean") return entry;
    if (Array.isArray(entry)) return entry.length > 0;
    if (typeof entry === "object") return hasConfiguredValues(entry as Record<string, any>);
    return false;
  });
}

function handlePrimaryDecision() {
  if (primaryDecision.value.action === "open-gateways") {
    router.push({ name: "hermes.gateways" });
    return;
  }
  if (primaryDecision.value.action === "open-applications") {
    router.push({ name: "workbench.applications" });
    return;
  }
  settingsShellRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

onMounted(() => {
  void settingsStore.fetchSettings();
  void appStore.checkConnection();
});
</script>

<template>
  <div class="settings-view workbench-page">
    <section class="workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="workbench-page__eyebrow">{{ BRAND_LEGACY_SURFACE_LABELS.settingsEyebrow }}</div>
        <h1 class="workbench-page__title">{{ BRAND_LEGACY_SURFACE_LABELS.settingsTitle }}</h1>
        <p class="workbench-page__subtitle">{{ t("settings.heroSubtitle") }}</p>
      </div>
      <div class="workbench-page__actions">
        <NButton secondary @click="router.push({ name: 'hermes.gateways' })">
          {{ t("settings.openGateways") }}
        </NButton>
        <NButton type="primary" @click="router.push({ name: 'workbench.applications' })">
          {{ t("settings.openApplications") }}
        </NButton>
      </div>
    </section>

    <section class="settings-view__decision-grid">
      <article class="settings-guide workbench-panel" :class="`settings-guide--${primaryDecision.tone}`">
        <div class="workbench-section-title">{{ primaryDecision.eyebrow }}</div>
        <h2 class="settings-guide__title">{{ primaryDecision.title }}</h2>
        <p class="settings-guide__body">{{ primaryDecision.body }}</p>
        <div class="settings-guide__points">
          <div class="settings-guide__point">{{ t("settings.guidePoint1") }}</div>
          <div class="settings-guide__point">{{ t("settings.guidePoint2") }}</div>
          <div class="settings-guide__point">{{ t("settings.guidePoint3") }}</div>
        </div>
        <div class="settings-guide__actions">
          <NButton type="primary" @click="handlePrimaryDecision()">
            {{ primaryDecision.actionLabel }}
          </NButton>
          <NButton quaternary @click="router.push({ name: 'workbench.runs' })">
            {{ t("settings.openRuns") }}
          </NButton>
        </div>
      </article>

      <article class="settings-checklist workbench-panel workbench-panel--soft">
        <div class="workbench-section-title">{{ t("settings.checklistEyebrow") }}</div>
        <h2 class="settings-checklist__title">{{ t("settings.checklistTitle") }}</h2>
        <p class="settings-checklist__body">{{ t("settings.checklistBody") }}</p>
        <div class="settings-checklist__list">
          <div v-for="item in decisionChecklist" :key="item.key" class="settings-checklist__item">
            <span class="settings-checklist__label">{{ item.label }}</span>
            <span class="settings-checklist__count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="settings-view__summary-grid">
      <article class="settings-stat workbench-panel">
        <div class="settings-stat__label">{{ t("settings.summaryGateway") }}</div>
        <div class="settings-stat__value">
          {{ gatewayHealthy ? t("sidebar.gatewayRunning") : t("sidebar.gatewayStopped") }}
        </div>
        <div class="settings-stat__meta">{{ t("settings.summaryGatewayMeta") }}</div>
      </article>

      <article class="settings-stat workbench-panel">
        <div class="settings-stat__label">{{ t("settings.summarySessionMode") }}</div>
        <div class="settings-stat__value">{{ sessionModeLabel }}</div>
        <div class="settings-stat__meta">{{ t("settings.summarySessionModeMeta") }}</div>
      </article>

      <article class="settings-stat workbench-panel">
        <div class="settings-stat__label">{{ t("settings.summaryMemory") }}</div>
        <div class="settings-stat__value">{{ memoryLabel }}</div>
        <div class="settings-stat__meta">{{ t("settings.summaryMemoryMeta") }}</div>
      </article>

      <article class="settings-stat workbench-panel">
        <div class="settings-stat__label">{{ t("settings.summaryApproval") }}</div>
        <div class="settings-stat__value">{{ approvalModeLabel }}</div>
        <div class="settings-stat__meta">{{ t("settings.summaryApprovalMeta") }}</div>
      </article>
    </section>

    <section class="settings-view__content">
      <div ref="settingsShellRef" class="settings-shell workbench-panel workbench-panel--soft">
        <header class="page-header settings-shell__header">
          <div class="settings-shell__title-group">
            <h2 class="header-title">{{ t("settings.title") }}</h2>
            <p class="settings-shell__subtitle">{{ t("settings.panelSubtitle") }}</p>
          </div>
        </header>

        <NSpin
          :show="settingsStore.loading || settingsStore.saving"
          size="large"
          :description="t('common.loading')"
        >
          <NTabs type="line" animated>
            <NTabPane name="account" :tab="t('settings.tabs.account')">
              <AccountSettings />
            </NTabPane>
            <NTabPane name="display" :tab="t('settings.tabs.display')">
              <DisplaySettings />
            </NTabPane>
            <NTabPane name="agent" :tab="t('settings.tabs.agent')">
              <AgentSettings />
            </NTabPane>
            <NTabPane name="memory" :tab="t('settings.tabs.memory')">
              <MemorySettings />
            </NTabPane>
            <NTabPane name="session" :tab="t('settings.tabs.session')">
              <SessionSettings />
            </NTabPane>
            <NTabPane name="privacy" :tab="t('settings.tabs.privacy')">
              <PrivacySettings />
            </NTabPane>
            <NTabPane name="models" :tab="t('settings.tabs.models')">
              <ModelSettings />
            </NTabPane>
          </NTabs>
        </NSpin>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.settings-view {
  min-height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.settings-view__decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 16px;
  padding: 0 24px 16px;
}

.settings-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-guide--warning {
  background:
    linear-gradient(135deg, rgba(178, 75, 66, 0.08), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.settings-guide--accent {
  background:
    linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.09), rgba(255, 255, 255, 0.96)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
}

.settings-guide__title,
.settings-checklist__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: $text-primary;
}

.settings-guide__body,
.settings-checklist__body,
.settings-shell__subtitle {
  color: $text-secondary;
  line-height: 1.7;
}

.settings-guide__points {
  display: grid;
  gap: 10px;
}

.settings-guide__point {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba($color: $border-color, $alpha: 0.9);
  background: rgba(255, 255, 255, 0.74);
  color: $text-secondary;
  line-height: 1.6;
}

.settings-guide__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.settings-checklist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-checklist__list {
  display: grid;
  gap: 10px;
}

.settings-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba($color: $border-color, $alpha: 0.9);
}

.settings-checklist__label {
  color: $text-secondary;
}

.settings-checklist__count {
  font-size: 18px;
  font-weight: 700;
  color: $text-primary;
}

.settings-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 0 24px 16px;
}

.settings-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 132px;
}

.settings-stat__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.settings-stat__value {
  font-size: 26px;
  line-height: 1.2;
  color: $text-primary;
}

.settings-stat__meta {
  color: $text-secondary;
  line-height: 1.6;
}

.settings-view__content {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
}

.settings-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-shell__header {
  padding: 0;
}

.settings-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

@media (max-width: 1100px) {
  .settings-view__decision-grid,
  .settings-view__summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .settings-view__decision-grid,
  .settings-view__summary-grid,
  .settings-view__content {
    padding-left: 16px;
    padding-right: 16px;
  }

  .settings-guide__title,
  .settings-checklist__title {
    font-size: 24px;
  }
}
</style>
