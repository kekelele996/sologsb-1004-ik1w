<script setup lang="ts">
import type { DeviceKind, DiffLine, LanguageDraft, ReconcileReport, ScriptStatus, Segment, SourceRef } from '~/types'
import { LANGUAGES, useScriptStore } from '~/stores/script'

const store = useScriptStore()
const activeTab = ref('editor')
const device = ref<DeviceKind>('desktop')
const versionDialog = ref(false)
const versionName = ref('')
const leftFilter = ref('')
const compareA = ref('')
const compareB = ref('')
const helpDialog = ref(false)
const deleteTarget = ref<string | null>(null)

// 引用编辑
const draftRefCode = ref('')
const draftLegacyName = ref('')
const segmentRefPicker = ref<Record<string, string>>({})
const segmentLegacyPicker = ref<Record<string, string>>({})
// 目录导入
const importDialog = ref(false)
const importText = ref('')
const importVersion = ref('')
const importLabel = ref('')
const importError = ref('')
// 对账
const confirmReconcile = ref(false)
const lastReport = ref<ReconcileReport | null>(null)

const statusOptions: Array<{ value: ScriptStatus; label: string; color: string }> = [
  { value: 'draft', label: '草稿', color: 'grey' },
  { value: 'review', label: '待审', color: 'warning' },
  { value: 'returned', label: '退回', color: 'error' },
  { value: 'approved', label: '已定稿', color: 'success' }
]
const deviceOptions: Array<{ value: DeviceKind; label: string }> = [
  { value: 'desktop', label: '桌面大屏' },
  { value: 'tablet', label: '平板导览' },
  { value: 'mobile', label: '手机导览' },
  { value: 'kiosk', label: '馆内触摸屏' }
]
const actionLabels: Record<string, string> = {
  'marked-review': '标待复核',
  renamed: '按新版改名',
  'kept-frozen': '定稿保留原文',
  'kept-locked': '锁定保留原文',
  legacy: '旧来源（按名称）'
}

const draft = computed(() => store.selectedDraft)
const exhibit = computed(() => store.selectedExhibit)
const currentLanguage = computed(() => LANGUAGES.find(item => item.id === store.selectedLanguageId))
const currentStatus = computed(() => statusOptions.find(item => item.value === draft.value?.status) || statusOptions[0])
const isFrozen = computed(() => draft.value?.status === 'approved' || draft.value?.status === 'review')
const filteredExhibits = computed(() => store.hallExhibits.filter(item => !leftFilter.value || `${item.code} ${item.title}`.toLowerCase().includes(leftFilter.value.toLowerCase())))
const versions = computed(() => store.versions.filter(item => item.exhibitId === store.selectedExhibitId && item.languageId === store.selectedLanguageId))
const selectedVersionA = computed(() => versions.value.find(item => item.id === compareA.value))
const selectedVersionB = computed(() => versions.value.find(item => item.id === compareB.value))
const catalogEntries = computed(() => store.currentCatalog?.entries || [])
const reviewCount = computed(() => (store.reviewCountByLanguage[store.selectedLanguageId] || 0))
const availableCodes = computed(() => catalogEntries.value
  .filter(entry => !draft.value?.sourceRefs.some(ref => ref.code === entry.code))
  .map(entry => ({ code: entry.code, name: entry.names[store.selectedLanguageId] || entry.names.zh, withdrawn: entry.status === 'withdrawn' })))

function segmentCodeOptions(segment: Segment) {
  return catalogEntries.value
    .filter(entry => !segment.sources.some(ref => ref.code === entry.code))
    .map(entry => ({ code: entry.code, name: entry.names[store.selectedLanguageId] || entry.names.zh, withdrawn: entry.status === 'withdrawn' }))
}

const diffLines = computed<DiffLine[]>(() => {
  const before = selectedVersionA.value?.draft.narration || ''
  const after = selectedVersionB.value?.draft.narration || ''
  return buildDiff(before, after)
})

onMounted(() => {
  store.hydrate()
  syncCompareSelection()
  window.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
watch(versions, syncCompareSelection)

function syncCompareSelection() {
  if (!versions.value.some(item => item.id === compareA.value)) compareA.value = versions.value[1]?.id || versions.value[0]?.id || ''
  if (!versions.value.some(item => item.id === compareB.value)) compareB.value = versions.value[0]?.id || ''
}
function handleKeydown(event: KeyboardEvent) {
  const modifier = event.metaKey || event.ctrlKey
  if (!modifier) return
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault()
    event.shiftKey ? store.redo() : store.undo()
  }
  if (event.key.toLowerCase() === 'y') {
    event.preventDefault()
    store.redo()
  }
  if (event.key.toLowerCase() === 's') {
    event.preventDefault()
    store.createVersion('键盘快捷保存')
  }
}
function saveDraftField(field: 'title' | 'narration' | 'accessibility' | 'durationMinutes', event: Event) {
  const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value
  store.updateDraft({ [field]: field === 'durationMinutes' ? Number(value) : value } as Partial<LanguageDraft>)
}
function saveSegment(id: string, field: 'label' | 'content', event: Event) {
  store.updateSegment(id, { [field]: (event.target as HTMLInputElement | HTMLTextAreaElement).value })
}
function submitVersion() {
  store.createVersion(versionName.value.trim() || undefined)
  versionName.value = ''
  versionDialog.value = false
}
function confirmDelete() {
  if (deleteTarget.value) store.removeSegment(deleteTarget.value)
  deleteTarget.value = null
}
function buildDiff(before: string, after: string): DiffLine[] {
  const a = before.split(/(?<=[。！？.!?])\s*/).filter(Boolean)
  const b = after.split(/(?<=[。！？.!?])\s*/).filter(Boolean)
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1])
  }
  const result: DiffLine[] = []
  let i = 0, j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { result.push({ type: 'same', text: a[i] }); i++; j++ }
    else if (rows[i + 1][j] >= rows[i][j + 1]) { result.push({ type: 'remove', text: a[i] }); i++ }
    else { result.push({ type: 'add', text: b[j] }); j++ }
  }
  while (i < a.length) result.push({ type: 'remove', text: a[i++] })
  while (j < b.length) result.push({ type: 'add', text: b[j++] })
  return result
}
function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}
function segmentLabel(segment: Segment) { return segment.label || '未命名段落' }
function refName(ref: SourceRef) { return draft.value ? store.refDisplayName(ref, draft.value.languageId) : ref.nameSnapshot }
function entryStatus(code?: string) {
  if (!code) return 'legacy'
  const entry = store.resolveEntry(code)
  if (!entry) return 'missing'
  return entry.status
}
function addDraftRef() {
  if (draftRefCode.value) { store.addDraftRef(draftRefCode.value); draftRefCode.value = '' }
}
function addDraftLegacy() {
  if (draftLegacyName.value.trim()) { store.addLegacyDraftRef(draftLegacyName.value); draftLegacyName.value = '' }
}
function addSegmentRef(segmentId: string) {
  const code = segmentRefPicker.value[segmentId]
  if (code) { store.addSegmentRef(segmentId, code); segmentRefPicker.value[segmentId] = '' }
}
function addSegmentLegacy(segmentId: string) {
  const name = segmentLegacyPicker.value[segmentId]
  if (name?.trim()) { store.addLegacySegmentRef(segmentId, name); segmentLegacyPicker.value[segmentId] = '' }
}

// ---------- 目录导入（TSV：编号  状态  中文名  英文名  日文名  备注） ----------
const SAMPLE_IMPORT = ['SRC-0001\tvalid\t《中国玉器全集（2026 校订本）》第一卷\tComplete Collection of Chinese Jades (2026), Vol. 1\t『中国玉器全集（2026校訂本）』第一巻\t年度校订',
  'SRC-0007\tvalid\t馆藏金属器保护手册（第四版）\tConservation Manual for Metal Artefacts (4th ed.)\t金属器物保存ハンドブック（第4版）\t'].join('\n')

function openImport() {
  importVersion.value = `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}-new`
  importLabel.value = ''
  importText.value = SAMPLE_IMPORT
  importError.value = ''
  importDialog.value = true
}
function parseCatalog() {
  importError.value = ''
  const lines = importText.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (!lines.length) { importError.value = '内容为空。'; return }
  const entries = lines.map((line, index) => {
    const cols = line.split('\t').map(cell => cell.trim())
    if (cols.length < 5) throw new Error(`第 ${index + 1} 行不足 5 列（编号 / 状态 / 中 / 英 / 日）。`)
    const [code, status, zh, en, ja, note] = cols
    if (status !== 'valid' && status !== 'withdrawn') throw new Error(`第 ${index + 1} 行状态必须是 valid 或 withdrawn。`)
    return { code, status: status as 'valid' | 'withdrawn', names: { zh, en, ja }, ...(note ? { note } : {}) }
  })
  const result = store.importCatalog({ version: importVersion.value, label: importLabel.value, entries })
  if (!result.ok) { importError.value = result.error || '导入失败。'; return }
  importDialog.value = false
}
function runReconcile() {
  const report = store.reconcile()
  lastReport.value = report
  confirmReconcile.value = false
  activeTab.value = 'catalog'
}
function reportItems(report: ReconcileReport, languageId?: string) {
  return report.items.filter(item => !languageId || item.languageId === languageId)
}
</script>

<template>
  <v-app class="workspace-shell">
    <a class="skip-link" href="#main-workspace">跳到主要内容</a>
    <v-app-bar color="surface" flat border>
      <template #prepend><v-app-bar-nav-icon aria-label="打开项目导航" /></template>
      <v-app-bar-title>
        <span class="project-mark">博物声</span>
        <span class="text-caption text-medium-emphasis ms-3 d-none d-md-inline">展陈脚本工作台</span>
      </v-app-bar-title>
      <v-spacer />
      <v-chip v-if="reviewCount" class="me-2" color="warning" variant="tonal" size="small" prepend-icon="mdi-alert-circle-outline">
        {{ currentLanguage?.shortLabel }} {{ reviewCount }} 条引用待复核
      </v-chip>
      <v-chip class="me-2 d-none d-sm-flex" :color="currentStatus.color" variant="tonal" size="small">
        <span class="status-dot" :style="{ background: 'currentColor' }" />{{ currentStatus.label }}
      </v-chip>
      <v-btn variant="text" prepend-icon="mdi-keyboard-outline" class="d-none d-md-flex" @click="helpDialog = true">快捷键</v-btn>
      <v-btn color="primary" prepend-icon="mdi-content-save-outline" @click="versionDialog = true">保存版本</v-btn>
    </v-app-bar>

    <v-navigation-drawer permanent width="320" color="surface" border>
      <div class="pa-4">
        <div class="section-title mb-2">展厅</div>
        <v-select
          :model-value="store.selectedHallId"
          :items="store.halls"
          item-title="name"
          item-value="id"
          hide-details
          aria-label="选择展厅"
          @update:model-value="store.selectHall"
        />
        <div class="d-flex align-center justify-space-between mt-5 mb-2">
          <div class="section-title">展项</div>
          <v-chip size="x-small" variant="tonal">{{ filteredExhibits.length }} 项</v-chip>
        </div>
        <v-text-field v-model="leftFilter" density="compact" hide-details prepend-inner-icon="mdi-magnify" placeholder="筛选展项" aria-label="筛选展项" />
        <v-list class="mt-2 bg-transparent" nav>
          <v-list-item
            v-for="item in filteredExhibits"
            :key="item.id"
            :active="item.id === store.selectedExhibitId"
            color="primary"
            rounded="lg"
            @click="store.selectExhibit(item.id)"
          >
            <template #prepend><v-chip size="small" variant="outlined">{{ item.code }}</v-chip></template>
            <v-list-item-title class="font-weight-medium">{{ item.title }}</v-list-item-title>
            <v-list-item-subtitle>{{ item.drafts.length }} 种语言</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>
      <v-divider />
      <div class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="section-title">多语言完成度</div>
          <v-chip size="x-small" variant="tonal" color="warning">{{ Object.values(store.reviewCountByLanguage).reduce((a, b) => a + b, 0) }} 待复核</v-chip>
        </div>
        <div v-for="lang in LANGUAGES" :key="lang.id" class="mb-3">
          <button class="d-flex align-center w-100 border-0 bg-transparent text-left pa-0" :aria-pressed="lang.id === store.selectedLanguageId" @click="store.selectLanguage(lang.id)">
            <v-avatar size="32" :color="lang.id === store.selectedLanguageId ? 'primary' : 'grey-lighten-2'" :class="lang.id === store.selectedLanguageId ? 'text-white' : ''">{{ lang.shortLabel }}</v-avatar>
            <div class="ms-3 flex-grow-1">
              <div class="text-body-2 font-weight-medium d-flex align-center ga-1">
                {{ lang.label }}
                <v-icon v-if="store.reviewCountByLanguage[lang.id]" color="warning" size="small">mdi-alert-circle</v-icon>
              </div>
              <v-progress-linear class="mt-1" :model-value="exhibit ? store.completionFor(exhibit, lang.id) : 0" :color="lang.id === store.selectedLanguageId ? 'primary' : 'secondary'" height="5" rounded />
            </div>
            <span class="text-caption ms-3">{{ exhibit ? store.completionFor(exhibit, lang.id) : 0 }}%</span>
          </button>
        </div>
      </div>
    </v-navigation-drawer>

    <v-main id="main-workspace" style="background:#f4f0e8">
      <div class="pa-3 pa-md-6">
        <div class="d-flex flex-wrap align-start justify-space-between ga-4 mb-5">
          <div>
            <div class="text-caption text-medium-emphasis mb-1">{{ store.selectedHall?.name }} / {{ exhibit?.code }}</div>
            <h1 class="text-h4 font-weight-bold project-mark">{{ exhibit?.title || '请选择展项' }}</h1>
            <div class="text-body-2 text-medium-emphasis mt-2">
              当前语言：{{ currentLanguage?.label }} ·
              {{ draft?.updatedAt ? `最后更新 ${formatTime(draft.updatedAt)}` : '尚未建立文稿' }}
            </div>
          </div>
          <div class="d-flex ga-2">
            <v-btn variant="outlined" prepend-icon="mdi-undo" :disabled="!store.canUndo" @click="store.undo">撤销</v-btn>
            <v-btn variant="outlined" prepend-icon="mdi-redo" :disabled="!store.canRedo" @click="store.redo">重做</v-btn>
            <v-btn variant="outlined" prepend-icon="mdi-history" @click="activeTab = 'versions'">版本</v-btn>
          </div>
        </div>

        <v-alert v-if="store.notice" class="mb-4" color="secondary" variant="tonal" closable @click:close="store.notice = ''">{{ store.notice }}</v-alert>

        <v-tabs v-model="activeTab" color="primary" bg-color="surface" rounded="lg" class="mb-4 px-2">
          <v-tab value="editor">脚本编辑</v-tab>
          <v-tab value="versions">版本比较</v-tab>
          <v-tab value="preview">设备预览</v-tab>
          <v-tab value="sources">引用与锁定</v-tab>
          <v-tab value="catalog">资料目录对账</v-tab>
        </v-tabs>

        <div v-if="draft">
          <v-window v-model="activeTab" :touch="false">
            <v-window-item value="editor">
              <v-row>
                <v-col cols="12" lg="8">
                  <v-card class="script-card pa-4 pa-md-6">
                    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-5">
                      <div>
                        <div class="section-title">当前文稿</div>
                        <div class="text-h6 font-weight-bold mt-1">{{ currentLanguage?.label }}</div>
                      </div>
                      <div class="d-flex flex-wrap ga-2">
                        <v-select
                          :model-value="draft.status"
                          :items="statusOptions"
                          item-title="label"
                          item-value="value"
                          label="审校状态"
                          hide-details
                          style="min-width:150px"
                          @update:model-value="store.setStatus"
                        />
                        <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" :disabled="isFrozen" @click="store.addSegment">新增段落</v-btn>
                      </div>
                    </div>

                    <v-alert v-if="draft.status === 'approved'" type="success" variant="tonal" density="compact" class="mb-4">
                      已定稿文稿受保护：内容不会因目录升版被自动改写，仅会把失去资料的引用标记为待复核。
                    </v-alert>
                    <v-alert v-else-if="draft.status === 'review'" type="warning" variant="tonal" density="compact" class="mb-4">
                      待审稿同样不自动改名；如需按新目录重算名称，请先退回为草稿。
                    </v-alert>

                    <v-text-field label="展项标题" :model-value="draft.title" :readonly="isFrozen" hint="面向观众的主标题" persistent-hint @change="saveDraftField('title', $event)" />
                    <v-row class="mt-2">
                      <v-col cols="12" md="5">
                        <v-text-field label="预计朗读时长（分钟）" type="number" min="0" step="0.5" :model-value="draft.durationMinutes" :readonly="isFrozen" @change="saveDraftField('durationMinutes', $event)" />
                      </v-col>
                      <v-col cols="12" md="7">
                        <div class="section-title mb-2">文稿资料引用（按编号）</div>
                        <div class="ref-box pa-2 rounded">
                          <v-chip v-for="ref in draft.sourceRefs" :key="ref.id" size="small" class="ma-1" :color="ref.needsReview && !ref.reviewed ? 'warning' : (entryStatus(ref.code) === 'withdrawn' ? 'warning' : (ref.code ? 'secondary' : 'grey'))" variant="tonal" :closable="!isFrozen" @click:close="store.removeDraftRef(ref.id)">
                            <v-icon start size="small">{{ ref.code ? 'mdi-tag-outline' : 'mdi-book-open-page-variant-outline' }}</v-icon>
                            <span class="font-weight-medium me-1">{{ ref.code || '旧' }}</span>{{ refName(ref) }}
                            <v-icon v-if="ref.needsReview && !ref.reviewed" end size="small" color="warning">mdi-alert-circle</v-icon>
                          </v-chip>
                          <div v-if="!draft.sourceRefs.length" class="text-caption text-medium-emphasis pa-2">尚无引用，可从当前目录按编号添加，或登记旧来源名称。</div>
                          <v-alert v-for="ref in draft.sourceRefs.filter(item => item.needsReview && !item.reviewed)" :key="`warn-${ref.id}`" type="warning" density="compact" variant="text" class="mt-1" :title="`${ref.code || ref.legacyName}：${ref.reviewReason || '待复核'}`">
                            <v-btn size="x-small" variant="tonal" @click="store.resolveRef(ref.id)">人工复核确认</v-btn>
                          </v-alert>
                          <div v-if="!isFrozen" class="d-flex flex-wrap align-center ga-2 pa-1">
                            <v-select v-model="draftRefCode" :items="availableCodes" item-title="name" item-value="code" density="compact" hide-details placeholder="按编号添加当前目录来源" style="min-width:260px;max-width:360px" aria-label="按编号添加资料来源" @update:model-value="addDraftRef">
                              <template #selection="{ item }">
                                <span class="font-weight-medium me-1">{{ item.raw.code }}</span>{{ item.raw.name }}
                              </template>
                              <template #item="{ props, item: selectItem }">
                                <v-list-item v-bind="props">
                                  <template #prepend><v-chip size="x-small" variant="outlined" :color="selectItem.raw.withdrawn ? 'warning' : undefined">{{ selectItem.raw.code }}</v-chip></template>
                                  <v-list-item-title>{{ selectItem.raw.name }}</v-list-item-title>
                                  <v-list-item-subtitle v-if="selectItem.raw.withdrawn">已撤销 · 引用后将标记待复核</v-list-item-subtitle>
                                </v-list-item>
                              </template>
                            </v-select>
                            <v-text-field v-model="draftLegacyName" density="compact" hide-details placeholder="旧稿无编号来源名称" style="max-width:220px" aria-label="旧稿无编号来源名称" @keyup.enter="addDraftLegacy" />
                            <v-btn size="small" variant="text" prepend-icon="mdi-book-plus-outline" @click="addDraftLegacy">登记旧来源</v-btn>
                          </div>
                        </div>
                      </v-col>
                    </v-row>

                    <div class="section-title mt-6 mb-2">完整讲解词</div>
                    <v-textarea label="讲解词" rows="7" auto-grow counter :model-value="draft.narration" :readonly="isFrozen" @change="saveDraftField('narration', $event)" />

                    <div class="section-title mt-6 mb-2">无障碍描述</div>
                    <v-textarea label="无障碍描述" rows="4" auto-grow hint="描述尺寸、材质、色彩与可触摸特征，避免只依赖视觉" persistent-hint :model-value="draft.accessibility" :readonly="isFrozen" @change="saveDraftField('accessibility', $event)" />
                  </v-card>

                  <v-card class="script-card pa-4 pa-md-6 mt-5">
                    <div class="d-flex align-center justify-space-between mb-4">
                      <div>
                        <div class="section-title">分段校对</div>
                        <div class="text-body-2 text-medium-emphasis mt-1">锁定段落不能编辑，目录升版对账时留住引用原文。</div>
                      </div>
                      <v-chip variant="tonal">{{ draft.segments.filter(item => item.locked).length }}/{{ draft.segments.length }} 已锁定</v-chip>
                    </div>
                    <div class="d-flex flex-column ga-3">
                      <div v-for="(segment, index) in draft.segments" :key="segment.id" class="segment-row" :class="{ locked: segment.locked }">
                        <div class="d-flex align-center ga-2">
                          <v-btn icon size="small" variant="text" :aria-label="segment.locked ? '解锁段落' : '锁定段落'" @click="store.toggleLock(segment.id)">
                            {{ segment.locked ? '🔒' : '🔓' }}
                          </v-btn>
                          <v-text-field :model-value="segment.label" density="compact" hide-details variant="plain" :readonly="segment.locked || isFrozen" :aria-label="`第 ${index + 1} 段标题`" @change="saveSegment(segment.id, 'label', $event)" />
                          <v-chip v-if="segment.locked" color="success" size="small" variant="tonal">已确认</v-chip>
                          <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" :disabled="segment.locked || isFrozen" :aria-label="`删除第 ${index + 1} 段`" @click="deleteTarget = segment.id" />
                        </div>
                        <v-textarea class="mt-2" :model-value="segment.content" rows="2" auto-grow hide-details :readonly="segment.locked || isFrozen" :aria-label="segmentLabel(segment)" @change="saveSegment(segment.id, 'content', $event)" />
                        <div class="d-flex flex-wrap align-center ga-1 mt-1 px-1">
                          <v-chip v-for="ref in segment.sources" :key="ref.id" x-small size="x-small" class="ma-05" :color="ref.needsReview && !ref.reviewed ? 'warning' : (ref.code ? 'secondary' : 'grey')" variant="tonal" :closable="!segment.locked && !isFrozen" @click:close="store.removeSegmentRef(segment.id, ref.id)">
                            <span class="font-weight-medium me-1">{{ ref.code || '旧' }}</span>{{ refName(ref) }}
                          </v-chip>
                          <v-tooltip v-if="segment.locked" text="锁定段落的引用在对账时保留原文快照">
                            <template #activator="{ props }"><v-icon v-bind="props" size="small" color="success" class="ms-1">mdi-lock-outline</v-icon></template>
                            锁定保留
                          </v-tooltip>
                          <div v-if="!segment.locked && !isFrozen" class="d-flex align-center ga-2 ms-2 flex-grow-1">
                            <v-select :model-value="segmentRefPicker[segment.id] || ''" :items="segmentCodeOptions(segment)" item-title="name" item-value="code" density="compact" hide-details placeholder="段落引用编号" style="max-width:260px" :aria-label="`段落 ${segment.label} 添加编号引用`" @update:model-value="() => addSegmentRef(segment.id)">
                              <template #item="{ props, item: selectItem }">
                                <v-list-item v-bind="props">
                                  <template #prepend><v-chip size="x-small" variant="outlined" :color="selectItem.raw.withdrawn ? 'warning' : undefined">{{ selectItem.raw.code }}</v-chip></template>
                                  <v-list-item-title>{{ selectItem.raw.name }}</v-list-item-title>
                                </v-list-item>
                              </template>
                            </v-select>
                            <v-text-field :model-value="segmentLegacyPicker[segment.id] || ''" density="compact" hide-details placeholder="旧来源名称" style="max-width:180px" :aria-label="`段落 ${segment.label} 添加旧来源`" @update:model-value="(value: string) => segmentLegacyPicker[segment.id] = value" @keyup.enter="() => addSegmentLegacy(segment.id)" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </v-card>
                </v-col>

                <v-col cols="12" lg="4">
                  <v-card class="script-card pa-5">
                    <div class="section-title mb-4">同展项语言进度</div>
                    <div v-for="lang in LANGUAGES" :key="lang.id" class="d-flex align-center ga-3 mb-4">
                      <v-progress-circular :model-value="exhibit ? store.completionFor(exhibit, lang.id) : 0" size="52" width="5" :color="lang.id === store.selectedLanguageId ? 'primary' : 'secondary'">
                        {{ exhibit ? store.completionFor(exhibit, lang.id) : 0 }}
                      </v-progress-circular>
                      <div class="flex-grow-1">
                        <div class="font-weight-medium d-flex align-center ga-1">
                          {{ lang.label }}
                          <v-icon v-if="store.reviewCountByLanguage[lang.id]" color="warning" size="small">mdi-alert-circle</v-icon>
                        </div>
                        <div class="text-caption text-medium-emphasis">
                          {{ exhibit?.drafts.find(item => item.languageId === lang.id) ? store.statusLabel(exhibit!.drafts.find(item => item.languageId === lang.id)!.status) : '尚未创建' }}
                        </div>
                      </div>
                      <v-btn size="small" variant="text" :disabled="lang.id === store.selectedLanguageId" @click="store.selectLanguage(lang.id)">切换</v-btn>
                    </div>
                  </v-card>
                  <v-card class="script-card pa-5 mt-5">
                    <div class="section-title mb-3">审校检查</div>
                    <v-list density="compact" class="bg-transparent">
                      <v-list-item :prepend-icon="draft.narration.length > 80 ? 'mdi-check-circle' : 'mdi-alert-circle'" :title="`讲解词 ${draft.narration.length} 字`" />
                      <v-list-item :prepend-icon="draft.accessibility.length > 30 ? 'mdi-check-circle' : 'mdi-alert-circle'" :title="`无障碍描述 ${draft.accessibility.length} 字`" />
                      <v-list-item :prepend-icon="draft.sourceRefs.length ? 'mdi-check-circle' : 'mdi-alert-circle'" :title="draft.sourceRefs.length ? `资料引用 ${draft.sourceRefs.length} 条` : '缺少资料引用'" />
                      <v-list-item v-if="reviewCount" prepend-icon="mdi-alert-circle" :title="`${currentLanguage?.label} ${reviewCount} 条引用待复核`" />
                    </v-list>
                    <v-alert class="mt-3" type="info" variant="tonal" density="compact">
                      估算语速约 {{ Math.max(1, Math.round(draft.narration.length / 220 * 10) / 10) }} 分钟，请与目标时长核对。
                    </v-alert>
                  </v-card>
                </v-col>
              </v-row>
            </v-window-item>

            <v-window-item value="versions">
              <v-card class="script-card pa-4 pa-md-6">
                <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-5">
                  <div>
                    <div class="section-title">版本比较</div>
                    <div class="text-h6 font-weight-bold mt-1">选择同一展项、同一语言的两个快照</div>
                  </div>
                  <v-btn color="primary" prepend-icon="mdi-content-save-plus-outline" @click="versionDialog = true">保存当前版本</v-btn>
                </div>
                <v-alert v-if="versions.length < 2" type="info" variant="tonal">至少保存两个版本后即可比较。当前有 {{ versions.length }} 个版本。</v-alert>
                <template v-else>
                  <v-row>
                    <v-col cols="12" md="6"><v-select v-model="compareA" :items="versions" item-title="name" item-value="id" label="基准版本" /></v-col>
                    <v-col cols="12" md="6"><v-select v-model="compareB" :items="versions" item-title="name" item-value="id" label="目标版本" /></v-col>
                  </v-row>
                  <div class="d-flex ga-4 text-caption text-medium-emphasis mb-2">
                    <span><span class="status-dot" style="background:#9b2c25" /> 删除</span>
                    <span><span class="status-dot" style="background:#2f6b45" /> 新增</span>
                  </div>
                  <div class="rounded-lg border pa-3 bg-white">
                    <p v-for="(line, index) in diffLines" :key="index" class="diff-line" :class="`diff-${line.type}`">{{ line.text }}</p>
                    <div v-if="!diffLines.length" class="text-medium-emphasis pa-4">所选版本内容一致。</div>
                  </div>
                  <v-list class="mt-4 bg-transparent">
                    <v-list-item v-for="version in versions" :key="version.id" :title="version.name" :subtitle="formatTime(version.createdAt)">
                      <template #append><v-btn variant="outlined" size="small" @click="store.restoreVersion(version.id)">恢复此版</v-btn></template>
                    </v-list-item>
                  </v-list>
                </template>
              </v-card>
            </v-window-item>

            <v-window-item value="preview">
              <v-card class="script-card pa-4 pa-md-6">
                <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-5">
                  <div>
                    <div class="section-title">设备排版预览</div>
                    <div class="text-h6 font-weight-bold mt-1">以展项实际阅读顺序预览</div>
                  </div>
                  <v-btn-toggle v-model="device" mandatory variant="outlined" divided>
                    <v-btn v-for="item in deviceOptions" :key="item.value" :value="item.value">{{ item.label }}</v-btn>
                  </v-btn-toggle>
                </div>
                <div class="preview-frame" :class="device">
                  <div class="preview-content">
                    <div class="text-overline text-medium-emphasis">{{ exhibit?.code }} · {{ currentLanguage?.label }}</div>
                    <h2 class="text-h4 font-weight-bold mt-2">{{ draft.title }}</h2>
                    <p class="text-body-1 mt-6" style="line-height:1.9;white-space:pre-wrap">{{ draft.narration }}</p>
                    <v-divider class="my-6" />
                    <div class="section-title">无障碍描述</div>
                    <p class="text-body-2 mt-2" style="line-height:1.8;white-space:pre-wrap">{{ draft.accessibility }}</p>
                    <div v-if="draft.sourceRefs.length" class="mt-7">
                      <div class="text-overline text-medium-emphasis mb-1">资料来源</div>
                      <ol class="text-caption ps-4 mb-0">
                        <li v-for="ref in draft.sourceRefs" :key="ref.id" :class="{ 'review-pending': ref.needsReview && !ref.reviewed }">
                          <span v-if="ref.code" class="font-weight-medium me-1">[{{ ref.code }}]</span>{{ refName(ref) }}
                          <span v-if="ref.needsReview && !ref.reviewed" class="text-warning">（待复核）</span>
                        </li>
                      </ol>
                    </div>
                    <div class="mt-7 text-caption text-medium-emphasis">预计讲解 {{ draft.durationMinutes }} 分钟</div>
                  </div>
                </div>
              </v-card>
            </v-window-item>

            <v-window-item value="sources">
              <v-row>
                <v-col cols="12" md="7">
                  <v-card class="script-card pa-5">
                    <div class="section-title mb-3">本稿全部资料引用</div>
                    <v-table density="compact">
                      <thead><tr><th>位置</th><th>编号</th><th>显示名称</th><th>目录状态</th><th></th></tr></thead>
                      <tbody>
                        <tr v-for="ref in [...draft.sourceRefs.map((ref, i) => ({ ref, scope: `文稿 #${i + 1}` })), ...draft.segments.flatMap(segment => segment.sources.map(ref => ({ ref, scope: segment.label })))]" :key="ref.ref.id">
                          <td class="text-caption">{{ ref.scope }}</td>
                          <td><v-chip size="x-small" :variant="ref.ref.code ? 'tonal' : 'outlined'" :color="ref.ref.code ? 'secondary' : 'grey'">{{ ref.ref.code || '无编号' }}</v-chip></td>
                          <td class="text-body-2">{{ refName(ref.ref) }}</td>
                          <td>
                            <v-chip v-if="!ref.ref.code" size="x-small" color="grey" variant="tonal">旧来源</v-chip>
                            <v-chip v-else-if="entryStatus(ref.ref.code) === 'valid'" size="x-small" color="success" variant="tonal">有效</v-chip>
                            <v-chip v-else-if="entryStatus(ref.ref.code) === 'withdrawn'" size="x-small" color="warning" variant="tonal">已撤销</v-chip>
                            <v-chip v-else size="x-small" color="error" variant="tonal">目录缺失</v-chip>
                          </td>
                          <td>
                            <v-btn v-if="ref.ref.needsReview && !ref.ref.reviewed" size="x-small" variant="tonal" color="warning" @click="store.resolveRef(ref.ref.id)">复核确认</v-btn>
                          </td>
                        </tr>
                      </tbody>
                    </v-table>
                    <v-alert class="mt-4" type="warning" variant="tonal">定稿/待审稿的引用名称不会被对账自动改写；失去资料的编号引用会标待复核，由人工确认。</v-alert>
                  </v-card>
                </v-col>
                <v-col cols="12" md="5">
                  <v-card class="script-card pa-5">
                    <div class="section-title mb-3">段落锁定概况</div>
                    <v-timeline density="compact" side="end">
                      <v-timeline-item v-for="segment in draft.segments" :key="segment.id" :dot-color="segment.locked ? 'success' : 'grey'" size="small">
                        <div class="font-weight-medium">{{ segment.label }}</div>
                        <div class="text-caption text-medium-emphasis">{{ segment.locked ? '已锁定，对账时留住原文' : '编辑中，草稿态对账按新版重算' }}</div>
                      </v-timeline-item>
                    </v-timeline>
                  </v-card>
                </v-col>
              </v-row>
            </v-window-item>

            <v-window-item value="catalog">
              <v-row>
                <v-col cols="12" md="4">
                  <v-card class="script-card pa-5">
                    <div class="d-flex align-center justify-space-between mb-3">
                      <div class="section-title">资料来源目录</div>
                      <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-upload" @click="openImport">导入新版</v-btn>
                    </div>
                    <div v-for="catalog in store.sourceCatalogs" :key="catalog.version" class="catalog-block pa-3 mb-3 rounded" :class="{ active: store.currentCatalog?.version === catalog.version }">
                      <div class="d-flex align-center justify-space-between">
                        <v-chip size="small" :color="store.currentCatalog?.version === catalog.version ? 'primary' : 'grey'" variant="tonal">{{ catalog.version }}</v-chip>
                        <span class="text-caption text-medium-emphasis">{{ catalog.entries.length }} 条 · {{ formatTime(catalog.importedAt) }}</span>
                      </div>
                      <div class="text-body-2 font-weight-medium mt-2">{{ catalog.label }}</div>
                      <div v-if="store.currentCatalog?.version === catalog.version" class="text-caption text-medium-emphasis mt-1">当前生效版本，对账以此为准</div>
                    </div>
                    <v-btn color="primary" prepend-icon="mdi-file-sync-outline" block class="mt-2" @click="confirmReconcile = true">
                      按编号对账（中 / 英 / 日）
                    </v-btn>
                    <v-alert type="info" variant="tonal" density="compact" class="mt-3">
                      按语言分别执行：失败仅回滚该语言，其余语言正常生效。
                    </v-alert>
                  </v-card>
                </v-col>

                <v-col cols="12" md="8">
                  <v-card class="script-card pa-5">
                    <div class="section-title mb-3">当前目录条目 · {{ store.currentCatalog?.version }}</div>
                    <v-table density="compact" fixed-header height="340">
                      <thead><tr><th>编号</th><th>中文</th><th>English</th><th>日本語</th><th>状态</th></tr></thead>
                      <tbody>
                        <tr v-for="entry in catalogEntries" :key="entry.code">
                          <td class="font-weight-medium text-caption">{{ entry.code }}</td>
                          <td class="text-body-2">{{ entry.names.zh }}</td>
                          <td class="text-caption">{{ entry.names.en }}</td>
                          <td class="text-caption">{{ entry.names.ja }}</td>
                          <td><v-chip size="x-small" :color="entry.status === 'valid' ? 'success' : 'warning'" variant="tonal">{{ entry.status === 'valid' ? '有效' : '已撤销' }}</v-chip></td>
                        </tr>
                      </tbody>
                    </v-table>
                  </v-card>

                  <v-card v-if="lastReport || store.reconcileReports.length" class="script-card pa-5 mt-5">
                    <template v-if="lastReport">
                      <div class="d-flex align-center justify-space-between mb-3">
                        <div class="section-title">本次对账报告 · {{ lastReport.catalogVersion }}</div>
                        <v-chip :color="lastReport.applied ? 'success' : 'error'" variant="tonal" size="small">{{ lastReport.applied ? '已生效' : '全部失败未生效' }}</v-chip>
                      </div>
                      <v-row dense>
                        <v-col v-for="result in lastReport.perLanguage" :key="result.languageId" cols="12" md="4">
                          <v-card variant="tonal" :color="result.ok ? 'secondary' : 'error'" class="pa-3">
                            <div class="d-flex align-center justify-space-between">
                              <span class="font-weight-medium">{{ LANGUAGES.find(lang => lang.id === result.languageId)?.label }}</span>
                              <v-chip size="x-small" :color="result.ok ? 'success' : 'error'" variant="tonal">{{ result.ok ? '成功' : '已回滚' }}</v-chip>
                            </div>
                            <div class="text-caption mt-2">
                              待复核 {{ result.markedReview }} · 改名 {{ result.renamed }} · 定稿保留 {{ result.keptFrozen }} · 锁定保留 {{ result.keptLocked }} · 旧来源 {{ result.legacy }}
                            </div>
                            <div v-if="result.error" class="text-caption text-error mt-1">{{ result.error }}</div>
                            <v-btn size="x-small" variant="outlined" class="mt-2" :disabled="lastReport.restoredLanguages.includes(result.languageId)" @click="store.restoreReportLanguage(lastReport.id, result.languageId)">
                              {{ lastReport.restoredLanguages.includes(result.languageId) ? '该语言已恢复' : '恢复该语言到对账前' }}
                            </v-btn>
                          </v-card>
                        </v-col>
                      </v-row>
                      <v-expansion-panels class="mt-3">
                        <v-expansion-panel v-for="lang in LANGUAGES" :key="lang.id">
                          <v-expansion-panel-title>{{ lang.label }} 明细（{{ reportItems(lastReport, lang.id).length }}）</v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <v-list density="compact">
                              <v-list-item v-for="(item, i) in reportItems(lastReport, lang.id)" :key="i" :title="`${item.exhibitTitle} · ${item.scopeLabel}`" :subtitle="`${item.code ? item.code + ' · ' : ''}${item.fromName || ''}${item.toName && item.toName !== item.fromName ? ' → ' + item.toName : ''}`">
                                <template #prepend><v-chip size="x-small" :color="item.action === 'marked-review' ? 'warning' : (item.action === 'renamed' ? 'secondary' : 'grey')" variant="tonal">{{ actionLabels[item.action] }}</v-chip></template>
                              </v-list-item>
                              <v-list-item v-if="!reportItems(lastReport, lang.id).length" title="该语言无引用变化" />
                            </v-list>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                      </v-expansion-panels>
                    </template>
                    <v-divider v-if="lastReport" class="my-4" />
                    <div class="section-title mb-2">历史对账</div>
                    <v-list density="compact">
                      <v-list-item v-for="report in store.reconcileReports" :key="report.id" :title="`${report.catalogVersion} · ${formatTime(report.createdAt)}`" :subtitle="`${report.perLanguage.filter(r => r.ok).length}/3 种语言成功${report.restoredLanguages.length ? '；已手动恢复 ' + report.restoredLanguages.length + ' 种语言' : ''}`">
                        <template #append>
                          <v-btn size="small" variant="text" @click="lastReport = report">查看报告</v-btn>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-card>
                </v-col>
              </v-row>
            </v-window-item>
          </v-window>
        </div>
        <v-empty-state v-else icon="mdi-script-text-outline" title="尚未选择展项" text="请从左侧选择一个展厅和展项。" />
      </div>
    </v-main>

    <v-dialog v-model="versionDialog" max-width="520">
      <v-card class="pa-3">
        <v-card-title>保存版本快照</v-card-title>
        <v-card-text>
          <p class="mb-4 text-medium-emphasis">将当前“{{ draft?.title }}”的完整内容、锁定状态与引用快照保存为只读版本。</p>
          <v-text-field v-model="versionName" label="版本名称（可选）" autofocus @keyup.enter="submitVersion" />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="versionDialog = false">取消</v-btn><v-btn color="primary" @click="submitVersion">保存快照</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="importDialog" max-width="680">
      <v-card class="pa-3">
        <v-card-title>导入季度资料目录</v-card-title>
        <v-card-text>
          <p class="mb-3 text-medium-emphasis">工作室交付的整包目录，TSV 每行：编号 / 状态(valid|withdrawn) / 中文名 / 英文名 / 日文名 / 备注。编号跨版本稳定。</p>
          <v-row dense>
            <v-col cols="12" md="5"><v-text-field v-model="importVersion" label="目录版本，如 2026-Q4" /></v-col>
            <v-col cols="12" md="7"><v-text-field v-model="importLabel" label="目录显示名（可选）" /></v-col>
          </v-row>
          <v-textarea v-model="importText" rows="9" label="目录内容（TSV）" class="font-mono" />
          <v-alert v-if="importError" type="error" variant="tonal" density="compact" class="mt-2">{{ importError }}</v-alert>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="importDialog = false">取消</v-btn><v-btn color="primary" @click="parseCatalog">校验并导入</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="confirmReconcile" max-width="520" @update:model-value="confirmReconcile = $event">
      <v-card class="pa-3">
        <v-card-title>按编号对账？</v-card-title>
        <v-card-text>
          <p class="mb-2">将以 <b>{{ store.currentCatalog?.version }}</b> 目录分别对中、英、日三份稿执行：</p>
          <ul class="text-body-2 ps-4 mb-0">
            <li>已定稿/待审稿：不自动改名；撤销或缺失的引用标为待复核。</li>
            <li>草稿/退回稿：按新版本重算引用名称；锁定段落留住原文。</li>
            <li>旧稿无编号来源：跳过改名，按名称兼容显示。</li>
            <li>某语言执行失败只回滚该语言，其他语言照常生效。</li>
          </ul>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="confirmReconcile = false">取消</v-btn><v-btn color="primary" @click="runReconcile">开始对账</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="Boolean(deleteTarget)" max-width="440" @update:model-value="deleteTarget = null">
      <v-card class="pa-3">
        <v-card-title>删除这个段落？</v-card-title>
        <v-card-text>删除后可使用撤销恢复。</v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="deleteTarget = null">取消</v-btn><v-btn color="error" @click="confirmDelete">删除</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="helpDialog" max-width="520">
      <v-card class="pa-3">
        <v-card-title>键盘操作</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item prepend-icon="mdi-apple-keyboard-command" title="Ctrl / ⌘ + Z" subtitle="撤销上一步编辑" />
            <v-list-item prepend-icon="mdi-redo" title="Ctrl / ⌘ + Shift + Z" subtitle="重做" />
            <v-list-item prepend-icon="mdi-content-save-outline" title="Ctrl / ⌘ + S" subtitle="保存当前版本快照" />
            <v-list-item prepend-icon="mdi-keyboard-tab" title="Tab / Shift + Tab" subtitle="在字段、状态与段落操作之间移动" />
          </v-list>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn color="primary" @click="helpDialog = false">知道了</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar :model-value="Boolean(store.notice)" timeout="2600" location="bottom right" @update:model-value="store.notice = ''">
      {{ store.notice }}
      <template #actions><v-btn variant="text" @click="store.notice = ''">关闭</v-btn></template>
    </v-snackbar>
  </v-app>
</template>

<style scoped>
.ref-box { background: #faf7f0; border: 1px solid rgba(45, 38, 32, .12); }
.ma-05 { margin: 2px; }
.catalog-block { background: #fff; border: 1px solid rgba(45, 38, 32, .1); }
.catalog-block.active { border-color: #8a3b2e; box-shadow: inset 3px 0 0 #8a3b2e; }
.review-pending { color: #b26a00; }
.font-mono :deep(textarea), .font-mono :deep(input) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .82rem; }
</style>
