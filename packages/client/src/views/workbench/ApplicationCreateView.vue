<script setup lang="ts">
import ApplicationCreateWizard from '@/components/workbench/ApplicationCreateWizard.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'

const { t } = useWorkbenchI18n()
</script>

<template>
  <div class="application-create-view workbench-page">
    <section class="create-hero workbench-page__hero">
      <div class="workbench-page__hero-copy">
        <div class="create-hero__eyebrow workbench-page__eyebrow">{{ t('workbench.create.heroEyebrow') }}</div>
        <h1 class="application-create-view__title workbench-page__title">{{ t('workbench.create.heroTitle') }}</h1>
        <p class="application-create-view__subtitle workbench-page__subtitle">
          {{ t('workbench.create.heroSubtitle') }}
        </p>
      </div>
    </section>

    <main class="application-create-view__content">
      <ApplicationCreateWizard />
    </main>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.application-create-view__content {
  padding: 12px 24px 24px;
}
</style>
