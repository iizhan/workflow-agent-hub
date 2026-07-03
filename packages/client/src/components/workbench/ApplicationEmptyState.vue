<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationScenario } from '@/types/workbench/application'

const router = useRouter()
const { t, scenarioLabel } = useWorkbenchI18n()

const scenarios = computed<Array<{ key: ApplicationScenario; label: string; description: string }>>(() => [
  { key: 'code', label: scenarioLabel('code'), description: t('workbench.emptyState.scenarioCodeBody') },
  { key: 'document', label: scenarioLabel('document'), description: t('workbench.emptyState.scenarioDocumentBody') },
  { key: 'ppt', label: scenarioLabel('ppt'), description: t('workbench.emptyState.scenarioPptBody') },
  { key: 'research', label: scenarioLabel('research'), description: t('workbench.emptyState.scenarioResearchBody') },
])

function openCreate(scenario?: ApplicationScenario) {
  router.push({
    name: 'workbench.applicationCreate',
    query: scenario ? { scenario } : undefined,
  })
}
</script>

<template>
  <div class="application-empty-state">
    <div class="application-empty-state__eyebrow">{{ t('workbench.emptyState.eyebrow') }}</div>
    <h2 class="application-empty-state__title">{{ t('workbench.emptyState.title') }}</h2>
    <p class="application-empty-state__body">
      {{ t('workbench.emptyState.body') }}
    </p>

    <div class="application-empty-state__actions">
      <button class="application-empty-state__primary" type="button" @click="openCreate()">{{ t('workbench.emptyState.createApplication') }}</button>
      <button class="application-empty-state__secondary" type="button" @click="openCreate('code')">{{ t('workbench.emptyState.startWithCode') }}</button>
    </div>

    <div class="application-empty-state__guide">
      <div class="application-empty-state__guide-title">{{ t('workbench.emptyState.guideTitle') }}</div>
      <div class="application-empty-state__guide-points">
        <div class="application-empty-state__guide-point">{{ t('workbench.emptyState.guidePoint1') }}</div>
        <div class="application-empty-state__guide-point">{{ t('workbench.emptyState.guidePoint2') }}</div>
        <div class="application-empty-state__guide-point">{{ t('workbench.emptyState.guidePoint3') }}</div>
      </div>
    </div>

    <div class="application-empty-state__scenarios">
      <button
        v-for="scenario in scenarios"
        :key="scenario.key"
        class="scenario-card"
        type="button"
        @click="openCreate(scenario.key)"
      >
        <span class="scenario-card__title">{{ scenario.label }}</span>
        <span class="scenario-card__body">{{ scenario.description }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.application-empty-state {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  padding: 40px 32px;
  text-align: center;
}

.application-empty-state__eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $accent-primary;
  font-weight: 700;
}

.application-empty-state__title {
  margin-top: 12px;
  font-size: 32px;
  line-height: 1.2;
  color: $text-primary;
}

.application-empty-state__body {
  margin: 16px auto 0;
  max-width: 720px;
  color: $text-secondary;
  font-size: 15px;
}

.application-empty-state__actions {
  margin-top: 24px;
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.application-empty-state__primary,
.application-empty-state__secondary,
.scenario-card {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-card;
  color: $text-primary;
  cursor: pointer;
}

.application-empty-state__primary {
  background: $accent-primary;
  border-color: $accent-primary;
  color: #fff;
  padding: 12px 18px;
  font-weight: 600;
}

.application-empty-state__secondary {
  padding: 12px 18px;
  font-weight: 600;
}

.application-empty-state__guide {
  margin-top: 28px;
  padding: 18px;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: rgba(var(--accent-primary-rgb), 0.04);
}

.application-empty-state__guide-title {
  color: $text-primary;
  font-size: 16px;
  font-weight: 700;
}

.application-empty-state__guide-points {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.application-empty-state__guide-point {
  text-align: left;
  color: $text-secondary;
  line-height: 1.65;
  padding: 12px 14px;
  border-radius: $radius-md;
  background: $bg-card;
}

.application-empty-state__scenarios {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 28px;
}

.scenario-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 12px;
  text-align: left;
}

.scenario-card__title {
  font-weight: 700;
}

.scenario-card__body {
  color: $text-secondary;
  line-height: 1.55;
  font-size: 13px;
}

@media (max-width: 900px) {
  .application-empty-state__guide-points,
  .application-empty-state__scenarios {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .application-empty-state__title {
    font-size: 26px;
  }
}

@media (max-width: 640px) {
  .application-empty-state__guide-points,
  .application-empty-state__scenarios {
    grid-template-columns: 1fr;
  }
}
</style>
