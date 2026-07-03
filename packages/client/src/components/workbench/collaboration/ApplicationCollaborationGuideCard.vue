<script setup lang="ts">
import { computed } from 'vue'
import { NButton } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationCollaborationSummary, ApplicationScenario } from '@/types/workbench/application'

const props = defineProps<{
  scenario: ApplicationScenario
  summary: ApplicationCollaborationSummary
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t, statusLabel } = useWorkbenchI18n()

const scenarioGuide = computed(() => {
  if (props.scenario === 'code') {
    return {
      title: t('workbench.collaboration.guides.codeTitle'),
      body: t('workbench.collaboration.guides.codeBody'),
      points: [
        t('workbench.collaboration.guides.codePoint1'),
        t('workbench.collaboration.guides.codePoint2'),
        t('workbench.collaboration.guides.codePoint3'),
      ],
    }
  }
  if (props.scenario === 'document') {
    return {
      title: t('workbench.collaboration.guides.documentTitle'),
      body: t('workbench.collaboration.guides.documentBody'),
      points: [
        t('workbench.collaboration.guides.documentPoint1'),
        t('workbench.collaboration.guides.documentPoint2'),
        t('workbench.collaboration.guides.documentPoint3'),
      ],
    }
  }
  if (props.scenario === 'ppt') {
    return {
      title: t('workbench.collaboration.guides.pptTitle'),
      body: t('workbench.collaboration.guides.pptBody'),
      points: [
        t('workbench.collaboration.guides.pptPoint1'),
        t('workbench.collaboration.guides.pptPoint2'),
        t('workbench.collaboration.guides.pptPoint3'),
      ],
    }
  }
  if (props.scenario === 'research') {
    return {
      title: t('workbench.collaboration.guides.researchTitle'),
      body: t('workbench.collaboration.guides.researchBody'),
      points: [
        t('workbench.collaboration.guides.researchPoint1'),
        t('workbench.collaboration.guides.researchPoint2'),
        t('workbench.collaboration.guides.researchPoint3'),
      ],
    }
  }
  return {
    title: t('workbench.collaboration.guides.generalTitle'),
    body: t('workbench.collaboration.guides.generalBody'),
    points: [
      t('workbench.collaboration.guides.generalPoint1'),
      t('workbench.collaboration.guides.generalPoint2'),
      t('workbench.collaboration.guides.generalPoint3'),
    ],
  }
})
</script>

<template>
  <article class="guide-card workbench-panel workbench-panel--accent">
    <div class="guide-card__eyebrow workbench-section-title">{{ t('workbench.collaboration.whyThisWorkspace') }}</div>
    <div class="guide-card__title">{{ scenarioGuide.title }}</div>
    <p class="guide-card__body">
      {{ scenarioGuide.body }}
    </p>
    <div class="guide-card__points">
      <div v-for="point in scenarioGuide.points" :key="point" class="guide-card__point">
        {{ point }}
      </div>
    </div>
    <div class="guide-card__chips">
      <span class="guide-chip">{{ t('workbench.collaboration.runChip', { status: statusLabel(summary.runStatus) }) }}</span>
      <span class="guide-chip">{{ t('workbench.collaboration.approvalsChip', { count: summary.pendingApprovalCount }) }}</span>
      <span class="guide-chip">{{ t('workbench.collaboration.artifactsChip', { count: summary.artifactCount }) }}</span>
    </div>
    <div class="guide-card__actions">
      <NButton secondary @click="emit('refresh')">{{ t('workbench.collaboration.refreshCollaborationContext') }}</NButton>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.guide-card {}

.guide-card__title {
  margin-top: 10px;
  color: $text-primary;
  font-size: 18px;
  font-weight: 700;
}

.guide-card__body {
  margin-top: 12px;
  color: $text-secondary;
  line-height: 1.6;
}

.guide-card__points {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.guide-card__point {
  border: 1px solid rgba(var(--accent-primary-rgb), 0.16);
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.06);
  color: $text-primary;
  line-height: 1.55;
  padding: 12px 14px;
}

.guide-card__chips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.guide-chip {
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-primary;
  font-size: 12px;
  font-weight: 700;
}

.guide-card__actions {
  margin-top: 18px;
}
</style>
