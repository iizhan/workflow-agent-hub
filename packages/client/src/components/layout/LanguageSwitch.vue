<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect } from 'naive-ui'
import type { SupportedLocale } from '@/i18n/config'
import { persistLocale } from '@/i18n/config'

const props = withDefaults(defineProps<{
  size?: 'tiny' | 'small' | 'medium' | 'large'
}>(), {
  size: 'small',
})

const { locale, t } = useI18n()

const options = computed(() => [
  { label: t('language.zh'), value: 'zh' },
  { label: t('language.en'), value: 'en' },
])

function handleChange(val: SupportedLocale) {
  locale.value = val
  persistLocale(val)
  document.documentElement.lang = val
}
</script>

<template>
  <NSelect
    :value="locale"
    :options="options"
    :size="props.size"
    :consistent-menu-width="false"
    class="language-switch"
    @update:value="handleChange"
  />
</template>

<style scoped lang="scss">
.language-switch {
  min-width: 104px;
}
</style>
