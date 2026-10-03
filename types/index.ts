export type ScriptStatus = 'draft' | 'review' | 'returned' | 'approved'
export type DeviceKind = 'desktop' | 'tablet' | 'mobile' | 'kiosk'

// 资料来源：目录条目状态
export type SourceStatus = 'valid' | 'withdrawn'
// 引用方式：有编号 / 旧稿无编号（按名称兼容）
export type SourceRefKind = 'numbered' | 'legacy'

export interface Hall {
  id: string
  name: string
  description: string
}

export interface SourceRef {
  id: string
  // 目录编号；缺失时表示旧稿无编号来源，按 legacyName 兼容显示
  code?: string
  legacyName?: string
  // 引用时（或上次重算时）解析到的名称，锁定/定稿后保留此快照
  nameSnapshot: string
  // 引用在新版目录中找不到有效来源时，标记待复核
  needsReview?: boolean
  reviewReason?: string
  // 人工已确认（即使来源仍撤销，不再重复提示）
  reviewed?: boolean
}

export interface Segment {
  id: string
  label: string
  content: string
  locked: boolean
  sources: SourceRef[]
}

export interface LanguageDraft {
  id: string
  languageId: string
  title: string
  narration: string
  accessibility: string
  durationMinutes: number
  // 旧版自由文本字段，仅用于迁移与兜底显示
  sources: string
  // 文稿级资料引用
  sourceRefs: SourceRef[]
  status: ScriptStatus
  segments: Segment[]
  updatedAt: string
}

export interface Exhibit {
  id: string
  hallId: string
  code: string
  title: string
  order: number
  drafts: LanguageDraft[]
}

export interface Language {
  id: string
  code: string
  label: string
  shortLabel: string
}

// 资料来源目录中的一条：编号跨版本稳定，名称按语言分别维护
export interface SourceEntry {
  code: string
  status: SourceStatus
  names: Record<string, string>
  note?: string
}

// 季度版本目录（工作室整包导入）
export interface SourceCatalog {
  version: string
  label: string
  importedAt: string
  entries: SourceEntry[]
}

export type ReconcileAction = 'marked-review' | 'renamed' | 'kept-frozen' | 'kept-locked' | 'legacy'

export interface ReconcileItem {
  exhibitId: string
  exhibitTitle: string
  draftId: string
  languageId: string
  scope: 'segment' | 'draft'
  scopeLabel: string
  action: ReconcileAction
  code?: string
  fromName?: string
  toName?: string
  reason?: string
}

export interface ReconcileLanguageResult {
  languageId: string
  ok: boolean
  error?: string
  markedReview: number
  renamed: number
  keptFrozen: number
  keptLocked: number
  legacy: number
}

export interface ReconcileReport {
  id: string
  catalogVersion: string
  createdAt: string
  applied: boolean
  restoredLanguages: string[]
  perLanguage: ReconcileLanguageResult[]
  items: ReconcileItem[]
  // 对账前各语言文稿快照，用于失败自动恢复或手动按语言恢复
  backup: Record<string, Array<{ exhibitId: string, draft: LanguageDraft }>>
}

export interface VersionSnapshot {
  id: string
  exhibitId: string
  languageId: string
  name: string
  createdAt: string
  draft: LanguageDraft
}

export interface PersistedState {
  halls: Hall[]
  exhibits: Exhibit[]
  versions: VersionSnapshot[]
  sourceCatalogs: SourceCatalog[]
  reconcileReports: ReconcileReport[]
  selectedHallId: string
  selectedExhibitId: string
  selectedLanguageId: string
  lastSavedAt: string
}

export interface DiffLine {
  type: 'same' | 'add' | 'remove'
  text: string
}
