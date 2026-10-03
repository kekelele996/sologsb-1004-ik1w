import { defineStore } from 'pinia'
import type {
  Exhibit, Hall, Language, LanguageDraft, PersistedState, ReconcileItem,
  ReconcileLanguageResult, ReconcileReport, ScriptStatus, Segment,
  SourceCatalog, SourceEntry, SourceRef, VersionSnapshot
} from '~/types'

export const LANGUAGES: Language[] = [
  { id: 'zh', code: 'zh-CN', label: '简体中文', shortLabel: '中' },
  { id: 'en', code: 'en-US', label: 'English', shortLabel: 'EN' },
  { id: 'ja', code: 'ja-JP', label: '日本語', shortLabel: '日' }
]

const STORAGE_KEY = 'museum-script-studio-v2'
const LEGACY_STORAGE_KEY = 'museum-script-studio-v1'

// ---------- 演示目录：两季版本，编号跨季稳定 ----------
function demoCatalogs(): SourceCatalog[] {
  const now = '2026-09-01T00:00:00.000Z'
  const older: SourceCatalog = {
    version: '2026-Q2', label: '2026 年第二季度资料目录', importedAt: '2026-06-30T02:00:00.000Z',
    entries: [
      { code: 'SRC-0001', status: 'valid', names: { zh: '《中国玉器全集》第一卷', en: 'Complete Collection of Chinese Jades, Vol. 1', ja: '『中国玉器全集』第一巻' } },
      { code: 'SRC-0002', status: 'valid', names: { zh: '本馆藏品档案 1987-J-042', en: 'Museum accession 1987-J-042', ja: '収蔵資料 1987-J-042' } },
      { code: 'SRC-0003', status: 'valid', names: { zh: '《殷周青铜器通论》', en: 'A General Survey of Yin-Zhou Bronzes', ja: '『殷周青銅器通論』' } },
      { code: 'SRC-0004', status: 'valid', names: { zh: '展品说明卡 A-08', en: 'Gallery label A-08', ja: '展示解説カード A-08' } },
      { code: 'SRC-0005', status: 'valid', names: { zh: '丝绸之路纺织史专题', en: 'Silk Road Textile History Studies', ja: 'シルクロード織物史特集' } }
    ]
  }
  const current: SourceCatalog = {
    version: '2026-Q3', label: '2026 年第三季度资料目录', importedAt: now,
    entries: [
      // 编号不变，中文名按新版修订
      { code: 'SRC-0001', status: 'valid', names: { zh: '《中国玉器全集（修订本）》第一卷', en: 'Complete Collection of Chinese Jades (rev. ed.), Vol. 1', ja: '『中国玉器全集（改訂版）』第一巻' }, note: '本季修订版' },
      { code: 'SRC-0002', status: 'valid', names: { zh: '本馆藏品档案 1987-J-042', en: 'Museum accession 1987-J-042', ja: '収蔵資料 1987-J-042' } },
      // 青铜器通论本季撤销
      { code: 'SRC-0003', status: 'withdrawn', names: { zh: '《殷周青铜器通论》', en: 'A General Survey of Yin-Zhou Bronzes', ja: '『殷周青銅器通論』' }, note: '被新版《中国青铜器综论》替代' },
      { code: 'SRC-0004', status: 'valid', names: { zh: '展品说明卡 A-08（2026 版）', en: 'Gallery label A-08 (2026 ed.)', ja: '展示解説カード A-08（2026年版）' } },
      { code: 'SRC-0005', status: 'valid', names: { zh: '丝绸之路纺织史专题', en: 'Silk Road Textile History Studies', ja: 'シルクロード織物史特集' } },
      { code: 'SRC-0006', status: 'valid', names: { zh: '良渚文化考古报告集', en: 'Archaeological Reports of the Liangzhu Culture', ja: '良渚文化考古報告集' } }
    ]
  }
  return [current, older]
}

const numbered = (code: string, nameSnapshot: string): SourceRef => ({ id: `ref-${code}-${Math.random().toString(36).slice(2, 8)}`, code, nameSnapshot })
const legacy = (legacyName: string): SourceRef => ({ id: `ref-legacy-${Math.random().toString(36).slice(2, 8)}`, legacyName, nameSnapshot: legacyName })

const segments = (prefix: string, values: Array<[string, string, boolean?, SourceRef[]?]>): Segment[] =>
  values.map(([label, content, locked, segSources], index) => ({
    id: `${prefix}-${index + 1}`, label, content, locked: Boolean(locked), sources: segSources || []
  }))

function demoState(): PersistedState {
  const sourceCatalogs = demoCatalogs()
  const halls: Hall[] = [
    { id: 'hall-ancient', name: '文明肇始厅', description: '史前至先秦文明，共 18 个展项' },
    { id: 'hall-silk', name: '丝路交融厅', description: '丝绸之路上的器物、信仰与生活' },
    { id: 'hall-city', name: '城市记忆厅', description: '近现代城市空间与市民生活' }
  ]
  const exhibits: Exhibit[] = [
    {
      id: 'exhibit-jade', hallId: 'hall-ancient', code: 'A-03', title: '玉琮：沟通天地的礼器', order: 3,
      drafts: [
        {
          id: 'draft-jade-zh', languageId: 'zh', title: '玉琮：沟通天地的礼器',
          narration: '这件玉琮出土于长江下游的良渚遗址。它外方内圆，四角雕刻神人兽面纹，体现了新石器时代晚期精湛的玉器工艺。',
          accessibility: '玉琮为深青色，高约二十厘米。触摸模型可感受方形四角与中央圆孔；圆孔贯穿器身。',
          durationMinutes: 2.5, sources: '',
          sourceRefs: [numbered('SRC-0001', '《中国玉器全集》第一卷'), numbered('SRC-0002', '本馆藏品档案 1987-J-042')],
          status: 'approved', updatedAt: '2026-09-23T08:35:00.000Z',
          segments: segments('jade-zh', [
            ['开场定位', '这件玉琮来自距今约五千年的良渚文化。', true, [numbered('SRC-0006', '良渚文化考古报告集')]],
            ['器物观察', '它外方内圆，四角雕刻神人兽面纹。', true, [numbered('SRC-0001', '《中国玉器全集》第一卷')]],
            ['文化含义', '玉琮常被看作沟通天地的礼器，也象征权力与身份。', false, []],
            ['参观提示', '请沿展柜顺时针观察，触摸复制品前先使用免洗消毒液。']
          ])
        },
        {
          id: 'draft-jade-en', languageId: 'en', title: 'Jade Cong: A Ritual Object Between Heaven and Earth',
          narration: 'This jade cong was made by the Liangzhu culture. Its square exterior and circular bore embody an early Chinese vision of the cosmos.',
          accessibility: 'The object is dark green. A tactile model shows four corners, carved faces, and a central circular opening.',
          durationMinutes: 2.3, sources: '',
          sourceRefs: [numbered('SRC-0001', 'Complete Collection of Chinese Jades, Vol. 1'), numbered('SRC-0002', 'Museum accession 1987-J-042')],
          status: 'review', updatedAt: '2026-09-24T02:15:00.000Z',
          segments: segments('jade-en', [
            ['Introduction', 'This jade cong is about five thousand years old.', true],
            ['Visual description', 'Its square body encloses a circular opening, while spirit-and-animal motifs cover the corners.'],
            ['Meaning', 'Jade cong is understood as a ritual link between heaven and earth.']
          ])
        },
        {
          id: 'draft-jade-ja', languageId: 'ja', title: '玉琮：天と地を結ぶ礼器',
          narration: 'こちらは良渚文化の玉琮です。外側は方形、中央は円形で、四隅には神人獣面文が刻まれています。',
          accessibility: '暗い青緑色の玉製です。複製模型では四つの角と中央の円孔を触って確認できます。',
          durationMinutes: 2.6, sources: '',
          sourceRefs: [numbered('SRC-0001', '『中国玉器全集』第一巻'), numbered('SRC-0002', '収蔵資料 1987-J-042')],
          status: 'draft', updatedAt: '2026-09-21T06:10:00.000Z',
          segments: segments('jade-ja', [
            ['導入', '約五千年前の良渚文化を代表する玉琮です。'],
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
          narration: '爵是最早的青铜酒器之一。三足稳定器身，长流便于倾倒，柱饰则与商周礼仪密切相关。',
          accessibility: '器物为青铜色，器口一侧有长流，底部三足支撑。复制件配有可触摸的局部纹样。',
          durationMinutes: 3, sources: '',
          // 引用了本季撤销的 SRC-0003，以及一条旧稿无编号来源
          sourceRefs: [numbered('SRC-0003', '《殷周青铜器通论》'), numbered('SRC-0004', '展品说明卡 A-08'), legacy('馆内专家讲座记录（2019）')],
          status: 'returned', updatedAt: '2026-09-23T11:20:00.000Z',
          segments: segments('bronze-zh', [
            ['器物介绍', '这是一件商代青铜爵，用于温酒和饮酒。', false, [numbered('SRC-0003', '《殷周青铜器通论》')]],
            ['结构说明', '三足使器身稳定，前端的流便于倾倒。', true, [numbered('SRC-0004', '展品说明卡 A-08')]],
            ['礼制背景', '青铜器数量与形制反映了使用者的身份。'],
            ['修改说明', '审校意见：补充“柱饰”的用途，并核对年代。']
          ])
        },
        {
          id: 'draft-bronze-en', languageId: 'en', title: 'Bronze Jue and Ritual Order',
          narration: 'The jue was among the earliest bronze drinking vessels. Its tripod base, pouring spout, and posts were closely tied to Shang and Zhou ritual.',
          accessibility: 'The tactile replica includes the long spout, tripod feet, and raised posts.',
          durationMinutes: 2.8, sources: '',
          sourceRefs: [numbered('SRC-0003', 'A General Survey of Yin-Zhou Bronzes'), numbered('SRC-0004', 'Gallery label A-08')],
          status: 'draft', updatedAt: '2026-09-22T09:00:00.000Z',
          segments: segments('bronze-en', [['Object', 'This bronze jue dates to the Shang dynasty.'], ['Structure', 'Three legs support the body; the long spout guides the pour.']])
        }
      ]
    },
    {
      id: 'exhibit-silk', hallId: 'hall-silk', code: 'B-02', title: '织机与丝路纹样', order: 2,
      drafts: [{
        id: 'draft-silk-zh', languageId: 'zh', title: '织机与丝路纹样',
        narration: '织机把一根根丝线组织成布匹，也把不同地区的图案与故事连接在一起。',
        accessibility: '体验区提供放大纹样、凸点经纬结构以及可操作的小型织机模型。',
        durationMinutes: 4, sources: '',
        sourceRefs: [legacy('馆内教育活动资料'), numbered('SRC-0005', '丝绸之路纺织史专题')],
        status: 'draft', updatedAt: '2026-09-20T03:00:00.000Z',
        segments: segments('silk-zh', [['序言', '丝绸不只是一种材料，也是交流的媒介。'], ['互动', '请试着推动梭子，观察经纬线如何交会。']])
      }]
    }
  ]
  return {
    halls, exhibits, versions: [], sourceCatalogs, reconcileReports: [],
    selectedHallId: halls[0].id, selectedExhibitId: exhibits[0].id,
    selectedLanguageId: 'zh', lastSavedAt: new Date().toISOString()
  }
}

export const useScriptStore = defineStore('museum-script', {
  state: () => ({
    halls: [] as Hall[],
    exhibits: [] as Exhibit[],
    versions: [] as VersionSnapshot[],
    sourceCatalogs: [] as SourceCatalog[],
    reconcileReports: [] as ReconcileReport[],
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
    wordCount(): number {
      return (this.selectedDraft?.narration || '').replace(/\s/g, '').length
    },
    currentCatalog(state): SourceCatalog | undefined {
      return state.sourceCatalogs[0]
    },
    canUndo(state): boolean { return state.past.length > 0 },
    canRedo(state): boolean { return state.future.length > 0 },
    // 全库待复核引用数（按语言）
    reviewCountByLanguage(): Record<string, number> {
      const counts: Record<string, number> = {}
      for (const exhibit of this.exhibits) {
        for (const draft of exhibit.drafts) {
          const all = [...draft.sourceRefs, ...draft.segments.flatMap(segment => segment.sources)]
          counts[draft.languageId] = (counts[draft.languageId] || 0) + all.filter(ref => ref.needsReview && !ref.reviewed).length
        }
      }
      return counts
    }
  },
  actions: {
    hydrate() {
      if (this.hydrated || typeof localStorage === 'undefined') return
      let loaded: PersistedState | null = null
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try { loaded = JSON.parse(saved) as PersistedState } catch { loaded = null }
      } else {
        // 兼容旧版 v1 数据：自由文本来源迁移为无编号旧来源
        const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacySaved) {
          try {
            const old = JSON.parse(legacySaved) as Partial<PersistedState>
            if (old.halls?.length && old.exhibits?.length) {
              loaded = {
                ...demoState(),
                halls: old.halls,
                exhibits: (old.exhibits || []).map(exhibit => ({
                  ...exhibit,
                  drafts: exhibit.drafts.map(draft => this.migrateDraft(draft))
                })),
                versions: old.versions || [],
                selectedHallId: old.selectedHallId || '',
                selectedExhibitId: old.selectedExhibitId || '',
                selectedLanguageId: old.selectedLanguageId || 'zh'
              }
            }
          } catch { loaded = null }
        }
      }
      if (loaded) {
        const data = this.ensureCatalogFields(loaded)
        this.$patch({ ...data, hydrated: true })
        if (!this.halls.length || !this.exhibits.length) this.resetDemo()
      } else {
        this.resetDemo()
      }
      this.ensureSelection()
      this.hydrated = true
    },
    // 补齐旧存储中可能缺失的目录/引用字段
    ensureCatalogFields(data: PersistedState): PersistedState {
      data.sourceCatalogs ||= demoCatalogs()
      data.reconcileReports ||= []
      data.exhibits = data.exhibits.map(exhibit => ({
        ...exhibit,
        drafts: exhibit.drafts.map(draft => this.migrateDraft(draft))
      }))
      data.versions = (data.versions || []).map(version => ({ ...version, draft: this.migrateDraft(version.draft) }))
      return data
    },
    migrateDraft(input: LanguageDraft): LanguageDraft {
      const draft: LanguageDraft = { ...input }
      draft.sourceRefs ||= []
      draft.segments = (draft.segments || []).map(segment => ({ ...segment, sources: segment.sources || [] }))
      // 旧稿没编号的自由文本来源：拆分为按名称兼容的旧来源
      if ((!draft.sourceRefs.length || draft.sourceRefs.some(ref => !ref.code && !ref.legacyName)) && draft.sources) {
        const existingNames = new Set(draft.sourceRefs.map(ref => ref.nameSnapshot))
        const parsed = draft.sources.split(/[；;]+/).map(item => item.trim()).filter(Boolean)
        for (const name of parsed) {
          if (!existingNames.has(name)) draft.sourceRefs.push(legacy(name))
        }
      }
      for (const ref of draft.sourceRefs) {
        if (!ref.code && ref.legacyName) ref.nameSnapshot ||= ref.legacyName
      }
      return draft
    },
    resetDemo() {
      this.$patch({ ...demoState(), hydrated: true, past: [], future: [] })
      this.persist()
      this.notice = '示例数据已就绪，可直接开始编辑。'
    },
    snapshot(): string {
      return JSON.stringify({
        halls: this.halls, exhibits: this.exhibits, versions: this.versions,
        sourceCatalogs: this.sourceCatalogs, reconcileReports: this.reconcileReports
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
        sourceCatalogs: this.sourceCatalogs, reconcileReports: this.reconcileReports,
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
    updateDraft(patch: Partial<Pick<LanguageDraft, 'title' | 'narration' | 'accessibility' | 'durationMinutes'>>) {
      const draft = this.selectedDraft
      if (!draft) return
      // 已定稿不自动改：编辑入口在界面禁用，这里再兜底
      if (draft.status === 'approved') return
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
      this.notice = segment.locked ? '段落已锁定，对账时将留住原文。' : '段落已解锁。'
    },
    addSegment() {
      const draft = this.selectedDraft
      if (!draft || draft.status === 'approved') return
      this.commit(() => draft.segments.push({ id: `segment-${Date.now()}`, label: `新段落 ${draft.segments.length + 1}`, content: '', locked: false, sources: [] }))
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

    // ---------- 资料目录 ----------
    catalogEntries(catalogVersion?: string): SourceEntry[] {
      const catalog = catalogVersion
        ? this.sourceCatalogs.find(item => item.version === catalogVersion)
        : this.currentCatalog
      return catalog?.entries || []
    },
    resolveEntry(code: string, catalogVersion?: string): SourceEntry | undefined {
      return this.catalogEntries(catalogVersion).find(entry => entry.code === code)
    },
    // 引用在界面上的显示名：编号条目按当前语言解析，旧来源按名称
    refDisplayName(ref: SourceRef, languageId: string): string {
      if (!ref.code) return ref.legacyName || ref.nameSnapshot
      const entry = this.resolveEntry(ref.code)
      return entry?.names[languageId] || entry?.names.zh || ref.nameSnapshot
    },
    importCatalog(input: { version: string, label: string, entries: SourceEntry[] }): { ok: boolean, error?: string } {
      const version = input.version.trim()
      if (!version) return { ok: false, error: '目录版本号不能为空。' }
      if (!input.entries.length) return { ok: false, error: '目录中没有任何资料条目。' }
      const codes = new Set<string>()
      for (const entry of input.entries) {
        if (!entry.code || !/^[A-Za-z0-9-]+$/.test(entry.code)) return { ok: false, error: `条目编号不合法：“${entry.code || '（空）'}”。` }
        if (codes.has(entry.code)) return { ok: false, error: `编号重复：${entry.code}。` }
        if (!entry.names?.zh) return { ok: false, error: `${entry.code} 缺少中文名称。` }
        codes.add(entry.code)
      }
      if (this.sourceCatalogs.some(catalog => catalog.version === version)) {
        return { ok: false, error: `版本 ${version} 已存在，不能重复导入。` }
      }
      const catalog: SourceCatalog = {
        version, label: input.label.trim() || `${version} 资料目录`,
        importedAt: new Date().toISOString(), entries: input.entries
      }
      this.commit(() => this.sourceCatalogs.unshift(catalog))
      this.notice = `资料目录 ${version} 已导入，共 ${input.entries.length} 条。可执行按编号对账。`
      return { ok: true }
    },

    // ---------- 引用维护 ----------
    addDraftRef(code: string) {
      const draft = this.selectedDraft
      const entry = this.currentCatalog?.entries.find(item => item.code === code)
      if (!draft || !entry || draft.sourceRefs.some(ref => ref.code === code)) return
      const ref: SourceRef = {
        id: `ref-${code}-${Date.now()}`, code,
        nameSnapshot: entry.names[draft.languageId] || entry.names.zh,
        needsReview: entry.status === 'withdrawn' ? true : undefined,
        reviewReason: entry.status === 'withdrawn' ? '该来源在当前目录中已撤销。' : undefined
      }
      this.commit(() => draft.sourceRefs.push(ref))
    },
    addLegacyDraftRef(name: string) {
      const draft = this.selectedDraft
      name = name.trim()
      if (!draft || !name) return
      this.commit(() => draft.sourceRefs.push(legacy(name)))
      this.notice = '旧来源已按名称保存（无编号，不参与按编号对账）。'
    },
    removeDraftRef(refId: string) {
      const draft = this.selectedDraft
      if (!draft) return
      this.commit(() => { draft.sourceRefs = draft.sourceRefs.filter(ref => ref.id !== refId) })
    },
    addSegmentRef(segmentId: string, code: string) {
      const draft = this.selectedDraft
      const segment = draft?.segments.find(item => item.id === segmentId)
      const entry = this.currentCatalog?.entries.find(item => item.code === code)
      if (!draft || !segment || !entry || segment.sources.some(ref => ref.code === code)) return
      const ref: SourceRef = {
        id: `ref-${code}-${Date.now()}`, code,
        nameSnapshot: entry.names[draft.languageId] || entry.names.zh,
        needsReview: entry.status === 'withdrawn' ? true : undefined,
        reviewReason: entry.status === 'withdrawn' ? '该来源在当前目录中已撤销。' : undefined
      }
      this.commit(() => segment.sources.push(ref))
    },
    addLegacySegmentRef(segmentId: string, name: string) {
      const segment = this.selectedDraft?.segments.find(item => item.id === segmentId)
      name = name.trim()
      if (!segment || !name) return
      this.commit(() => segment.sources.push(legacy(name)))
    },
    removeSegmentRef(segmentId: string, refId: string) {
      const segment = this.selectedDraft?.segments.find(item => item.id === segmentId)
      if (!segment) return
      this.commit(() => { segment.sources = segment.sources.filter(ref => ref.id !== refId) })
    },
    resolveRef(refId: string) {
      const draft = this.selectedDraft
      if (!draft) return
      const all = [...draft.sourceRefs, ...draft.segments.flatMap(segment => segment.sources)]
      const ref = all.find(item => item.id === refId)
      if (!ref) return
      this.commit(() => { ref.reviewed = true; ref.needsReview = false })
      this.notice = '该引用已人工复核确认。'
    },

    // ---------- 按编号对账（按语言分别执行、失败回滚） ----------
    reconcile(catalogVersion?: string): ReconcileReport {
      const catalog = catalogVersion
        ? this.sourceCatalogs.find(item => item.version === catalogVersion)
        : this.currentCatalog
      const version = catalog?.version || ''
      const entries = catalog?.entries || []
      const entryByCode = new Map(entries.map(entry => [entry.code, entry]))

      // 逐语言备份；某语言连备份都失败时，只跳过该语言，其余照常
      const backup: ReconcileReport['backup'] = {}

      const report: ReconcileReport = {
        id: `reconcile-${Date.now()}`, catalogVersion: version,
        createdAt: new Date().toISOString(), applied: true, restoredLanguages: [],
        perLanguage: [], items: [], backup
      }

      for (const language of LANGUAGES) {
        try {
          backup[language.id] = this.exhibits
            .filter(exhibit => exhibit.drafts.some(draft => draft.languageId === language.id))
            .map(exhibit => ({
              exhibitId: exhibit.id,
              draft: JSON.parse(JSON.stringify(exhibit.drafts.find(draft => draft.languageId === language.id)!)) as LanguageDraft
            }))
        } catch (error) {
          report.perLanguage.push({
            languageId: language.id, ok: false,
            error: `对账前备份失败，已跳过该语言：${error instanceof Error ? error.message : String(error)}`,
            markedReview: 0, renamed: 0, keptFrozen: 0, keptLocked: 0, legacy: 0
          })
          report.restoredLanguages.push(language.id)
        }
      }

      for (const language of LANGUAGES) {
        if (!backup[language.id]) continue
        try {
          const result = this.reconcileLanguage(language.id, entryByCode, report.items)
          report.perLanguage.push(result)
        } catch (error) {
          // 对账失败：按语言恢复对账前状态
          this.restoreLanguageFromBackup(language.id, backup)
          report.restoredLanguages.push(language.id)
          report.perLanguage.push({
            languageId: language.id, ok: false,
            error: error instanceof Error ? error.message : String(error),
            markedReview: 0, renamed: 0, keptFrozen: 0, keptLocked: 0, legacy: 0
          })
        }
      }

      // perLanguage 顺序按 LANGUAGES 排列（备份失败与执行失败分两趟 push，这里重排）
      report.perLanguage.sort(
        (a, b) => LANGUAGES.findIndex(lang => lang.id === a.languageId) - LANGUAGES.findIndex(lang => lang.id === b.languageId)
      )

      const anyApplied = report.perLanguage.some(result => result.ok)
      this.commit(() => {
        if (!anyApplied) {
          // 全部失败，整体回到备份
          for (const language of LANGUAGES) this.restoreLanguageFromBackup(language.id, backup)
          report.applied = false
        }
        this.reconcileReports.unshift(report)
        if (this.reconcileReports.length > 20) this.reconcileReports.pop()
      })
      return report
    },
    reconcileLanguage(
      languageId: string,
      entryByCode: Map<string, SourceEntry>,
      items: ReconcileItem[]
    ): ReconcileLanguageResult {
      const result: ReconcileLanguageResult = {
        languageId, ok: true, markedReview: 0, renamed: 0, keptFrozen: 0, keptLocked: 0, legacy: 0
      }
      const push = (item: ReconcileItem) => items.push(item)

      for (const exhibit of this.exhibits) {
        const draft = exhibit.drafts.find(item => item.languageId === languageId)
        if (!draft) continue
        const frozen = draft.status === 'approved' || draft.status === 'review'

        // 文稿级引用
        for (const ref of draft.sourceRefs) {
          if (!ref.code) { result.legacy++; push({ exhibitId: exhibit.id, exhibitTitle: exhibit.title, draftId: draft.id, languageId, scope: 'draft', scopeLabel: '文稿', action: 'legacy', code: ref.legacyName, reason: '旧稿无编号来源，按名称兼容显示' }); continue }
          const entry = entryByCode.get(ref.code)
          if (!entry || entry.status === 'withdrawn') {
            // 已定稿/待审：不自动改名，只把失去资料的引用标待复核
            if (!ref.reviewed) {
              ref.needsReview = true
              ref.reviewReason = !entry ? `编号 ${ref.code} 在 ${this.currentCatalog?.version} 目录中缺失` : `编号 ${ref.code} 已在新版目录中撤销`
              result.markedReview++
              push({ exhibitId: exhibit.id, exhibitTitle: exhibit.title, draftId: draft.id, languageId, scope: 'draft', scopeLabel: '文稿', action: 'marked-review', code: ref.code, fromName: ref.nameSnapshot, reason: ref.reviewReason })
            }
          } else {
            const newName = entry.names[languageId] || entry.names.zh
            if (frozen) {
              // 定稿/待审：名称保持引用快照，不改写
              result.keptFrozen++
              push({ exhibitId: exhibit.id, exhibitTitle: exhibit.title, draftId: draft.id, languageId, scope: 'draft', scopeLabel: '文稿', action: 'kept-frozen', code: ref.code, fromName: ref.nameSnapshot, toName: newName, reason: '已定稿/待审稿不自动改写' })
            } else if (newName && newName !== ref.nameSnapshot) {
              // 草稿/退回：按新版本重算
              push({ exhibitId: exhibit.id, exhibitTitle: exhibit.title, draftId: draft.id, languageId, scope: 'draft', scopeLabel: '文稿', action: 'renamed', code: ref.code, fromName: ref.nameSnapshot, toName: newName })
              ref.nameSnapshot = newName
              ref.needsReview = false
              ref.reviewReason = undefined
              result.renamed++
            }
          }
        }

        // 段落级引用：锁定段落留住原文（名称快照不变）
        for (const segment of draft.segments) {
          for (const ref of segment.sources) {
            if (!ref.code) { result.legacy++; push({ exhibitId: exhibit.id, exhibitTitle: exhibit.title, draftId: draft.id, languageId, scope: 'segment', scopeLabel: segment.label, action: 'legacy', code: ref.legacyName, reason: '旧稿无编号来源，按名称兼容显示' }); continue }
            const entry = entryByCode.get(ref.code)
            if (segment.locked) {
              result.keptLocked++
              if ((!entry || entry.status === 'withdrawn') && !ref.reviewed) {
                ref.needsReview = true
                ref.reviewReason = !entry ? `编号 ${ref.code} 在目录中缺失（段落锁定，原文保留）` : `编号 ${ref.code} 已撤销（段落锁定，原文保留）`
                result.markedReview++
              }
              push({ exhibitId: exhibit.id, exhibitTitle: exhibit.title, draftId: draft.id, languageId, scope: 'segment', scopeLabel: segment.label, action: 'kept-locked', code: ref.code, fromName: ref.nameSnapshot, toName: entry ? (entry.names[languageId] || entry.names.zh) : undefined, reason: '锁定段落留住原文' })
              continue
            }
            if (!entry || entry.status === 'withdrawn') {
              if (!ref.reviewed) {
                ref.needsReview = true
                ref.reviewReason = !entry ? `编号 ${ref.code} 在目录中缺失` : `编号 ${ref.code} 已在新版目录中撤销`
                result.markedReview++
              }
              push({ exhibitId: exhibit.id, exhibitTitle: exhibit.title, draftId: draft.id, languageId, scope: 'segment', scopeLabel: segment.label, action: 'marked-review', code: ref.code, fromName: ref.nameSnapshot, reason: ref.reviewReason })
              continue
            }
            const newName = entry.names[languageId] || entry.names.zh
            if (frozen) {
              result.keptFrozen++
              push({ exhibitId: exhibit.id, exhibitTitle: exhibit.title, draftId: draft.id, languageId, scope: 'segment', scopeLabel: segment.label, action: 'kept-frozen', code: ref.code, fromName: ref.nameSnapshot, toName: newName, reason: '已定稿/待审稿不自动改写' })
            } else if (newName && newName !== ref.nameSnapshot) {
              push({ exhibitId: exhibit.id, exhibitTitle: exhibit.title, draftId: draft.id, languageId, scope: 'segment', scopeLabel: segment.label, action: 'renamed', code: ref.code, fromName: ref.nameSnapshot, toName: newName })
              ref.nameSnapshot = newName
              ref.needsReview = false
              ref.reviewReason = undefined
              result.renamed++
            }
          }
        }
        draft.updatedAt = new Date().toISOString()
      }
      return result
    },
    restoreLanguageFromBackup(languageId: string, backup: ReconcileReport['backup']) {
      const rows = backup[languageId] || []
      for (const row of rows) {
        const exhibit = this.exhibits.find(item => item.id === row.exhibitId)
        if (!exhibit) continue
        const index = exhibit.drafts.findIndex(draft => draft.languageId === languageId)
        if (index >= 0) exhibit.drafts[index] = JSON.parse(JSON.stringify(row.draft)) as LanguageDraft
      }
    },
    restoreReportLanguage(reportId: string, languageId: string) {
      const report = this.reconcileReports.find(item => item.id === reportId)
      if (!report || !report.backup[languageId]) return
      this.commit(() => {
        this.restoreLanguageFromBackup(languageId, report.backup)
        if (!report.restoredLanguages.includes(languageId)) report.restoredLanguages.push(languageId)
      })
      const lang = LANGUAGES.find(item => item.id === languageId)
      this.notice = `${lang?.label || languageId} 文稿已恢复到对账前状态。`
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
        const restored = this.migrateDraft(JSON.parse(JSON.stringify(version.draft)) as LanguageDraft)
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
      const checks = [draft.title, draft.narration, draft.accessibility, draft.sourceRefs.length > 0 ? 'sources' : '', draft.segments.length > 0 ? 'segments' : '']
      return Math.round(checks.filter(Boolean).length / checks.length * 100)
    }
  }
})
