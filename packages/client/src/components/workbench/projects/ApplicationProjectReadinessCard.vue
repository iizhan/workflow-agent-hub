<script setup lang="ts">
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
defineProps<{
  readiness: {
    hasProject: boolean
    hasGit: boolean
    canRead: boolean
    canWrite: boolean
  }
}>()

const { t } = useWorkbenchI18n()
</script>

<template>
  <article class="readiness-card workbench-panel workbench-panel--soft">
    <div class="readiness-card__eyebrow workbench-section-title">{{ t('workbench.projects.workspaceReadiness') }}</div>
    <div class="readiness-list">
      <div class="readiness-item">
        <span class="readiness-item__dot" :class="{ 'readiness-item__dot--done': readiness.hasProject }"></span>
        <span>{{ t('workbench.projects.primaryContextProjectConnected') }}</span>
      </div>
      <div class="readiness-item">
        <span class="readiness-item__dot" :class="{ 'readiness-item__dot--done': readiness.hasGit }"></span>
        <span>{{ t('workbench.projects.gitContextAvailable') }}</span>
      </div>
      <div class="readiness-item">
        <span class="readiness-item__dot" :class="{ 'readiness-item__dot--done': readiness.canRead }"></span>
        <span>{{ t('workbench.projects.readAccessEnabled') }}</span>
      </div>
      <div class="readiness-item">
        <span class="readiness-item__dot" :class="{ 'readiness-item__dot--done': readiness.canWrite }"></span>
        <span>{{ t('workbench.projects.writeAccessEnabled') }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.readiness-card {}

.readiness-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.readiness-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: $text-primary;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  padding: 12px 14px;
  background: $bg-card-hover;
}

.readiness-item__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #b7791f;
  flex: none;
}

.readiness-item__dot--done {
  background: #2f7d4a;
}
</style>
