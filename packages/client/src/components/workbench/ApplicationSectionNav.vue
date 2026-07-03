<script setup lang="ts">
import { computed } from 'vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationSectionKey } from '@/types/workbench/application'

const props = defineProps<{
  activeSection: ApplicationSectionKey
  sections: ApplicationSectionKey[]
}>()

const emit = defineEmits<{
  change: [section: ApplicationSectionKey]
}>()

const { sectionLabel } = useWorkbenchI18n()
const labels = computed<Record<ApplicationSectionKey, string>>(() => ({
  overview: sectionLabel('overview'),
  projects: sectionLabel('projects'),
  agents: sectionLabel('agents'),
  workflow: sectionLabel('workflow'),
  artifacts: sectionLabel('artifacts'),
  runs: sectionLabel('runs'),
  collaboration: sectionLabel('collaboration'),
  settings: sectionLabel('settings'),
}))

const orderedSections = computed(() => {
  const order: ApplicationSectionKey[] = [
    'overview',
    'collaboration',
    'runs',
    'projects',
    'agents',
    'workflow',
    'artifacts',
    'settings',
  ]

  return props.sections.slice().sort((left, right) => order.indexOf(left) - order.indexOf(right))
})
</script>

<template>
  <div class="application-section-nav">
    <button
      v-for="section in orderedSections"
      :key="section"
      type="button"
      class="application-section-nav__item"
      :class="{ 'application-section-nav__item--active': section === props.activeSection }"
      @click="emit('change', section)"
    >
      {{ labels[section] }}
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.application-section-nav {
  display: flex;
  gap: 10px;
  padding: 0 24px 20px;
  overflow-x: auto;
  position: sticky;
  top: 0;
  z-index: 5;
  backdrop-filter: blur(10px);
  background: linear-gradient(180deg, rgba(250, 250, 250, 0.92), rgba(250, 250, 250, 0.72));
}

.application-section-nav__item {
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.72);
  color: $text-secondary;
  border-radius: 999px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.application-section-nav__item--active {
  color: $accent-primary;
  border-color: rgba(var(--accent-primary-rgb), 0.35);
  background: rgba(var(--accent-primary-rgb), 0.12);
  box-shadow: inset 0 0 0 1px rgba(var(--accent-primary-rgb), 0.08);
}
</style>
