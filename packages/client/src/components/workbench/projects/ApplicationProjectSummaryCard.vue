<script setup lang="ts">
import { computed } from 'vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import type { ApplicationProjectSummary } from '@/types/workbench/application'

const props = defineProps<{
  project: ApplicationProjectSummary
}>()

const { t } = useWorkbenchI18n()

const permissionItems = computed(() => {
  const permissions = props.project.permissions
  if (!permissions) return []

  return [
    {
      label: t('workbench.projects.permissionRead'),
      value: permissions.allowRead ? t('workbench.projects.permissionEnabled') : t('workbench.projects.permissionDisabled'),
      active: permissions.allowRead,
      caution: false,
    },
    {
      label: t('workbench.projects.permissionWrite'),
      value: permissions.allowWrite ? t('workbench.projects.permissionEnabled') : t('workbench.projects.permissionDisabled'),
      active: permissions.allowWrite,
      caution: false,
    },
    {
      label: t('workbench.projects.permissionCommit'),
      value: permissions.allowCommit ? t('workbench.projects.permissionEnabled') : t('workbench.projects.permissionDisabled'),
      active: permissions.allowCommit,
      caution: false,
    },
    {
      label: t('workbench.projects.permissionPush'),
      value: permissions.allowPush ? t('workbench.projects.permissionEnabled') : t('workbench.projects.permissionDisabled'),
      active: permissions.allowPush,
      caution: false,
    },
    {
      label: t('workbench.projects.approvalGate'),
      value: permissions.allowPush
        ? (permissions.pushRequireApproval
            ? t('workbench.projects.permissionApprovalRequired')
            : t('workbench.projects.permissionApprovalNotRequired'))
        : t('workbench.projects.permissionApprovalInactive'),
      active: permissions.allowPush && permissions.pushRequireApproval,
      caution: permissions.allowPush && !permissions.pushRequireApproval,
    },
  ]
})
</script>

<template>
  <article class="project-card workbench-panel workbench-panel--soft">
    <div class="project-card__eyebrow workbench-section-title">{{ t('workbench.projects.primaryContextProject') }}</div>
    <template v-if="project.projectId">
      <h3 class="project-card__title">{{ project.name }}</h3>
      <p class="project-card__body">
        {{ project.description || t('workbench.projects.connectedProjectBody') }}
      </p>

      <dl class="project-card__meta">
        <div>
          <dt>{{ t('workbench.projects.sourceType') }}</dt>
          <dd>{{ project.sourceType || 'local' }}</dd>
        </div>
        <div>
          <dt>{{ t('workbench.projects.activeBranch') }}</dt>
          <dd>{{ project.currentBranch || t('workbench.projects.notDetected') }}</dd>
        </div>
      </dl>

      <div class="project-card__path">{{ project.localPath || t('workbench.projects.noLocalPathRecorded') }}</div>

      <div v-if="permissionItems.length" class="project-card__permissions">
        <div class="project-card__permissions-title">{{ t('workbench.projects.liveExecutionPermissions') }}</div>
        <div class="project-card__permission-grid">
          <div
            v-for="item in permissionItems"
            :key="item.label"
            class="project-card__permission-item"
            :class="{
              'project-card__permission-item--active': item.active,
              'project-card__permission-item--caution': item.caution,
            }"
          >
            <span class="project-card__permission-label">{{ item.label }}</span>
            <span class="project-card__permission-value">{{ item.value }}</span>
          </div>
        </div>
        <p class="project-card__permissions-hint">
          {{ t('workbench.projects.permissionGovernanceHint') }}
        </p>
      </div>
    </template>
    <template v-else>
      <h3 class="project-card__title">{{ t('workbench.projects.noPrimaryContextProjectConnected') }}</h3>
      <p class="project-card__body">
        {{ t('workbench.projects.noPrimaryContextProjectBody') }}
      </p>
    </template>
  </article>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.project-card {}

.project-card__title {
  margin-top: 10px;
  font-size: 22px;
  line-height: 1.2;
  color: $text-primary;
}

.project-card__body {
  margin-top: 12px;
  color: $text-secondary;
}

.project-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.project-card__meta dt {
  font-size: 12px;
  color: $text-muted;
}

.project-card__meta dd {
  margin-top: 4px;
  font-weight: 600;
  color: $text-primary;
  text-transform: capitalize;
}

.project-card__path {
  margin-top: 18px;
  border: 1px solid $border-light;
  background: $bg-card-hover;
  border-radius: $radius-md;
  padding: 12px 14px;
  color: $text-secondary;
  font-family: $font-code;
  font-size: 12px;
  word-break: break-all;
}

.project-card__permissions {
  margin-top: 18px;
}

.project-card__permissions-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
  font-weight: 700;
}

.project-card__permission-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.project-card__permission-item {
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-card-hover;
  padding: 10px 12px;
}

.project-card__permission-item--active {
  border-color: rgba(var(--accent-primary-rgb), 0.22);
  background: rgba(var(--accent-primary-rgb), 0.08);
}

.project-card__permission-item--caution {
  border-color: rgba(183, 121, 31, 0.28);
  background: rgba(183, 121, 31, 0.08);
}

.project-card__permission-label {
  display: block;
  font-size: 12px;
  color: $text-muted;
}

.project-card__permission-value {
  display: block;
  margin-top: 4px;
  color: $text-primary;
  font-weight: 600;
}

.project-card__permissions-hint {
  margin-top: 12px;
  color: $text-secondary;
  line-height: 1.6;
}
</style>
