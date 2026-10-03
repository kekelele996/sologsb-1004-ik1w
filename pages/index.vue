<script setup lang="ts">
import type { DeviceKind, DiffLine, LanguageDraft, ScriptStatus, Segment, SourceMatch } from '~/types'
import { LANGUAGES, SAMPLE_IMPORT_LINES, SAMPLE_IMPORT_NOTE, SAMPLE_IMPORT_VERSION, parseCitations, useScriptStore } from '~/stores/script'

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
const importDialog = ref(false)
const importVersion = ref('')
const importNote = ref('')
const importLines = ref('')
const sourceForm = ref({ number: '', name: '', author: '' })
const reconcileDialog = ref(false)

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

const draft = computed(() => store.selectedDraft)
const exhibit = computed(() => store.selectedExhibit)
const currentLanguage = computed(() => LANGUAGES.find(item => item.id === store.selectedLanguageId))
const currentStatus = computed(() => statusOptions.find(item => item.value === draft.value?.status) || statusOptions[0])
const filteredExhibits = computed(() => store.hallExhibits.filter(item => !leftFilter.value || `${item.code} ${item.title}`.toLowerCase().includes(leftFilter.value.toLowerCase())))
const versions = computed(() => store.versions.filter(item => item.exhibitId === store.selectedExhibitId && item.languageId === store.selectedLanguageId))
const selectedVersionA = computed(() => versions.value.find(item => item.id === compareA.value))
const selectedVersionB = computed(() => versions.value.find(item => item.id === compareB.value))
const diffLines = computed<DiffLine[]>(() => {
  const before = selectedVersionA.value?.draft.narration || ''
  const after = selectedVersionB.value?.draft.narration || ''
  return buildDiff(before, after)
})
// 资料核对：当前稿的引用与自由文本来源
const narrationCitations = computed(() => parseCitations(draft.value?.narration || ''))
const sourceEntries = computed<SourceMatch[]>(() => store.parseSourceEntries(draft.value?.sources || ''))
const openFlags = computed(() => (draft.value?.reviewFlags || []).filter(flag => !flag.resolved))
const totalOpenFlags = computed(() => store.openReviewCount)
const reconcileReport = computed(() =>
  store.lastReconcile && store.lastReconcile.exhibitId === store.selectedExhibitId
    ? store.lastReconcile
    : null
)
const reconcileIssues = computed(() => reconcileReport.value?.issues || [])
const reconcileBackups = computed(() => store.reconcileBackups[store.selectedExhibitId] || {})

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
function saveDraftField(field: 'title' | 'narration' | 'accessibility' | 'durationMinutes' | 'sources', event: Event) {
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

// 资料目录
function openImportDialog() {
  importVersion.value = SAMPLE_IMPORT_VERSION
  importNote.value = SAMPLE_IMPORT_NOTE
  importLines.value = SAMPLE_IMPORT_LINES.join('\n')
  importDialog.value = true
}
function submitImport() {
  const lines = importLines.value.split('\n')
  store.importCatalog({ version: importVersion.value, note: importNote.value, lines })
  importDialog.value = false
}
function submitSource() {
  store.addSource(sourceForm.value)
  sourceForm.value = { number: '', name: '', author: '' }
}
function startReconcile() {
  if (!store.selectedExhibitId) return
  store.reconcileExhibit(store.selectedExhibitId)
  reconcileDialog.value = true
}
function restoreLang(languageId: string) {
  store.restoreLanguage(store.selectedExhibitId, languageId)
}
function citeStatus(number: string): 'ok' | 'deprecated' | 'orphan' {
  const source = store.matchByNumber(number)
  if (!source) return 'orphan'
  if (source.status === 'deprecated') return 'deprecated'
  return 'ok'
}
function citeColor(number: string): string {
  const status = citeStatus(number)
  return status === 'ok' ? 'success' : status === 'deprecated' ? 'warning' : 'error'
}
function citeLabel(number: string): string {
  const status = citeStatus(number)
  return status === 'ok' ? '正常' : status === 'deprecated' ? '已停用' : '已失去'
}
function issueColor(kind: string): string {
  return ({ orphan: 'error', renamed: 'success', deprecated: 'warning', ok: 'success' } as Record<string, string>)[kind] || 'default'
}
function issueLabel(kind: string): string {
  return ({ orphan: '失去资料', renamed: '已重算', deprecated: '已停用', ok: '正常' } as Record<string, string>)[kind] || kind
}
function langLabel(languageId: string): string {
  return LANGUAGES.find(item => item.id === languageId)?.label || languageId
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
      <v-chip
        v-if="totalOpenFlags > 0"
        class="me-2"
        color="error"
        variant="tonal"
        size="small"
        prepend-icon="mdi-alert-circle-outline"
        @click="activeTab = 'sources'"
      >{{ totalOpenFlags }} 项待复核</v-chip>
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
        <div class="section-title mb-3">多语言完成度</div>
        <div v-for="lang in LANGUAGES" :key="lang.id" class="mb-3">
          <button class="d-flex align-center w-100 border-0 bg-transparent text-left pa-0" :aria-pressed="lang.id === store.selectedLanguageId" @click="store.selectLanguage(lang.id)">
            <v-avatar size="32" :color="lang.id === store.selectedLanguageId ? 'primary' : 'grey-lighten-2'" :class="lang.id === store.selectedLanguageId ? 'text-white' : ''">{{ lang.shortLabel }}</v-avatar>
            <div class="ms-3 flex-grow-1">
              <div class="text-body-2 font-weight-medium">{{ lang.label }}</div>
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
          <v-tab value="catalog">资料目录</v-tab>
          <v-tab value="sources">资料核对</v-tab>
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
                        <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="store.addSegment">新增段落</v-btn>
                      </div>
                    </div>

                    <v-text-field label="展项标题" :model-value="draft.title" hint="面向观众的主标题" persistent-hint @change="saveDraftField('title', $event)" />
                    <v-row class="mt-2">
                      <v-col cols="12" md="5">
                        <v-text-field label="预计朗读时长（分钟）" type="number" min="0" step="0.5" :model-value="draft.durationMinutes" @change="saveDraftField('durationMinutes', $event)" />
                      </v-col>
                      <v-col cols="12" md="7">
                        <v-text-field label="资料来源" :model-value="draft.sources" hint="书籍、档案号或专家核验记录" persistent-hint @change="saveDraftField('sources', $event)" />
                      </v-col>
                    </v-row>

                    <div class="section-title mt-6 mb-2">完整讲解词</div>
                    <v-textarea label="讲解词" rows="7" auto-grow counter :model-value="draft.narration" @change="saveDraftField('narration', $event)" />

                    <div class="section-title mt-6 mb-2">无障碍描述</div>
                    <v-textarea label="无障碍描述" rows="4" auto-grow hint="描述尺寸、材质、色彩与可触摸特征，避免只依赖视觉" persistent-hint :model-value="draft.accessibility" @change="saveDraftField('accessibility', $event)" />
                  </v-card>

                  <v-card class="script-card pa-4 pa-md-6 mt-5">
                    <div class="d-flex align-center justify-space-between mb-4">
                      <div>
                        <div class="section-title">分段校对</div>
                        <div class="text-body-2 text-medium-emphasis mt-1">锁定段落不会被编辑；可在撤销中恢复。</div>
                      </div>
                      <v-chip variant="tonal">{{ draft.segments.filter(item => item.locked).length }}/{{ draft.segments.length }} 已锁定</v-chip>
                    </div>
                    <div class="d-flex flex-column ga-3">
                      <div v-for="(segment, index) in draft.segments" :key="segment.id" class="segment-row" :class="{ locked: segment.locked }">
                        <div class="d-flex align-center ga-2">
                          <v-btn icon size="small" variant="text" :aria-label="segment.locked ? '解锁段落' : '锁定段落'" @click="store.toggleLock(segment.id)">
                            {{ segment.locked ? '🔒' : '🔓' }}
                          </v-btn>
                          <v-text-field :model-value="segment.label" density="compact" hide-details variant="plain" :readonly="segment.locked" :aria-label="`第 ${index + 1} 段标题`" @change="saveSegment(segment.id, 'label', $event)" />
                          <v-chip v-if="segment.locked" color="success" size="small" variant="tonal">已确认</v-chip>
                          <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" :disabled="segment.locked" :aria-label="`删除第 ${index + 1} 段`" @click="deleteTarget = segment.id" />
                        </div>
                        <v-textarea class="mt-2" :model-value="segment.content" rows="2" auto-grow hide-details :readonly="segment.locked" :aria-label="segmentLabel(segment)" @change="saveSegment(segment.id, 'content', $event)" />
                      </div>
                    </div>
                  </v-card>
                </v-col>

                <v-col cols="12" lg="4">
                  <v-card class="script-card pa-5">
                    <div class="section-title mb-4">同展项语言进度</div>
                    <div v-for="lang in LANGUAGES" :key="lang.id" class="d-flex align-center ga-3 mb-4">
                      <v-progress-circular :model-value="store.completionFor(exhibit!, lang.id)" size="52" width="5" :color="lang.id === store.selectedLanguageId ? 'primary' : 'secondary'">
                        {{ store.completionFor(exhibit!, lang.id) }}
                      </v-progress-circular>
                      <div class="flex-grow-1">
                        <div class="font-weight-medium">{{ lang.label }}</div>
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
                      <v-list-item :prepend-icon="draft.sources ? 'mdi-check-circle' : 'mdi-alert-circle'" :title="draft.sources ? '资料来源已填写' : '缺少资料来源'" />
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
                    <p class="text-body-1 mt-6" style="line-height:1.9;white-space:pre-wrap"><CiteText :text="draft.narration" /></p>
                    <v-divider class="my-6" />
                    <div class="section-title">无障碍描述</div>
                    <p class="text-body-2 mt-2" style="line-height:1.8;white-space:pre-wrap">{{ draft.accessibility }}</p>
                    <div v-if="parseCitations(draft.narration).length" class="mt-6 text-caption text-medium-emphasis">
                      本稿引用资料 {{ parseCitations(draft.narration).map(item => item.number).join('、') }}
                    </div>
                    <div class="mt-7 text-caption text-medium-emphasis">预计讲解 {{ draft.durationMinutes }} 分钟</div>
                  </div>
                </div>
              </v-card>
            </v-window-item>

            <v-window-item value="catalog">
              <v-row>
                <v-col cols="12" md="7">
                  <v-card class="script-card pa-5">
                    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
                      <div>
                        <div class="section-title">当前资料目录</div>
                        <div class="text-h6 font-weight-bold mt-1">{{ store.catalog.version }}</div>
                        <div class="text-caption text-medium-emphasis mt-1">
                          导入于 {{ formatTime(store.catalog.importedAt) }} · {{ store.activeSources.length }} 条在架
                          <span v-if="store.catalog.note"> · {{ store.catalog.note }}</span>
                        </div>
                      </div>
                      <v-btn color="primary" prepend-icon="mdi-database-import-outline" @click="openImportDialog">导入新版本</v-btn>
                    </div>
                    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                      讲解词按编号引用（如 [S-001]）。每季升版后导入新目录，再按编号对账；已定稿讲解词不会自动改动，只把失去资料的引用标为待复核。
                    </v-alert>
                    <v-list density="compact" class="bg-transparent">
                      <v-list-item v-for="source in store.catalog.sources" :key="source.id">
                        <template #prepend>
                          <v-chip size="small" :color="source.status === 'active' ? 'primary' : source.status === 'deprecated' ? 'warning' : 'default'" variant="tonal">{{ source.number }}</v-chip>
                        </template>
                        <v-list-item-title>{{ source.name }}</v-list-item-title>
                        <v-list-item-subtitle>{{ source.author || '—' }} · {{ source.version }}</v-list-item-subtitle>
                        <template #append>
                          <v-chip v-if="source.status === 'removed'" size="x-small" color="error" variant="tonal" class="me-2">已移除</v-chip>
                          <v-btn v-if="source.status === 'removed'" size="small" variant="text" @click="store.restoreSource(source.id)">恢复</v-btn>
                          <v-btn v-else size="small" variant="text" color="error" @click="store.removeSource(source.id)">移除</v-btn>
                        </template>
                      </v-list-item>
                    </v-list>
                    <v-divider class="my-4" />
                    <div class="section-title mb-2">新增资料</div>
                    <v-row>
                      <v-col cols="12" sm="3">
                        <v-text-field v-model="sourceForm.number" label="编号" density="compact" hide-details placeholder="S-009" />
                      </v-col>
                      <v-col cols="12" sm="4">
                        <v-text-field v-model="sourceForm.name" label="名称" density="compact" hide-details />
                      </v-col>
                      <v-col cols="12" sm="3">
                        <v-text-field v-model="sourceForm.author" label="作者/出版者" density="compact" hide-details />
                      </v-col>
                      <v-col cols="12" sm="2">
                        <v-btn color="primary" class="mt-1" block @click="submitSource">新增</v-btn>
                      </v-col>
                    </v-row>
                  </v-card>
                </v-col>
                <v-col cols="12" md="5">
                  <v-card class="script-card pa-5">
                    <div class="section-title mb-3">季度对账</div>
                    <p class="text-body-2 text-medium-emphasis mb-4">
                      导入新目录后，对当前展项的中、英、日三稿按编号对账。草稿与退回段落按新版本重算编号；已定稿与待审不自动改文字；锁定段落留住原文。
                    </p>
                    <v-btn color="primary" prepend-icon="mdi-sync" block @click="startReconcile">开始对账（{{ exhibit?.code }}）</v-btn>
                    <v-divider class="my-4" />
                    <div class="section-title mb-2">历史版本</div>
                    <v-list density="compact" class="bg-transparent">
                      <v-list-item v-for="history in store.catalogHistory" :key="history.id">
                        <v-list-item-title>{{ history.version }}</v-list-item-title>
                        <v-list-item-subtitle>{{ formatTime(history.importedAt) }} · {{ history.sources.length }} 条</v-list-item-subtitle>
                        <template #append><v-btn size="small" variant="outlined" @click="store.rollbackCatalog(history.id)">回滚</v-btn></template>
                      </v-list-item>
                      <v-list-item v-if="!store.catalogHistory.length" title="暂无历史版本" subtitle="导入新版本后，旧版本会留在此处" />
                    </v-list>
                  </v-card>
                </v-col>
              </v-row>
            </v-window-item>

            <v-window-item value="sources">
              <v-row>
                <v-col cols="12" md="7">
                  <v-card class="script-card pa-5">
                    <div class="d-flex align-center justify-space-between mb-3">
                      <div class="section-title">待复核标记</div>
                      <v-btn v-if="openFlags.length" size="small" variant="text" @click="store.resolveAllFlags">全部标为已处理</v-btn>
                    </div>
                    <v-alert v-if="!openFlags.length" type="success" variant="tonal" density="compact" class="mb-4">本稿没有待复核引用。</v-alert>
                    <div v-else class="d-flex flex-column ga-2 mb-4">
                      <v-alert v-for="flag in openFlags" :key="flag.id" type="error" variant="tonal" density="compact" closable @click:close="store.resolveFlag(flag.id)">
                        <strong>{{ flag.number }}</strong><span v-if="flag.name">（{{ flag.name }}）</span> · {{ flag.message }}
                      </v-alert>
                    </div>

                    <div class="section-title mb-3">讲解词引用</div>
                    <v-alert v-if="!narrationCitations.length" type="info" variant="tonal" density="compact" class="mb-4">讲解词中没有编号引用。可使用 [编号] 格式引用资料。</v-alert>
                    <v-list v-else density="compact" class="bg-transparent mb-4">
                      <v-list-item v-for="cite in narrationCitations" :key="cite.number + cite.index">
                        <template #prepend>
                          <v-chip size="small" :color="citeColor(cite.number)" variant="tonal">{{ cite.number }}</v-chip>
                        </template>
                        <v-list-item-subtitle>{{ store.matchByNumber(cite.number)?.name || '目录中无此编号' }}</v-list-item-subtitle>
                        <template #append><v-chip size="x-small" :color="citeColor(cite.number)" variant="tonal">{{ citeLabel(cite.number) }}</v-chip></template>
                      </v-list-item>
                    </v-list>

                    <div class="section-title mb-3">来源与核验记录</div>
                    <v-textarea :model-value="draft.sources" rows="6" hint="可填写编号引用（如 [S-001]）或自由文本来源；无编号来源按名称兼容匹配" persistent-hint @change="saveDraftField('sources', $event)" />
                    <v-alert class="mt-4" type="warning" variant="tonal">发布前请由内容负责人逐条核对来源。当前无障碍描述与实物尺寸需由教育部门复核。</v-alert>
                  </v-card>
                </v-col>
                <v-col cols="12" md="5">
                  <v-card class="script-card pa-5">
                    <div class="section-title mb-3">来源匹配（按编号优先，无编号按名称）</div>
                    <v-alert v-if="!sourceEntries.length" type="info" variant="tonal" density="compact">暂无来源记录。</v-alert>
                    <v-list v-else density="compact" class="bg-transparent">
                      <v-list-item v-for="(entry, index) in sourceEntries" :key="index">
                        <template #prepend>
                          <v-chip size="small" :color="entry.matched ? 'success' : 'error'" variant="tonal">
                            {{ entry.by === 'number' ? '编号' : entry.by === 'name' ? '名称' : '未匹配' }}
                          </v-chip>
                        </template>
                        <v-list-item-title class="text-body-2">{{ entry.name || entry.raw }}</v-list-item-title>
                        <v-list-item-subtitle>{{ entry.raw }}</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-card>
                  <v-card class="script-card pa-5 mt-5">
                    <div class="section-title mb-3">段落锁定概况</div>
                    <v-timeline density="compact" side="end">
                      <v-timeline-item v-for="segment in draft.segments" :key="segment.id" :dot-color="segment.locked ? 'success' : 'grey'" size="small">
                        <div class="font-weight-medium">{{ segment.label }}</div>
                        <div class="text-caption text-medium-emphasis">{{ segment.locked ? '已锁定，审校确认' : '编辑中' }}</div>
                      </v-timeline-item>
                    </v-timeline>
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
          <p class="mb-4 text-medium-emphasis">将当前“{{ draft?.title }}”的完整内容和锁定状态保存为只读版本。</p>
          <v-text-field v-model="versionName" label="版本名称（可选）" autofocus @keyup.enter="submitVersion" />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="versionDialog = false">取消</v-btn><v-btn color="primary" @click="submitVersion">保存快照</v-btn></v-card-actions>
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

    <v-dialog v-model="importDialog" max-width="640">
      <v-card class="pa-3">
        <v-card-title>导入新版本目录</v-card-title>
        <v-card-text>
          <p class="text-medium-emphasis mb-3">每行一条资料，格式：<code>编号|名称|作者</code>（也支持逗号/分号分隔）。旧目录会保留为历史版本，可随时回滚。</p>
          <v-text-field v-model="importVersion" label="版本号（如 2026 Q3）" hide-details class="mb-3" />
          <v-text-field v-model="importNote" label="版本说明" hide-details class="mb-3" />
          <v-textarea v-model="importLines" label="资料清单" rows="10" hide-details />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="importDialog = false">取消</v-btn>
          <v-btn color="primary" @click="submitImport">导入并设为当前</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="reconcileDialog" max-width="760">
      <v-card class="pa-3">
        <v-card-title>对账结果</v-card-title>
        <v-card-text>
          <template v-if="reconcileReport">
            <div class="d-flex flex-wrap align-center ga-2 mb-3">
              <v-chip size="small" variant="tonal">{{ reconcileReport.exhibitTitle }}</v-chip>
              <v-chip size="small" variant="outlined">{{ reconcileReport.fromVersion }} → {{ reconcileReport.toVersion }}</v-chip>
              <span class="text-caption text-medium-emphasis">{{ formatTime(reconcileReport.ranAt) }}</span>
            </div>
            <v-alert type="info" variant="tonal" density="compact" class="mb-4">
              已定稿与待审稿不自动改文字；草稿与退回稿按新版本重算编号；锁定段落留住原文。失去资料的引用已标为待复核。
            </v-alert>
            <div v-for="lang in LANGUAGES" :key="lang.id" class="mb-4">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center ga-2">
                  <strong>{{ lang.label }}</strong>
                  <v-chip size="x-small" :color="exhibit?.drafts.find(item => item.languageId === lang.id) ? 'default' : 'grey'" variant="tonal">
                    {{ exhibit?.drafts.find(item => item.languageId === lang.id) ? store.statusLabel(exhibit!.drafts.find(item => item.languageId === lang.id)!.status) : '尚未创建' }}
                  </v-chip>
                  <v-chip v-if="reconcileReport.changedLanguages.includes(lang.id)" size="x-small" color="success" variant="tonal">已重算</v-chip>
                </div>
                <v-btn size="small" variant="outlined" color="warning" :disabled="!reconcileBackups[lang.id]" @click="restoreLang(lang.id)">恢复此语言稿</v-btn>
              </div>
              <v-list density="compact" class="bg-transparent rounded-lg border">
                <v-list-item v-for="(issue, index) in reconcileIssues.filter(item => item.languageId === lang.id)" :key="index">
                  <template #prepend>
                    <v-chip size="x-small" :color="issueColor(issue.kind)" variant="tonal">{{ issueLabel(issue.kind) }}</v-chip>
                  </template>
                  <v-list-item-title class="text-body-2">{{ issue.message }}</v-list-item-title>
                  <template #append>
                    <v-chip v-if="issue.applied" size="x-small" color="success" variant="tonal">已应用</v-chip>
                    <v-chip v-else size="x-small" variant="tonal">保留原文</v-chip>
                  </template>
                </v-list-item>
                <v-list-item v-if="!reconcileIssues.some(item => item.languageId === lang.id)" title="本语言稿无需调整" />
              </v-list>
            </div>
          </template>
          <v-alert v-else type="info" variant="tonal">尚未对当前展项执行对账。请先在「资料目录」页导入新版本，再点击「开始对账」。</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="warning" variant="outlined" @click="store.restoreAllLanguages(store.selectedExhibitId)">全部恢复</v-btn>
          <v-btn color="primary" @click="reconcileDialog = false">完成</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar :model-value="Boolean(store.notice)" timeout="2600" location="bottom right" @update:model-value="store.notice = ''">
      {{ store.notice }}
      <template #actions><v-btn variant="text" @click="store.notice = ''">关闭</v-btn></template>
    </v-snackbar>
  </v-app>
</template>
