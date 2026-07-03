<script setup lang="ts">
import { computed, onMounted, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NButton, NInput, NInputNumber, NSelect, NSwitch, useMessage } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationSettingsWorkspace } from '@/composables/workbench/useApplicationSettingsWorkspace'
import { useResourceBaselineSummary } from '@/composables/workbench/useResourceBaselineSummary'
import type { ApplicationDetail } from '@/types/workbench/application'
import { buildScopedWorkbenchRoute } from '@/utils/workbench-application-scope'

const props = defineProps<{
  application: ApplicationDetail
}>()

const message = useMessage()
const router = useRouter()
const applicationId = toRef(() => props.application.id)
const applicationRef = toRef(() => props.application)
const workspace = useApplicationSettingsWorkspace(applicationId, applicationRef)
const resourceBaseline = useResourceBaselineSummary()
const { t } = useWorkbenchI18n()

const flowModeOptions = computed(() => [
  { label: t('workbench.settings.freeform'), value: 'freeform' },
  { label: t('workbench.settings.stageGated'), value: 'stage-gated' },
])

const scopeLinks = computed(() => [
  {
    eyebrow: t('workbench.overview.appOwned'),
    title: t('workbench.header.applicationSettings'),
    body: t('workbench.settings.scopeAppOwnedBody'),
    active: true,
    action: null as (() => void) | null,
  },
  {
    eyebrow: t('workbench.overview.sharedScope'),
    title: t('workbench.header.sharedResources'),
    body: t('workbench.settings.scopeSharedBody'),
    active: false,
    action: () => router.push(buildScopedWorkbenchRoute('workbench.resources', props.application.id, 'settings')),
  },
  {
    eyebrow: t('workbench.overview.systemScope'),
    title: t('workbench.header.systemControl'),
    body: t('workbench.settings.scopeSystemBody'),
    active: false,
    action: () => router.push(buildScopedWorkbenchRoute('workbench.system', props.application.id, 'settings')),
  },
])

const readOnlyCards = computed(() => [
  {
    key: 'project-context',
    eyebrow: t('workbench.settings.projectContext'),
    title: t('workbench.settings.projectContextTitle'),
    items: [
      { label: t('workbench.settings.projectBinding'), value: props.application.settings.projectBound ? t('workbench.settings.connected') : t('workbench.settings.notConnectedYet') },
      { label: t('workbench.settings.primaryPath'), value: props.application.settings.projectLocalPath || t('workbench.settings.noLocalPath') },
      { label: t('workbench.settings.collaborationWorkspace'), value: props.application.sourceRoomId },
    ],
  },
])

const projectPermissionDraftSummary = computed(() => [
  {
    label: t('workbench.settings.allowRead'),
    value: workspace.allowRead.value ? t('workbench.settings.permissionEnabled') : t('workbench.settings.permissionDisabled'),
  },
  {
    label: t('workbench.settings.allowWrite'),
    value: workspace.allowWrite.value ? t('workbench.settings.permissionEnabled') : t('workbench.settings.permissionDisabled'),
  },
  {
    label: t('workbench.settings.allowCommit'),
    value: workspace.allowCommit.value ? t('workbench.settings.permissionEnabled') : t('workbench.settings.permissionDisabled'),
  },
  {
    label: t('workbench.settings.allowPush'),
    value: workspace.allowPush.value ? t('workbench.settings.permissionEnabled') : t('workbench.settings.permissionDisabled'),
  },
  {
    label: t('workbench.settings.pushRequiresApproval'),
    value: workspace.allowPush.value
      ? (workspace.pushRequireApproval.value
          ? t('workbench.settings.permissionApprovalRequired')
          : t('workbench.settings.permissionApprovalNotRequired'))
      : t('workbench.settings.permissionApprovalInactive'),
  },
])

onMounted(() => {
  resourceBaseline.load().catch(() => {
    // Keep settings usable even if shared resource summaries fail to load.
  })
})

async function handleSaveInviteCode() {
  try {
    await workspace.saveInviteCodeValue()
    message.success(t('workbench.settings.inviteCodeSaved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.settings.saveInviteCodeFailed')))
  }
}

async function handleSaveCompression() {
  try {
    await workspace.saveCompressionRules()
    message.success(t('workbench.settings.carryForwardRulesSaved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.settings.saveCarryForwardRulesFailed')))
  }
}

async function handleCompressNow() {
  try {
    await workspace.compressNow()
    message.success(t('workbench.settings.compressNow'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.settings.compressNow')))
  }
}

async function handleSaveFlowControl() {
  try {
    await workspace.saveFlowControl()
    message.success(t('workbench.settings.flowGuardrailsSaved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.settings.saveFlowGuardrailsFailed')))
  }
}

async function handleSaveProjectContext() {
  try {
    await workspace.saveProjectContext()
    message.success(t('workbench.settings.projectPermissionsSaved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.settings.saveProjectPermissionsFailed')))
  }
}

async function handleSaveRoleBaseline() {
  try {
    await workspace.saveRoleBaseline()
    message.success(t('workbench.settings.roleBaselineSaved'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.settings.saveRoleBaselineFailed')))
  }
}

async function handleApplyRoleBaseline() {
  try {
    await workspace.applyRoleBaseline()
    message.success(t('workbench.settings.savedBaselineRestoredToLiveTeam'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.settings.restoreRoleBaselineFailed')))
  }
}
</script>

<template>
  <div class="settings-workspace">
    <section class="settings-workspace__intro workbench-panel">
      <div class="workbench-section-title">{{ t('workbench.settings.introEyebrow') }}</div>
      <h2 class="settings-workspace__title">{{ t('workbench.settings.introTitle') }}</h2>
      <p class="settings-workspace__body">{{ t('workbench.settings.introBody') }}</p>
      <NAlert type="info" class="settings-workspace__alert">
        {{ t('workbench.settings.introAlert') }}
      </NAlert>
      <div class="settings-workspace__scope-strip">
        <article
          v-for="item in scopeLinks"
          :key="item.title"
          class="settings-scope-card workbench-kv-card"
          :class="{ 'settings-scope-card--active': item.active }"
        >
          <div class="settings-scope-card__eyebrow">{{ item.eyebrow }}</div>
          <div class="settings-scope-card__title">{{ item.title }}</div>
          <div class="settings-scope-card__body">{{ item.body }}</div>
          <NButton
            v-if="item.action"
            secondary
            class="settings-scope-card__action"
            @click="item.action()"
          >
            {{ t('workbench.settings.goToScope', { scope: item.title }) }}
          </NButton>
          <div v-else class="settings-scope-card__status">{{ t('workbench.settings.youAreEditing') }}</div>
        </article>
      </div>
    </section>

    <section class="settings-workspace__grid">
      <article class="settings-card workbench-panel workbench-panel--soft">
        <div class="settings-card__eyebrow workbench-section-title">{{ t('workbench.settings.access') }}</div>
        <h3 class="settings-card__title">{{ t('workbench.settings.workspaceIdentity') }}</h3>
        <div class="settings-card__form">
          <label class="settings-card__input-label">{{ t('workbench.settings.inviteCode') }}</label>
          <NInput
            v-model:value="workspace.inviteCode.value"
            :placeholder="t('workbench.settings.inviteCodePlaceholder')"
            :maxlength="32"
          />
          <div class="settings-card__items">
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.operatorName') }}</div>
              <div class="settings-card__value">{{ application.settings.userName || t('workbench.settings.notConfigured') }}</div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.operatorContext') }}</div>
              <div class="settings-card__value">{{ application.settings.userDescription || t('workbench.settings.noOperatorDescription') }}</div>
            </div>
          </div>
          <div class="settings-card__actions">
            <NButton
              type="primary"
              :disabled="!workspace.canSaveInviteCode.value"
              :loading="workspace.isSavingInviteCode.value"
              @click="handleSaveInviteCode"
            >
              {{ t('workbench.settings.saveInviteCode') }}
            </NButton>
          </div>
        </div>
      </article>

      <article class="settings-card workbench-panel workbench-panel--soft">
        <div class="settings-card__eyebrow workbench-section-title">{{ t('workbench.settings.flowControl') }}</div>
        <h3 class="settings-card__title">{{ t('workbench.settings.flowGuardrails') }}</h3>
        <div class="settings-card__form settings-card__form--stacked">
          <div class="settings-card__number-grid">
            <div>
              <label class="settings-card__input-label">{{ t('workbench.settings.executionMode') }}</label>
              <NSelect
                v-model:value="workspace.flowMode.value"
                :options="flowModeOptions"
              />
            </div>
            <div>
              <label class="settings-card__input-label">{{ t('workbench.settings.flowOwner') }}</label>
              <NInput
                v-model:value="workspace.flowOwnerName.value"
                :placeholder="t('workbench.settings.flowOwnerPlaceholder')"
                :loading="workspace.isLoadingFlowControl.value"
              />
            </div>
            <div>
              <label class="settings-card__input-label">{{ t('workbench.settings.ownerRole') }}</label>
              <NInput
                v-model:value="workspace.flowOwnerRole.value"
                :placeholder="t('workbench.settings.ownerRolePlaceholder')"
                :loading="workspace.isLoadingFlowControl.value"
              />
            </div>
            <div>
              <label class="settings-card__input-label">{{ t('workbench.settings.outputRoot') }}</label>
              <NInput
                v-model:value="workspace.outputRootDir.value"
                :placeholder="t('workbench.settings.outputRootPlaceholder')"
                :loading="workspace.isLoadingFlowControl.value"
              />
            </div>
          </div>
          <div class="settings-card__switch-row workbench-kv-card">
            <div>
              <div class="settings-card__label">{{ t('workbench.settings.allowManualJump') }}</div>
              <div class="settings-card__value settings-card__value--muted">
                {{ t('workbench.settings.allowManualJumpHint') }}
              </div>
            </div>
            <NSwitch v-model:value="workspace.allowManualJump.value" />
          </div>
          <div class="settings-card__actions">
            <NButton
              type="primary"
              :disabled="!workspace.canSaveFlowControl.value"
              :loading="workspace.isSavingFlowControl.value"
              @click="handleSaveFlowControl"
            >
              {{ t('workbench.settings.saveFlowGuardrails') }}
            </NButton>
          </div>
        </div>
      </article>

      <article class="settings-card workbench-panel workbench-panel--soft">
        <div class="settings-card__eyebrow workbench-section-title">{{ t('workbench.settings.compression') }}</div>
        <h3 class="settings-card__title">{{ t('workbench.settings.carryForwardRules') }}</h3>
        <div class="settings-card__form settings-card__form--stacked">
          <div class="settings-card__number-grid">
            <div>
              <label class="settings-card__input-label">{{ t('workbench.settings.triggerThreshold') }}</label>
              <NInputNumber
                v-model:value="workspace.triggerTokens.value"
                :min="1"
                :step="1000"
                style="width: 100%;"
              />
            </div>
            <div>
              <label class="settings-card__input-label">{{ t('workbench.settings.historyCeiling') }}</label>
              <NInputNumber
                v-model:value="workspace.maxHistoryTokens.value"
                :min="1"
                :step="1000"
                style="width: 100%;"
              />
            </div>
            <div>
              <label class="settings-card__input-label">{{ t('workbench.settings.recentMessageTail') }}</label>
              <NInputNumber
                v-model:value="workspace.tailMessageCount.value"
                :min="1"
                :step="1"
                style="width: 100%;"
              />
            </div>
          </div>
          <p class="settings-card__hint">
            {{ t('workbench.settings.compressionHint') }}
          </p>
          <div class="settings-card__actions">
            <NButton
              secondary
              :loading="workspace.isCompressing.value"
              @click="handleCompressNow"
            >
              {{ t('workbench.settings.compressNow') }}
            </NButton>
            <NButton
              type="primary"
              :disabled="!workspace.canSaveCompression.value"
              :loading="workspace.isSavingCompression.value"
              @click="handleSaveCompression"
            >
              {{ t('workbench.settings.saveCarryForwardRules') }}
            </NButton>
          </div>
        </div>
      </article>

      <article class="settings-card workbench-panel workbench-panel--soft">
        <div class="settings-card__eyebrow workbench-section-title">{{ t('workbench.settings.roleBaseline') }}</div>
        <h3 class="settings-card__title">{{ t('workbench.settings.starterTeamTitle') }}</h3>
        <div class="settings-card__form settings-card__form--stacked">
          <p class="settings-card__hint">
            {{ t('workbench.settings.roleBaselineHint') }}
          </p>
          <div class="settings-card__items">
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.liveRoleTeam') }}</div>
              <div class="settings-card__value">{{ t('workbench.settings.activeRoles', { count: application.agents.total }) }}</div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.savedStarterRoles') }}</div>
              <div class="settings-card__value">{{ t('workbench.settings.savedRoles', { count: workspace.savedRoleBaseline.value.roleCount }) }}</div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.invitedByDefault') }}</div>
              <div class="settings-card__value">{{ t('workbench.settings.invitedRoles', { count: workspace.savedRoleBaseline.value.invitedCount }) }}</div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.savedRoleNames') }}</div>
              <div class="settings-card__value">
                {{ workspace.savedRoleBaseline.value.roles.length ? workspace.savedRoleBaseline.value.roles.join(', ') : t('workbench.settings.noSavedBaseline') }}
              </div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.savedModelBaseline') }}</div>
              <div class="settings-card__value">
                {{ workspace.savedRoleBaseline.value.models.length ? workspace.savedRoleBaseline.value.models.join(', ') : t('workbench.settings.perRoleDefaultsHint') }}
              </div>
            </div>
          </div>
          <NAlert type="info" class="settings-card__embedded-alert">
            {{ t('workbench.settings.roleBaselineAlert') }}
          </NAlert>
          <div class="settings-card__actions">
            <NButton
              secondary
              :disabled="!workspace.canApplyRoleBaseline.value"
              :loading="workspace.isApplyingRoleBaseline.value"
              @click="handleApplyRoleBaseline"
            >
              {{ t('workbench.settings.restoreSavedBaselineToLiveTeam') }}
            </NButton>
            <NButton
              type="primary"
              :disabled="!workspace.canSaveRoleBaseline.value"
              :loading="workspace.isSavingRoleBaseline.value"
              @click="handleSaveRoleBaseline"
            >
              {{ t('workbench.settings.saveLiveTeamAsBaseline') }}
            </NButton>
          </div>
        </div>
      </article>

      <article class="settings-card workbench-panel workbench-panel--soft">
        <div class="settings-card__eyebrow workbench-section-title">{{ t('workbench.settings.resourceBaseline') }}</div>
        <h3 class="settings-card__title">{{ t('workbench.settings.inheritedResourcesTitle') }}</h3>
        <div class="settings-card__form settings-card__form--stacked">
          <p class="settings-card__hint">
            {{ t('workbench.settings.resourceBaselineHint') }}
          </p>
          <div class="settings-card__items">
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.activeProfile') }}</div>
              <div class="settings-card__value">{{ resourceBaseline.activeProfileName.value }}</div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.profileGateway') }}</div>
              <div class="settings-card__value">{{ resourceBaseline.activeProfileDetail.value?.gateway || t('workbench.resources.notResolvedYet') }}</div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.defaultRuntimeModel') }}</div>
              <div class="settings-card__value">{{ resourceBaseline.defaultModelLabel.value }}</div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.enabledSkills') }}</div>
              <div class="settings-card__value">
                {{ t('workbench.settings.activeSkillsCount', { count: resourceBaseline.skillsSummary.value.enabled }) }}
                <span class="settings-card__value--muted">{{ t('workbench.settings.availableSuffix', { count: resourceBaseline.skillsSummary.value.total }) }}</span>
              </div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.pinnedSharedSkills') }}</div>
              <div class="settings-card__value">
                {{ t('workbench.settings.sharedSkillsBreakdown', {
                  pinned: resourceBaseline.skillsSummary.value.pinned,
                  modified: resourceBaseline.skillsSummary.value.modified,
                  local: resourceBaseline.skillsSummary.value.local,
                }) }}
              </div>
            </div>
            <div class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ t('workbench.settings.memorySurfaces') }}</div>
              <div class="settings-card__value">
                {{ t('workbench.settings.configuredSections', {
                  count: resourceBaseline.memorySummary.value.configuredSections,
                  notes: resourceBaseline.memorySummary.value.sectionLengths.memory,
                  profile: resourceBaseline.memorySummary.value.sectionLengths.user,
                  soul: resourceBaseline.memorySummary.value.sectionLengths.soul,
                }) }}
              </div>
            </div>
          </div>
          <NAlert type="warning" class="settings-card__embedded-alert">
            {{ t('workbench.settings.resourceWarning') }}
          </NAlert>
          <div class="settings-card__actions">
            <NButton secondary @click="router.push(buildScopedWorkbenchRoute('workbench.resources', application.id, 'settings'))">
              {{ t('workbench.settings.openSharedResources') }}
            </NButton>
            <NButton secondary @click="router.push(buildScopedWorkbenchRoute('workbench.system', application.id, 'settings'))">
              {{ t('workbench.settings.openSystemControl') }}
            </NButton>
            <NButton secondary @click="router.push({ name: 'hermes.profiles' })">
              {{ t('workbench.settings.openProfiles') }}
            </NButton>
          </div>
        </div>
      </article>

      <article v-for="card in readOnlyCards" :key="card.title" class="settings-card workbench-panel workbench-panel--soft">
        <template v-if="card.key === 'project-context'">
          <div class="settings-card__eyebrow workbench-section-title">{{ card.eyebrow }}</div>
          <h3 class="settings-card__title">{{ card.title }}</h3>
          <p class="settings-card__hint">
            {{ t('workbench.settings.projectPermissionHint') }}
          </p>
          <div class="settings-card__items">
            <div v-for="item in card.items" :key="item.label" class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ item.label }}</div>
              <div class="settings-card__value">{{ item.value }}</div>
            </div>
          </div>
          <template v-if="application.primaryProject">
            <div class="settings-card__permission-summary">
              <div class="settings-card__permission-summary-title">{{ t('workbench.settings.currentLivePermissions') }}</div>
              <div class="settings-card__permission-summary-grid">
                <div
                  v-for="item in projectPermissionDraftSummary"
                  :key="item.label"
                  class="settings-card__permission-summary-item workbench-kv-card"
                >
                  <div class="settings-card__label">{{ item.label }}</div>
                  <div class="settings-card__value">{{ item.value }}</div>
                </div>
              </div>
            </div>
            <NAlert v-if="workspace.projectContextDirty.value" type="warning" class="settings-card__embedded-alert">
              {{ t('workbench.settings.projectPermissionDirty') }}
            </NAlert>
            <div class="settings-card__permission-grid">
              <div class="settings-card__switch-row workbench-kv-card">
                <div>
                  <div class="settings-card__label">{{ t('workbench.settings.allowRead') }}</div>
                  <div class="settings-card__value settings-card__value--muted">
                    {{ t('workbench.settings.allowReadHint') }}
                  </div>
                </div>
                <NSwitch v-model:value="workspace.allowRead.value" />
              </div>
              <div class="settings-card__switch-row workbench-kv-card">
                <div>
                  <div class="settings-card__label">{{ t('workbench.settings.allowWrite') }}</div>
                  <div class="settings-card__value settings-card__value--muted">
                    {{ t('workbench.settings.allowWriteHint') }}
                  </div>
                </div>
                <NSwitch v-model:value="workspace.allowWrite.value" />
              </div>
              <div class="settings-card__switch-row workbench-kv-card">
                <div>
                  <div class="settings-card__label">{{ t('workbench.settings.allowCommit') }}</div>
                  <div class="settings-card__value settings-card__value--muted">
                    {{ t('workbench.settings.allowCommitHint') }}
                  </div>
                </div>
                <NSwitch v-model:value="workspace.allowCommit.value" />
              </div>
              <div class="settings-card__switch-row workbench-kv-card">
                <div>
                  <div class="settings-card__label">{{ t('workbench.settings.allowPush') }}</div>
                  <div class="settings-card__value settings-card__value--muted">
                    {{ t('workbench.settings.allowPushHint') }}
                  </div>
                </div>
                <NSwitch v-model:value="workspace.allowPush.value" />
              </div>
              <div class="settings-card__switch-row workbench-kv-card">
                <div>
                  <div class="settings-card__label">{{ t('workbench.settings.pushRequiresApproval') }}</div>
                  <div class="settings-card__value settings-card__value--muted">
                    {{ t('workbench.settings.pushRequiresApprovalHint') }}
                  </div>
                </div>
                <NSwitch v-model:value="workspace.pushRequireApproval.value" />
              </div>
            </div>
            <div class="settings-card__actions">
              <NButton
                type="primary"
                :disabled="!workspace.canSaveProjectContext.value"
                :loading="workspace.isSavingProjectContext.value || workspace.isLoadingProjectContext.value"
                @click="handleSaveProjectContext"
              >
                {{ t('workbench.settings.saveProjectPermissions') }}
              </NButton>
            </div>
          </template>
          <NAlert v-else type="warning" class="settings-card__embedded-alert">
            {{ t('workbench.settings.connectPrimaryContextWarning') }}
          </NAlert>
        </template>
        <template v-else>
          <div class="settings-card__eyebrow workbench-section-title">{{ card.eyebrow }}</div>
          <h3 class="settings-card__title">{{ card.title }}</h3>
          <div class="settings-card__items">
            <div v-for="item in card.items" :key="item.label" class="settings-card__item workbench-kv-card">
              <div class="settings-card__label">{{ item.label }}</div>
              <div class="settings-card__value">{{ item.value }}</div>
            </div>
          </div>
        </template>
      </article>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.settings-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-workspace__intro {
  padding: 22px 24px;
}

.settings-workspace__title {
  margin-top: 10px;
  font-size: 24px;
  line-height: 1.2;
  color: $text-primary;
}

.settings-workspace__body {
  margin-top: 12px;
  max-width: 760px;
  color: $text-secondary;
  line-height: 1.7;
}

.settings-workspace__alert {
  margin-top: 16px;
}

.settings-workspace__scope-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.settings-workspace__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.settings-scope-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100%;
}

.settings-scope-card--active {
  border-color: rgba(var(--accent-primary-rgb), 0.35);
  background: linear-gradient(180deg, rgba(var(--accent-primary-rgb), 0.06), rgba(var(--accent-primary-rgb), 0.02));
}

.settings-scope-card__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $accent-primary;
  font-weight: 700;
}

.settings-scope-card__title {
  color: $text-primary;
  font-weight: 700;
}

.settings-scope-card__body {
  color: $text-secondary;
  line-height: 1.6;
}

.settings-scope-card__action {
  margin-top: auto;
  align-self: flex-start;
}

.settings-scope-card__status {
  margin-top: auto;
  color: $accent-primary;
  font-weight: 600;
}

.settings-card__title {
  margin-top: 10px;
  font-size: 17px;
  color: $text-primary;
}

.settings-card__form {
  margin-top: 16px;
}

.settings-card__form--stacked {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-card__number-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.settings-card__input-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.settings-card__items {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.settings-card__permission-grid {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.settings-card__permission-summary {
  margin-top: 16px;
}

.settings-card__permission-summary-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
  font-weight: 700;
}

.settings-card__permission-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.settings-card__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: $text-muted;
}

.settings-card__value {
  margin-top: 8px;
  color: $text-primary;
  line-height: 1.6;
}

.settings-card__value--muted {
  color: $text-secondary;
}

.settings-card__hint {
  color: $text-secondary;
  line-height: 1.6;
}

.settings-card__switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.settings-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.settings-card__embedded-alert {
  margin-top: 16px;
}

@media (max-width: 1100px) {
  .settings-workspace__scope-strip {
    grid-template-columns: 1fr;
  }

  .settings-workspace__grid {
    grid-template-columns: 1fr;
  }

  .settings-card__permission-summary-grid {
    grid-template-columns: 1fr;
  }

  .settings-card__switch-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
