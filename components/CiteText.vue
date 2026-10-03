<script setup lang="ts">
import { computed } from 'vue'
import { parseCitations } from '~/stores/script'

const props = defineProps<{ text: string }>()

interface Part { type: 'text' | 'cite'; value: string; number?: string }

const parts = computed<Part[]>(() => {
  const refs = parseCitations(props.text)
  const result: Part[] = []
  let cursor = 0
  for (const ref of refs) {
    if (ref.index > cursor) result.push({ type: 'text', value: props.text.slice(cursor, ref.index) })
    result.push({ type: 'cite', value: ref.raw, number: ref.number })
    cursor = ref.index + ref.raw.length
  }
  if (cursor < props.text.length) result.push({ type: 'text', value: props.text.slice(cursor) })
  return result
})
</script>

<template>
  <span>
    <template v-for="(part, index) in parts" :key="index">
      <sup v-if="part.type === 'cite'" class="cite-badge" :title="`资料编号 ${part.number}`">[{{ part.number }}]</sup>
      <template v-else>{{ part.value }}</template>
    </template>
  </span>
</template>

<style scoped>
.cite-badge {
  color: #8a3b2e;
  font-weight: 700;
  cursor: help;
  margin: 0 1px;
}
</style>
