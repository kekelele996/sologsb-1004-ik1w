import { defineStore } from 'pinia'
import type {
  CatalogVersion,
  CitationRef,
  Exhibit,
  Hall,
  Language,
  LanguageDraft,
  PersistedState,
  ReconcileIssue,
  ReconcileReport,
  ReviewFlagWhere,
  ScriptStatus,
  Segment,
  SourceEntry,
  SourceMatch,
  SourceStatus,
  VersionSnapshot
} from '~/types'

export const LANGUAGES: Language[] = [
  { id: 'zh', code: 'zh-CN', label: '简体中文', shortLabel: '中' },
  { id: 'en', code: 'en-US', label: 'English', shortLabel: 'EN' },
  { id: 'ja', code: 'ja-JP', label: '日本語', shortLabel: '日' }
]

const STORAGE_KEY = 'museum-script-studio-v2'

const segments = (prefix: string, values: Array<[string, string, boolean?]>): Segment[] => values.map(([label, content, locked], index) => ({
  id: `${prefix}-${index + 1}`,
  label,
  content,
  locked: Boolean(locked)
}))

// 引用格式：[S-001] 或 〔S-001〕
const CITE_RE = /\[([0-9A-Za-z][0-9A-Za-z\-]{0,20})\]|〔([0-9A-Za-z][0-9A-Za-z\-]{0,20})〕/g

export function parseCitations(text: string): CitationRef[] {
  const refs: CitationRef[] = []
  let match: RegExpExecArray | null
  CITE_RE.lastIndex = 0
  while ((match = CITE_RE.exec(text)) !== null) {
    refs.push({ number: match[1] || match[2], index: match.index, raw: match[0] })
  }
  return refs
}

// 名称归一化：去空白、标点、大小写，便于按名称兼容匹配
function normalizeName(value: string): string {
  return value.replace(/[\s《》【】\[\]（）()：:；;，,。.、·\-—_]/g, '').toLowerCase()
}

function nameMatch(a: string, b: string): boolean {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

// 仅比对文字内容，用于判断对账是否真正改动了稿件（标记待复核不算改动文字）
function textFingerprint(draft: LanguageDraft): string {
  return JSON.stringify({
    narration: draft.narration,
    sources: draft.sources,
    segments: draft.segments.map(segment => segment.content)
  })
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function makeCatalog(version: string, sources: Array<[string, string, string, SourceStatus?]>): CatalogVersion {
  return {
    id: newId('catalog'),
    version,
    importedAt: new Date('2026-09-01T00:00:00.000Z').toISOString(),
    note: '季度资料目录',
    sources: sources.map(([number, name, author, status], index) => ({
      id: `src-${index + 1}`,
      number,
      name,
      author,
      version,
      status: status || 'active'
    }))
  }
}

// 示例 Q3 导入数据：S-002 改编号为 S-007（同名），S-004 改名 S-008，S-005 移除
export const SAMPLE_IMPORT_VERSION = '2026 Q3'
export const SAMPLE_IMPORT_NOTE = '三季度升版：S-002 改编号 S-007；S-004 更名 S-008；S-005 移除'
export const SAMPLE_IMPORT_LINES = [
  'S-001|《中国玉器全集》|杨伯达 主编·河北美术出版社',
  'S-007|良渚遗址出土玉器|浙江省文物考古研究所',
  'S-003|《殷周青铜器通论》|容庚·张维持',
  'S-008|丝绸之路纺织史|馆内教育活动资料',
  'S-006|本馆藏品档案 1987-J-042|本馆资料室'
]

function demoState(): PersistedState {
  const halls: Hall[] = [
    { id: 'hall-ancient', name: '文明肇始厅', description: '史前至先秦文明，共 18 个展项' },
    { id: 'hall-silk', name: '丝路交融厅', description: '丝绸之路上的器物、信仰与生活' },
    { id: 'hall-city', name: '城市记忆厅', description: '近现代城市空间与市民生活' }
  ]
  const catalog = makeCatalog('2026 Q2', [
    ['S-001', '《中国玉器全集》', '杨伯达 主编·河北美术出版社'],
    ['S-002', '良渚遗址出土玉器', '浙江省文物考古研究所'],
    ['S-003', '《殷周青铜器通论》', '容庚·张维持'],
    ['S-004', '丝绸之路纺织史专题', '馆内教育活动资料'],
    ['S-005', '本馆藏品档案 1987-J-042', '本馆资料室']
  ])
  const exhibits: Exhibit[] = [
    {
      id: 'exhibit-jade', hallId: 'hall-ancient', code: 'A-03', title: '玉琮：沟通天地的礼器', order: 3,
      drafts: [
        {
          id: 'draft-jade-zh', languageId: 'zh', title: '玉琮：沟通天地的礼器',
          narration: '这件玉琮出土于长江下游的良渚遗址[S-002]。它外方内圆，四角雕刻神人兽面纹[S-001]，体现了新石器时代晚期精湛的玉器工艺。',
          accessibility: '玉琮为深青色，高约二十厘米。触摸模型可感受方形四角与中央圆孔；圆孔贯穿器身。',
          durationMinutes: 2.5, sources: '《中国玉器全集》第一卷；本馆藏品档案 1987-J-042',
          status: 'approved', updatedAt: '2026-09-23T08:35:00.000Z',
          reviewFlags: [],
          segments: segments('jade-zh', [
            ['开场定位', '这件玉琮来自距今约五千年的良渚文化[S-002]。', true],
            ['器物观察', '它外方内圆，四角雕刻神人兽面纹[S-001]。', true],
            ['文化含义', '玉琮常被看作沟通天地的礼器，也象征权力与身份。'],
            ['参观提示', '请沿展柜顺时针观察，触摸复制品前先使用免洗消毒液。']
          ])
        },
        {
          id: 'draft-jade-en', languageId: 'en', title: 'Jade Cong: A Ritual Object Between Heaven and Earth',
          narration: 'This jade cong was made by the Liangzhu culture[S-002]. Its square exterior and circular bore embody an early Chinese vision of the cosmos[S-001].',
          accessibility: 'The object is dark green. A tactile model shows four corners, carved faces, and a central circular opening.',
          durationMinutes: 2.3, sources: 'Complete Collection of Chinese Jades, Vol. 1; Museum accession 1987-J-042',
          status: 'review', updatedAt: '2026-09-24T02:15:00.000Z',
          reviewFlags: [],
          segments: segments('jade-en', [
            ['Introduction', 'This jade cong is about five thousand years old[S-002].', true],
            ['Visual description', 'Its square body encloses a circular opening, while spirit-and-animal motifs cover the corners.'],
            ['Meaning', 'Jade cong is understood as a ritual link between heaven and earth.']
          ])
        },
        {
          id: 'draft-jade-ja', languageId: 'ja', title: '玉琮：天と地を結ぶ礼器',
          narration: 'こちらは良渚文化の玉琮です[S-002]。外側は方形、中央は円形で、四隅には神人獣面文が刻まれています[S-001]。',
          accessibility: '暗い青緑色の玉製です。複製模型では四つの角と中央の円孔を触って確認できます。',
          durationMinutes: 2.6, sources: '『中国玉器全集』第一巻；収蔵資料 1987-J-042',
          status: 'draft', updatedAt: '2026-09-21T06:10:00.000Z',
          reviewFlags: [],
          segments: segments('jade-ja', [
            ['導入', '約五千年前の良渚文化を代表する玉琮です[S-002]。'],
            ['観察', '外側は方形、中央は円形で、四隅に精緻な文様があります。'],
            ['意味', '天地を結ぶ礼器として、力と身分を象徴しました。']
          ])
        }
      ]
    },
    {
      id: 'exhibit-bronze', hallId: 'hall-ancient', code: 'A-08', title: '青铜爵与礼制', order: 8,
      drafts: [
        {
          id: 'draft-bronze-zh', languageId: 'zh', title: '青铜爵与礼制',
          narration: '爵是最早的青铜酒器之一[S-003]。三足稳定器身，长流便于倾倒，柱饰则与商周礼仪密切相关。',
          accessibility: '器物为青铜色，器口一侧有长流，底部三足支撑。复制件配有可触摸的局部纹样。',
          durationMinutes: 3, sources: '《殷周青铜器通论》；展品说明卡 A-08',
          status: 'returned', updatedAt: '2026-09-23T11:20:00.000Z',
          reviewFlags: [],
          segments: segments('bronze-zh', [
            ['器物介绍', '这是一件商代青铜爵，用于温酒和饮酒[S-003]。'],
            ['结构说明', '三足使器身稳定，前端的流便于倾倒。'],
            ['礼制背景', '青铜器数量与形制反映了使用者的身份。'],
            ['修改说明', '审校意见：补充“柱饰”的用途，并核对年代。']
          ])
        },
        {
          id: 'draft-bronze-en', languageId: 'en', title: 'Bronze Jue and Ritual Order',
          narration: 'The jue was among the earliest bronze drinking vessels[S-003]. Its tripod base, pouring spout, and posts were closely tied to Shang and Zhou ritual.',
          accessibility: 'The tactile replica includes the long spout, tripod feet, and raised posts.',
          durationMinutes: 2.8, sources: 'A General Survey of Yin-Zhou Bronzes; Gallery label A-08',
          status: 'draft', updatedAt: '2026-09-22T09:00:00.000Z',
          reviewFlags: [],
          segments: segments('bronze-en', [['Object', 'This bronze jue dates to the Shang dynasty[S-003].'], ['Structure', 'Three legs support the body; the long spout guides the pour.']])
        }
      ]
    },
    {
      id: 'exhibit-silk', hallId: 'hall-silk', code: 'B-02', title: '织机与丝路纹样', order: 2,
      drafts: [{
        id: 'draft-silk-zh', languageId: 'zh', title: '织机与丝路纹样',
        narration: '织机把一根根丝线组织成布匹[S-004]，也把不同地区的图案与故事连接在一起。',
        accessibility: '体验区提供放大纹样、凸点经纬结构以及可操作的小型织机模型。',
        durationMinutes: 4, sources: '馆内教育活动资料；丝绸之路纺织史专题',
        status: 'draft', updatedAt: '2026-09-20T03:00:00.000Z',
        reviewFlags: [],
        segments: segments('silk-zh', [['序言', '丝绸不只是一种材料，也是交流的媒介[S-004]。'], ['互动', '请试着推动梭子，观察经纬线如何交会。']])
      }]
    }
  ]
  return {
    halls,
    exhibits,
    versions: [],
    catalog,
    catalogHistory: [],
    reconcileBackups: {},
    lastReconcile: null,
    selectedHallId: halls[0].id,
    selectedExhibitId: exhibits[0].id,
    selectedLanguageId: 'zh',
    lastSavedAt: new Date().toISOString()
  }
}

export const useScriptStore = defineStore('museum-script', {
  state: () => ({
    halls: [] as Hall[],
    exhibits: [] as Exhibit[],
    versions: [] as VersionSnapshot[],
    catalog: makeCatalog('', []),
    catalogHistory: [] as CatalogVersion[],
    reconcileBackups: {} as Record<string, Record<string, LanguageDraft>>,
    lastReconcile: null as ReconcileReport | null,
    selectedHallId: '',
    selectedExhibitId: '',
    selectedLanguageId: 'zh',
    lastSavedAt: '',
    hydrated: false,
    past: [] as string[],
    future: [] as string[],
    notice: ''
  }),
  getters: {
    selectedHall(state): Hall | undefined {
      return state.halls.find(hall => hall.id === state.selectedHallId)
    },
    hallExhibits(state): Exhibit[] {
      return state.exhibits.filter(exhibit => exhibit.hallId === state.selectedHallId).sort((a, b) => a.order - b.order)
    },
    selectedExhibit(state): Exhibit | undefined {
      return state.exhibits.find(exhibit => exhibit.id === state.selectedExhibitId)
    },
    selectedDraft(): LanguageDraft | undefined {
      return this.selectedExhibit?.drafts.find(draft => draft.languageId === this.selectedLanguageId)
    },
    activeSources(state): SourceEntry[] {
      return state.catalog.sources.filter(source => source.status !== 'removed')
    },
    // 全部展项中未解决的待复核标记数
    openReviewCount(state): number {
      return state.exhibits.reduce((sum, exhibit) =>
        sum + exhibit.drafts.reduce((n, draft) => n + draft.reviewFlags.filter(flag => !flag.resolved).length, 0), 0)
    },
    wordCount(): number {
      return (this.selectedDraft?.narration || '').replace(/\s/g, '').length
    },
    canUndo(state): boolean { return state.past.length > 0 },
    canRedo(state): boolean { return state.future.length > 0 }
  },
  actions: {
    hydrate() {
      if (this.hydrated || typeof localStorage === 'undefined') return
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const data = JSON.parse(saved) as PersistedState
          this.$patch({ ...data, hydrated: true })
          if (!this.halls.length || !this.exhibits.length) this.resetDemo()
        } catch {
          this.resetDemo()
        }
      } else {
        this.resetDemo()
      }
      this.ensureSelection()
      this.hydrated = true
    },
    resetDemo() {
      this.$patch({ ...demoState(), hydrated: true, past: [], future: [] })
      this.persist()
      this.notice = '示例数据已就绪，可直接开始编辑。'
    },
    snapshot(): string {
      return JSON.stringify({
        halls: this.halls, exhibits: this.exhibits, versions: this.versions,
        catalog: this.catalog, catalogHistory: this.catalogHistory,
        reconcileBackups: this.reconcileBackups, lastReconcile: this.lastReconcile
      })
    },
    commit(mutator: () => void) {
      this.past.push(this.snapshot())
      if (this.past.length > 50) this.past.shift()
      this.future = []
      mutator()
      this.lastSavedAt = new Date().toISOString()
      this.persist()
    },
    persist() {
      if (typeof localStorage === 'undefined') return
      const data: PersistedState = {
        halls: this.halls, exhibits: this.exhibits, versions: this.versions,
        catalog: this.catalog, catalogHistory: this.catalogHistory,
        reconcileBackups: this.reconcileBackups, lastReconcile: this.lastReconcile,
        selectedHallId: this.selectedHallId, selectedExhibitId: this.selectedExhibitId,
        selectedLanguageId: this.selectedLanguageId, lastSavedAt: this.lastSavedAt
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    },
    ensureSelection() {
      if (!this.halls.some(hall => hall.id === this.selectedHallId)) this.selectedHallId = this.halls[0]?.id || ''
      const inHall = this.exhibits.filter(exhibit => exhibit.hallId === this.selectedHallId)
      if (!inHall.some(exhibit => exhibit.id === this.selectedExhibitId)) this.selectedExhibitId = inHall[0]?.id || ''
      const exhibit = this.selectedExhibit
      if (!exhibit?.drafts.some(draft => draft.languageId === this.selectedLanguageId)) this.selectedLanguageId = exhibit?.drafts[0]?.languageId || 'zh'
    },
    selectHall(id: string) {
      this.selectedHallId = id
      const exhibit = this.exhibits.find(item => item.hallId === id)
      this.selectedExhibitId = exhibit?.id || ''
      this.ensureSelection()
      this.persist()
    },
    selectExhibit(id: string) {
      this.selectedExhibitId = id
      this.ensureSelection()
      this.persist()
    },
    selectLanguage(id: string) {
      this.selectedLanguageId = id
      this.persist()
    },
    updateDraft(patch: Partial<Pick<LanguageDraft, 'title' | 'narration' | 'accessibility' | 'durationMinutes' | 'sources'>>) {
      const draft = this.selectedDraft
      if (!draft) return
      this.commit(() => Object.assign(draft, patch, { updatedAt: new Date().toISOString() }))
      this.notice = '改动已自动保存到浏览器。'
    },
    updateSegment(id: string, patch: Partial<Pick<Segment, 'label' | 'content'>>) {
      const segment = this.selectedDraft?.segments.find(item => item.id === id)
      if (!segment || segment.locked) return
      this.commit(() => Object.assign(segment, patch))
    },
    toggleLock(id: string) {
      const segment = this.selectedDraft?.segments.find(item => item.id === id)
      if (!segment) return
      this.commit(() => { segment.locked = !segment.locked })
      this.notice = segment.locked ? '段落已锁定，避免误改。' : '段落已解锁。'
    },
    addSegment() {
      const draft = this.selectedDraft
      if (!draft) return
      this.commit(() => draft.segments.push({ id: `segment-${Date.now()}`, label: `新段落 ${draft.segments.length + 1}`, content: '', locked: false }))
    },
    removeSegment(id: string) {
      const draft = this.selectedDraft
      const segment = draft?.segments.find(item => item.id === id)
      if (!draft || !segment || segment.locked) return
      this.commit(() => { draft.segments = draft.segments.filter(item => item.id !== id) })
    },
    setStatus(status: ScriptStatus) {
      const draft = this.selectedDraft
      if (!draft) return
      this.commit(() => { draft.status = status; draft.updatedAt = new Date().toISOString() })
      this.notice = `状态已更新为“${this.statusLabel(status)}”。`
    },
    statusLabel(status: ScriptStatus) {
      return ({ draft: '草稿', review: '待审', returned: '退回', approved: '已定稿' })[status]
    },
    createVersion(name?: string) {
      const draft = this.selectedDraft
      if (!draft) return
      const version: VersionSnapshot = {
        id: `version-${Date.now()}`,
        exhibitId: this.selectedExhibitId,
        languageId: this.selectedLanguageId,
        name: name || `${new Date().toLocaleString('zh-CN', { hour12: false })} 快照`,
        createdAt: new Date().toISOString(),
        draft: JSON.parse(JSON.stringify(draft))
      }
      this.commit(() => this.versions.unshift(version))
      this.notice = '已保存当前版本，可在版本页比较或恢复。'
    },
    restoreVersion(id: string) {
      const version = this.versions.find(item => item.id === id)
      if (!version) return
      this.commit(() => {
        const exhibit = this.exhibits.find(item => item.id === version.exhibitId)
        if (!exhibit) return
        const index = exhibit.drafts.findIndex(item => item.languageId === version.languageId)
        const restored = JSON.parse(JSON.stringify(version.draft)) as LanguageDraft
        if (index >= 0) exhibit.drafts[index] = restored
        else exhibit.drafts.push(restored)
      })
      this.selectedExhibitId = version.exhibitId
      this.selectedLanguageId = version.languageId
      this.notice = '版本已恢复，并作为一次可撤销操作保存。'
    },
    undo() {
      const state = this.past.pop()
      if (!state) return
      this.future.push(this.snapshot())
      this.$patch(JSON.parse(state))
      this.lastSavedAt = new Date().toISOString()
      this.ensureSelection()
      this.persist()
      this.notice = '已撤销上一步。'
    },
    redo() {
      const state = this.future.pop()
      if (!state) return
      this.past.push(this.snapshot())
      this.$patch(JSON.parse(state))
      this.lastSavedAt = new Date().toISOString()
      this.ensureSelection()
      this.persist()
      this.notice = '已重做。'
    },
    completionFor(exhibit: Exhibit, languageId: string): number {
      const draft = exhibit.drafts.find(item => item.languageId === languageId)
      if (!draft) return 0
      const checks = [draft.title, draft.narration, draft.accessibility, draft.sources, draft.segments.length > 0 ? 'segments' : '']
      return Math.round(checks.filter(Boolean).length / checks.length * 100)
    },

    // ---- 资料目录 ----
    addSource(input: { number: string; name: string; author: string }) {
      const number = input.number.trim()
      const name = input.name.trim()
      if (!number || !name) return
      if (this.catalog.sources.some(source => source.number === number)) {
        this.notice = `编号 ${number} 已存在。`
        return
      }
      this.commit(() => {
        this.catalog.sources.push({
          id: newId('src'), number, name, author: input.author.trim(),
          version: this.catalog.version, status: 'active'
        })
      })
      this.notice = `已新增资料 ${number}。`
    },
    removeSource(id: string) {
      const source = this.catalog.sources.find(item => item.id === id)
      if (!source) return
      this.commit(() => { source.status = 'removed' })
      this.notice = `已移除资料 ${source.number}，对账时将按失去资料处理。`
    },
    restoreSource(id: string) {
      const source = this.catalog.sources.find(item => item.id === id)
      if (!source) return
      this.commit(() => { source.status = 'active' })
      this.notice = `已恢复资料 ${source.number}。`
    },
    // 导入新一季目录：旧目录进入历史，新目录成为当前
    importCatalog(input: { version: string; note: string; lines: string[] }) {
      const version = input.version.trim()
      if (!version) return
      const sources: SourceEntry[] = []
      for (const line of input.lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const parts = trimmed.split(/[|｜,，;；]/).map(part => part.trim())
        const number = parts[0]
        const name = parts[1]
        const author = parts[2] || ''
        if (!number || !name) continue
        sources.push({ id: newId('src'), number, name, author, version, status: 'active' })
      }
      if (!sources.length) return
      this.commit(() => {
        this.catalogHistory.unshift(JSON.parse(JSON.stringify(this.catalog)))
        this.catalog = {
          id: newId('catalog'), version, importedAt: new Date().toISOString(),
          note: input.note.trim(), sources
        }
      })
      this.notice = `已导入 ${version} 目录，共 ${sources.length} 条资料。请执行对账。`
    },
    rollbackCatalog(id: string) {
      const target = this.catalogHistory.find(item => item.id === id)
      if (!target) return
      this.commit(() => {
        this.catalogHistory.unshift(JSON.parse(JSON.stringify(this.catalog)))
        this.catalog = JSON.parse(JSON.stringify(target))
        this.catalogHistory = this.catalogHistory.filter(item => item.id !== id)
      })
      this.notice = `已回滚到 ${target.version} 目录。`
    },

    // ---- 引用匹配 ----
    matchByNumber(number: string): SourceEntry | undefined {
      return this.catalog.sources.find(source => source.number === number && source.status !== 'removed')
    },
    matchByName(name: string): SourceEntry | undefined {
      const target = name.trim()
      if (!target) return undefined
      return this.catalog.sources.find(source => source.status !== 'removed' && nameMatch(source.name, target))
    },
    // 旧稿自由文本来源：按编号优先，无编号按名称兼容
    parseSourceEntries(sourcesText: string): SourceMatch[] {
      const entries: SourceMatch[] = []
      const pieces = sourcesText.split(/[；;\n]+/).map(piece => piece.trim()).filter(Boolean)
      for (const piece of pieces) {
        // 仅当显式带括号 [num] 或 〔num〕 时才按编号处理，避免把西文单词误判为编号
        const bracketed = piece.match(/^\[([0-9A-Za-z][0-9A-Za-z\-]{0,20})\]\s*(.*)$|^〔([0-9A-Za-z][0-9A-Za-z\-]{0,20})〕\s*(.*)$/)
        const parsedNumber = bracketed ? (bracketed[1] || bracketed[3]) : undefined
        const restName = bracketed ? (bracketed[2] || bracketed[4]) : piece
        if (parsedNumber) {
          const source = this.matchByNumber(parsedNumber)
          if (source) {
            entries.push({ raw: piece, number: parsedNumber, name: source.name, matched: true, source, by: 'number' })
            continue
          }
          // 编号已失效，尝试按名称兼容
          const renamed = this.matchByName(restName)
          if (renamed) {
            entries.push({ raw: piece, number: parsedNumber, name: renamed.name, matched: true, source: renamed, by: 'name' })
            continue
          }
          entries.push({ raw: piece, number: parsedNumber, name: restName, matched: false, by: 'none' })
        } else {
          const source = this.matchByName(restName)
          if (source) entries.push({ raw: piece, name: restName, matched: true, source, by: 'name' })
          else entries.push({ raw: piece, name: restName, matched: false, by: 'none' })
        }
      }
      return entries
    },

    // ---- 对账 ----
    // 对账前按语言备份，失败后可分别恢复
    reconcileExhibit(exhibitId: string) {
      const exhibit = this.exhibits.find(item => item.id === exhibitId)
      if (!exhibit) return
      const oldCatalog = this.catalogHistory[0]
      const backups: Record<string, LanguageDraft> = {}
      for (const draft of exhibit.drafts) {
        backups[draft.languageId] = JSON.parse(JSON.stringify(draft))
      }
      this.reconcileBackups[exhibitId] = backups
      const issues: ReconcileIssue[] = []
      const changedLanguages: string[] = []
      for (const draft of exhibit.drafts) {
        const before = textFingerprint(draft)
        const draftIssues = this.reconcileDraft(draft, oldCatalog)
        issues.push(...draftIssues)
        if (textFingerprint(draft) !== before) changedLanguages.push(draft.languageId)
      }
      this.lastReconcile = {
        exhibitId,
        exhibitTitle: exhibit.title,
        fromVersion: oldCatalog?.version || '（初始）',
        toVersion: this.catalog.version,
        ranAt: new Date().toISOString(),
        issues,
        changedLanguages
      }
      this.persist()
      const orphanCount = issues.filter(item => item.kind === 'orphan').length
      const renamedCount = issues.filter(item => item.kind === 'renamed').length
      this.notice = `对账完成：${renamedCount} 条已按新版本重算，${orphanCount} 条失去资料已标待复核。`
    },
    reconcileDraft(draft: LanguageDraft, oldCatalog: CatalogVersion | undefined): ReconcileIssue[] {
      const issues: ReconcileIssue[] = []
      // 已定稿、待审：不自动改文字，只标待复核；草稿、退回：按新版本重算
      const autoRecalc = draft.status === 'draft' || draft.status === 'returned'

      const flag = (ref: { number: string; name?: string }, where: ReviewFlagWhere, extra: Partial<ReconcileIssue> = {}) => {
        if (draft.reviewFlags.some(item => !item.resolved && item.number === ref.number && item.where === where && item.segmentId === extra.segmentId)) return
        draft.reviewFlags.push({
          id: newId('flag'),
          number: ref.number,
          name: ref.name || '',
          where,
          segmentId: extra.segmentId,
          message: extra.message || `引用 ${ref.number} 在新版本目录中已不存在。`,
          createdAt: new Date().toISOString(),
          resolved: false
        })
      }

      // 讲解词引用
      for (const ref of parseCitations(draft.narration)) {
        const inNew = this.matchByNumber(ref.number)
        if (inNew) {
          if (inNew.status === 'deprecated') {
            issues.push({ languageId: draft.languageId, draftStatus: draft.status, scope: 'narration', number: ref.number, kind: 'deprecated', applied: false, message: `引用 ${ref.number}（${inNew.name}）已停用。` })
            flag(ref, 'narration', { message: `引用 ${ref.number}（${inNew.name}）已停用，请复核。` })
          }
          continue
        }
        const oldSource = oldCatalog?.sources.find(item => item.number === ref.number)
        const renamed = oldSource ? this.matchByName(oldSource.name) : undefined
        if (renamed && autoRecalc) {
          draft.narration = draft.narration.split(`[${ref.number}]`).join(`[${renamed.number}]`).split(`〔${ref.number}〕`).join(`〔${renamed.number}〕`)
          issues.push({ languageId: draft.languageId, draftStatus: draft.status, scope: 'narration', number: ref.number, name: renamed.name, kind: 'renamed', applied: true, message: `引用 ${ref.number} 已改编号为 ${renamed.number}（${renamed.name}）。` })
        } else {
          issues.push({ languageId: draft.languageId, draftStatus: draft.status, scope: 'narration', number: ref.number, name: oldSource?.name, kind: 'orphan', applied: false, message: `引用 ${ref.number}${oldSource ? `（${oldSource.name}）` : ''} 在新版本中已失去资料。` })
          flag(ref, 'narration', { message: `引用 ${ref.number}${oldSource ? `（${oldSource.name}）` : ''} 在新版本中已不存在，请复核。` })
        }
      }

      // 段落引用：锁定段落留住原文，不自动改
      for (const segment of draft.segments) {
        for (const ref of parseCitations(segment.content)) {
          const inNew = this.matchByNumber(ref.number)
          if (inNew) {
            if (inNew.status === 'deprecated') {
              issues.push({ languageId: draft.languageId, draftStatus: draft.status, scope: 'segment', segmentId: segment.id, segmentLabel: segment.label, number: ref.number, kind: 'deprecated', applied: false, message: `段落「${segment.label}」引用 ${ref.number} 已停用。` })
              flag(ref, 'segment', { segmentId: segment.id, message: `段落「${segment.label}」引用 ${ref.number} 已停用，请复核。` })
            }
            continue
          }
          const oldSource = oldCatalog?.sources.find(item => item.number === ref.number)
          const renamed = oldSource ? this.matchByName(oldSource.name) : undefined
          if (renamed && autoRecalc && !segment.locked) {
            segment.content = segment.content.split(`[${ref.number}]`).join(`[${renamed.number}]`).split(`〔${ref.number}〕`).join(`〔${renamed.number}〕`)
            issues.push({ languageId: draft.languageId, draftStatus: draft.status, scope: 'segment', segmentId: segment.id, segmentLabel: segment.label, number: ref.number, name: renamed.name, kind: 'renamed', applied: true, message: `段落「${segment.label}」引用已改编号为 ${renamed.number}。` })
          } else {
            const reason = segment.locked ? '段落已锁定，保留原文' : '新版本中已失去资料'
            issues.push({ languageId: draft.languageId, draftStatus: draft.status, scope: 'segment', segmentId: segment.id, segmentLabel: segment.label, number: ref.number, name: oldSource?.name, kind: 'orphan', applied: false, message: `段落「${segment.label}」引用 ${ref.number}${oldSource ? `（${oldSource.name}）` : ''}${reason}。` })
            flag(ref, 'segment', { segmentId: segment.id, message: `段落「${segment.label}」引用 ${ref.number}${oldSource ? `（${oldSource.name}）` : ''}，${reason}，请复核。` })
          }
        }
      }

      // 自由文本来源：按编号优先，无编号按名称兼容显示；仅编号失效且名称也无法匹配时才标待复核
      for (const entry of this.parseSourceEntries(draft.sources)) {
        if (entry.by === 'number' || entry.by === 'name') continue
        if (!entry.number) continue
        issues.push({ languageId: draft.languageId, draftStatus: draft.status, scope: 'sources', number: entry.number, name: entry.name, kind: 'orphan', applied: false, message: `来源 [${entry.number}]（${entry.name}）在新版本中已失去资料。` })
        flag({ number: entry.number, name: entry.name }, 'sources', { message: `来源 [${entry.number}]（${entry.name}）在新版本中已不存在，请复核。` })
      }

      return issues
    },

    // 对账失败后按语言分别恢复
    restoreLanguage(exhibitId: string, languageId: string) {
      const backup = this.reconcileBackups[exhibitId]?.[languageId]
      if (!backup) {
        this.notice = '没有可恢复的对账备份。'
        return
      }
      this.commit(() => {
        const exhibit = this.exhibits.find(item => item.id === exhibitId)
        if (!exhibit) return
        const index = exhibit.drafts.findIndex(item => item.languageId === languageId)
        const restored = JSON.parse(JSON.stringify(backup)) as LanguageDraft
        if (index >= 0) exhibit.drafts[index] = restored
        else exhibit.drafts.push(restored)
      })
      this.notice = `已按语言恢复${LANGUAGES.find(item => item.id === languageId)?.label || languageId}稿。`
    },
    restoreAllLanguages(exhibitId: string) {
      const backups = this.reconcileBackups[exhibitId]
      if (!backups) return
      this.commit(() => {
        const exhibit = this.exhibits.find(item => item.id === exhibitId)
        if (!exhibit) return
        for (const languageId of Object.keys(backups)) {
          const index = exhibit.drafts.findIndex(item => item.languageId === languageId)
          const restored = JSON.parse(JSON.stringify(backups[languageId])) as LanguageDraft
          if (index >= 0) exhibit.drafts[index] = restored
          else exhibit.drafts.push(restored)
        }
      })
      this.notice = '已恢复全部语言稿。'
    },
    resolveFlag(flagId: string) {
      const draft = this.selectedDraft
      const flag = draft?.reviewFlags.find(item => item.id === flagId)
      if (!flag) return
      this.commit(() => { flag.resolved = true })
    },
    resolveAllFlags() {
      const draft = this.selectedDraft
      if (!draft) return
      this.commit(() => { draft.reviewFlags.forEach(flag => { flag.resolved = true }) })
      this.notice = '已标记全部待复核为已处理。'
    }
  }
})
