<script setup lang="ts">
import { NButton, NInput, NInputNumber, NModal, NSelect } from 'naive-ui'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'

defineProps<{
  show: boolean
  title: string
  selectedProfile: string | null
  selectedModelProvider: string | null
  agentName: string
  agentDescription: string
  agentAvatar: string
  agentSystemPrompt: string
  agentModel: string
  agentTemperature: number | null
  profileOptions: Array<{ label: string; value: string }>
  modelProviderOptions: Array<{ label: string; value: string }>
  selectedModelOptions: Array<{ label: string; value: string; disabled?: boolean }>
  saving: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:selectedProfile': [value: string | null]
  'update:selectedModelProvider': [value: string | null]
  'update:agentName': [value: string]
  'update:agentDescription': [value: string]
  'update:agentAvatar': [value: string]
  'update:agentSystemPrompt': [value: string]
  'update:agentModel': [value: string]
  'update:agentTemperature': [value: number | null]
  submit: []
}>()

const { t } = useWorkbenchI18n()
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="title"
    style="width: min(720px, calc(100vw - 32px));"
    @update:show="emit('update:show', $event)"
  >
    <div class="agent-form">
      <div class="agent-form__grid">
        <div class="agent-form__field">
          <label class="agent-form__label">{{ t('workbench.agents.roleProfile') }}</label>
          <NSelect
            :value="selectedProfile"
            :options="profileOptions"
            filterable
            :placeholder="t('workbench.agents.roleProfilePlaceholder')"
            @update:value="emit('update:selectedProfile', $event)"
          />
        </div>
        <div class="agent-form__field">
          <label class="agent-form__label">{{ t('workbench.agents.modelRoutingSource') }}</label>
          <NSelect
            :value="selectedModelProvider"
            :options="modelProviderOptions"
            clearable
            filterable
            :placeholder="t('workbench.agents.modelRoutingSourcePlaceholder')"
            @update:value="emit('update:selectedModelProvider', $event)"
          />
        </div>
      </div>

      <div class="agent-form__grid">
        <div class="agent-form__field">
          <label class="agent-form__label">{{ t('workbench.agents.roleName') }}</label>
          <NInput :value="agentName" :placeholder="t('workbench.agents.roleNamePlaceholder')" @update:value="emit('update:agentName', $event)" />
        </div>
        <div class="agent-form__field">
          <label class="agent-form__label">{{ t('workbench.agents.model') }}</label>
          <NSelect
            :value="agentModel"
            :options="selectedModelOptions"
            clearable
            filterable
            :disabled="!selectedModelProvider"
            :placeholder="t('workbench.agents.modelPlaceholder')"
            @update:value="emit('update:agentModel', $event)"
          />
        </div>
      </div>

      <div class="agent-form__grid">
        <div class="agent-form__field">
          <label class="agent-form__label">{{ t('workbench.agents.roleBrief') }}</label>
          <NInput
            :value="agentDescription"
            type="textarea"
            :placeholder="t('workbench.agents.roleBriefPlaceholder')"
            @update:value="emit('update:agentDescription', $event)"
          />
        </div>
        <div class="agent-form__field">
          <label class="agent-form__label">{{ t('workbench.agents.avatar') }}</label>
          <NInput :value="agentAvatar" :placeholder="t('workbench.agents.avatarPlaceholder')" @update:value="emit('update:agentAvatar', $event)" />
        </div>
      </div>

      <div class="agent-form__grid">
        <div class="agent-form__field">
          <label class="agent-form__label">{{ t('workbench.agents.rolePrompt') }}</label>
          <NInput
            :value="agentSystemPrompt"
            type="textarea"
            :placeholder="t('workbench.agents.rolePromptPlaceholder')"
            @update:value="emit('update:agentSystemPrompt', $event)"
          />
        </div>
        <div class="agent-form__field">
          <label class="agent-form__label">{{ t('workbench.agents.temperature') }}</label>
          <NInputNumber
            :value="agentTemperature"
            :min="0"
            :max="2"
            :step="0.1"
            style="width: 100%;"
            @update:value="emit('update:agentTemperature', $event)"
          />
        </div>
      </div>

      <div class="agent-form__actions">
        <NButton @click="emit('update:show', false)">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" :disabled="!selectedProfile" :loading="saving" @click="emit('submit')">{{ t('workbench.agents.saveRole') }}</NButton>
      </div>
    </div>
  </NModal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.agent-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agent-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.agent-form__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-form__label {
  font-size: 12px;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}

.agent-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .agent-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
