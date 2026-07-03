<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton, NPopconfirm, useMessage, useDialog } from 'naive-ui'
import type { AvailableModelGroup } from '@/api/hermes/system'
import { useModelsStore } from '@/stores/hermes/models'
import { useAppStore } from '@/stores/hermes/app'
import { useChatStore } from '@/stores/hermes/chat'
import { checkCopilotToken, disableCopilot } from '@/api/hermes/copilot-auth'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ provider: AvailableModelGroup }>()
const emit = defineEmits<{
  edit: [provider: AvailableModelGroup]
}>()

const { t } = useI18n()
const modelsStore = useModelsStore()
const appStore = useAppStore()
const chatStore = useChatStore()
const message = useMessage()
const dialog = useDialog()

const isCustom = computed(() => !props.provider.builtin && props.provider.provider.startsWith('custom:'))
const isCopilot = computed(() => props.provider.provider === 'copilot')
const displayName = computed(() => props.provider.label)
const primaryModel = computed(() => props.provider.primary_model || props.provider.models[0] || '')
const deleting = ref(false)
const togglingModel = ref('')
const togglingProvider = ref(false)

const disabledModelsCount = computed(() =>
  props.provider.models.filter(model => modelMeta(model)?.user_disabled).length,
)

function handleEdit() {
  emit('edit', props.provider)
}

function modelMeta(model: string) {
  return props.provider.model_meta?.[model]
}

function isUserDisabled(model: string) {
  return !!modelMeta(model)?.user_disabled
}

function isProviderDisabled(model: string) {
  const meta = modelMeta(model)
  return !!meta?.disabled && !meta.user_disabled
}

function isChannelDisabled() {
  return !!props.provider.user_disabled
}

async function handleToggleProvider() {
  togglingProvider.value = true
  try {
    const nextEnabled = isChannelDisabled()
    await modelsStore.setProviderEnabled(props.provider.provider, nextEnabled)
    message.success(nextEnabled ? t('models.channelEnabled') : t('models.channelDisabled'))
  } catch (e: any) {
    message.error(e.message)
  } finally {
    togglingProvider.value = false
  }
}

async function handleToggleModel(model: string) {
  if (isProviderDisabled(model)) {
    message.warning(t('models.providerDisabledModelHint'))
    return
  }
  togglingModel.value = model
  try {
    const nextEnabled = isUserDisabled(model)
    await modelsStore.setModelEnabled(props.provider.provider, model, nextEnabled)
    message.success(nextEnabled ? t('models.modelEnabled') : t('models.modelDisabled'))
  } catch (e: any) {
    message.error(e.message)
  } finally {
    togglingModel.value = ''
  }
}

async function handleDelete() {
  let copilotMsg = ''
  if (isCopilot.value) {
    // 提前查 source，让用户清楚移除会不会影响 VS Code/gh CLI 等其他工具的登录态
    try {
      const status = await checkCopilotToken()
      if (status.source === 'env') copilotMsg = t('models.copilotDeleteHintEnv')
      else if (status.source === 'gh-cli') copilotMsg = t('models.copilotDeleteHintGhCli')
      else if (status.source === 'apps-json') copilotMsg = t('models.copilotDeleteHintAppsJson')
    } catch { /* ignore — fall back to generic confirm copy */ }
  }
  dialog.warning({
    title: t('models.deleteProvider'),
    content: isCopilot.value && copilotMsg
      ? `${t('models.deleteConfirm', { name: displayName.value })}\n\n${copilotMsg}`
      : t('models.deleteConfirm', { name: displayName.value }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      deleting.value = true
      try {
        if (isCopilot.value) {
          // Copilot 走显式 opt-in 模型：disable 把 enabled 置 false，
          // 仅当 token 来自 ~/.hermes/.env 时才清掉，gh-cli / apps.json 不动。
          await disableCopilot()
          // 服务端会在默认模型属于 copilot 时清掉 model.default，这里再清理本地
          // 会话级 model/provider，避免 Chat 页继续显示已下架的 copilot 模型。
          chatStore.clearProviderFromSessions('copilot')
          await Promise.all([modelsStore.fetchProviders(), appStore.loadModels()])
        } else {
          await modelsStore.removeProvider(props.provider.provider)
        }
        // 删完之后若已没有默认模型，自动从剩余 provider 里挑一个，避免 chat 页
        // "无默认模型"的尴尬态。与 hermes CLI `model` 子命令的隐含行为对齐。
        if (!appStore.selectedModel && appStore.modelGroups.length > 0) {
          const first = appStore.modelGroups.find(g => !g.user_disabled && g.models.some(model => !g.model_meta?.[model]?.disabled))
          const firstModel = first?.models.find(model => !first.model_meta?.[model]?.disabled)
          if (first && firstModel) {
            await appStore.switchModel(firstModel, first.provider)
          }
        }
        message.success(t('models.providerDeleted'))
      } catch (e: any) {
        message.error(e.message)
      } finally {
        deleting.value = false
      }
    },
  })
}
</script>

<template>
  <div class="provider-card" :class="{ disabled: isChannelDisabled() }">
    <div class="card-header">
      <div class="provider-title-block">
        <h3 class="provider-name">{{ displayName }}</h3>
        <span class="type-badge" :class="isCustom ? 'custom' : 'builtin'">
          {{ isCustom ? t('models.customType') : t('models.builtIn') }}
        </span>
      </div>
      <NPopconfirm
        :positive-text="isChannelDisabled() ? t('models.enableChannel') : t('models.disableChannel')"
        :negative-text="t('common.cancel')"
        @positive-click="handleToggleProvider"
      >
        <template #trigger>
          <button
            class="channel-switch"
            type="button"
            role="switch"
            :aria-checked="!isChannelDisabled()"
            :class="{ active: !isChannelDisabled() }"
            :disabled="togglingProvider"
            @click.stop
          >
            <span class="channel-switch__track">
              <span class="channel-switch__knob" />
            </span>
            <span class="channel-switch__text">
              {{ isChannelDisabled() ? t('models.disabledState') : t('models.enabledState') }}
            </span>
          </button>
        </template>
        {{ isChannelDisabled() ? t('models.enableChannelConfirm', { channel: displayName }) : t('models.disableChannelConfirm', { channel: displayName }) }}
      </NPopconfirm>
    </div>

    <div class="card-body">
      <div class="info-row">
        <span class="info-label">{{ t('models.provider') }}</span>
        <code class="info-value mono">{{ provider.provider }}</code>
      </div>
      <div class="info-row">
        <span class="info-label">{{ t('models.baseUrl') }}</span>
        <code class="info-value mono">{{ provider.base_url }}</code>
      </div>
      <div class="info-row models-row">
        <span class="info-label">{{ t('models.models') }}</span>
        <span class="info-value models-count">
          {{ provider.models.length }} {{ t('models.count') }}
          <span v-if="disabledModelsCount > 0"> · {{ t('models.disabledCount', { count: disabledModelsCount }) }}</span>
        </span>
      </div>
      <div v-if="primaryModel" class="info-row">
        <span class="info-label">{{ t('models.defaultModel') }}</span>
        <code class="info-value mono">{{ primaryModel }}</code>
      </div>
      <div class="models-list">
        <span
          v-for="model in provider.models.slice(0, 20)"
          :key="model"
          class="model-tag"
          :class="{ disabled: isUserDisabled(model), unavailable: isProviderDisabled(model) }"
        >
          <span class="model-tag__name">{{ model }}</span>
          <span v-if="modelMeta(model)?.preview" class="model-tag__badge">{{ t('models.previewBadge') }}</span>
          <span v-if="isProviderDisabled(model)" class="model-tag__badge danger">{{ t('models.disabledBadge') }}</span>
          <NPopconfirm
            v-else
            :positive-text="isUserDisabled(model) ? t('models.enableModel') : t('models.disableModel')"
            :negative-text="t('common.cancel')"
            @positive-click="handleToggleModel(model)"
          >
            <template #trigger>
              <button
                class="model-switch"
                type="button"
                role="switch"
                :aria-checked="!isUserDisabled(model)"
                :class="{ active: !isUserDisabled(model) }"
                :disabled="togglingModel === model || isChannelDisabled()"
                @click.stop
              >
                <span class="model-switch__track">
                  <span class="model-switch__knob" />
                </span>
                <span class="model-switch__text">
                  {{ isUserDisabled(model) ? t('models.disabledState') : t('models.enabledState') }}
                </span>
              </button>
            </template>
            {{ isUserDisabled(model) ? t('models.enableModelConfirm', { model }) : t('models.disableModelConfirm', { model }) }}
          </NPopconfirm>
        </span>
        <span v-if="provider.models.length > 20" class="model-tag model-tag-more">
          +{{ provider.models.length - 20 }} {{ t('models.more') }}
        </span>
      </div>
    </div>

    <div class="card-actions">
      <NButton
        v-if="provider.provider.startsWith('custom:')"
        size="tiny"
        quaternary
        @click="handleEdit"
      >
        {{ t('common.edit') }}
      </NButton>
      <NButton size="tiny" quaternary type="error" :loading="deleting" @click="handleDelete">{{ t('common.delete') }}</NButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.provider-card {
  background-color: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: 16px;
  transition: border-color $transition-fast;

  &:hover {
    border-color: rgba(var(--accent-primary-rgb), 0.3);
  }

  &.disabled {
    border-color: rgba(var(--warning-rgb), 0.24);
    background: linear-gradient(180deg, rgba(var(--warning-rgb), 0.05), $bg-card);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.provider-title-block {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.provider-name {
  font-size: 15px;
  font-weight: 600;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.type-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;

  &.builtin {
    background: rgba(var(--accent-primary-rgb), 0.12);
    color: $accent-primary;
  }

  &.custom {
    background: rgba(var(--success-rgb), 0.12);
    color: $success;
  }
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 12px;
  color: $text-muted;
}

.info-value {
  font-size: 12px;
  color: $text-secondary;
}

.mono {
  font-family: $font-code;
  font-size: 12px;
}

.models-row {
  margin-top: 4px;
}

.models-count {
  color: $text-muted;
  font-size: 12px;
}

.models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 6px;
  height: 100px;
  overflow-y: auto;
  align-content: flex-start;
}

.model-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  font-size: 10px;
  font-family: $font-code;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $text-secondary;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;

  &.disabled {
    background: rgba(var(--warning-rgb), 0.1);
    color: $text-muted;
  }

  &.unavailable {
    background: rgba(var(--error-rgb), 0.08);
    color: $text-muted;
  }

  &-more {
    background: rgba(var(--accent-primary-rgb), 0.15);
    color: $accent-primary;
    font-weight: 500;
  }
}

.model-tag__name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-tag__badge {
  flex-shrink: 0;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: $accent-primary;
  font-family: $font-ui;
  font-size: 9px;

  &.danger {
    background: rgba(var(--error-rgb), 0.12);
    color: $error;
  }
}

.channel-switch,
.model-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: $text-muted;
  cursor: pointer;

  &:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  &.active {
    color: $success;

    .channel-switch__track,
    .model-switch__track {
      background: $success;
      border-color: $success;
    }

    .channel-switch__knob,
    .model-switch__knob {
      transform: translateX(10px);
      background: #fff;
    }
  }
}

.channel-switch {
  padding: 4px 8px;
  border: 1px solid $border-color;
  border-radius: 999px;
  background: $bg-secondary;
}

.channel-switch__track,
.model-switch__track {
  position: relative;
  width: 22px;
  height: 12px;
  border: 1px solid $border-color;
  border-radius: 999px;
  background: rgba(var(--text-muted-rgb), 0.22);
  transition: background $transition-fast, border-color $transition-fast;
}

.channel-switch__knob,
.model-switch__knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $text-muted;
  transition: transform $transition-fast, background $transition-fast;
}

.channel-switch__text,
.model-switch__text {
  font-family: $font-ui;
  font-size: 10px;
  line-height: 1;
}

.channel-switch__text {
  font-size: 11px;
}

.card-actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid $border-light;
  padding-top: 10px;
}
</style>
