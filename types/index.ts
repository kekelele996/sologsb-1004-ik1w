export type ScriptStatus = 'draft' | 'review' | 'returned' | 'approved'
export type DeviceKind = 'desktop' | 'tablet' | 'mobile' | 'kiosk'

// 资料来源目录：带编号与版本
export type SourceStatus = 'active' | 'deprecated' | 'removed'

export interface SourceEntry {
  id: string
  number: string        // 编号，如 S-001
  name: string          // 资料名称
  author: string        // 作者/编者/出版者
  version: string       // 所属目录版本
  status: SourceStatus
}

export interface CatalogVersion {
  id: string
  version: string       // 目录版本号，如 2026 Q3
  importedAt: string
  note: string
  sources: SourceEntry[]
}

// 待复核标记：失去资料的引用
export type ReviewFlagWhere = 'narration' | 'segment' | 'sources'

export interface ReviewFlag {
  id: string
  number: string
  name: string
  where: ReviewFlagWhere
  segmentId?: string
  message: string
  createdAt: string
  resolved: boolean
}

// 引用解析与匹配
export interface CitationRef {
  number: string
  index: number
  raw: string
}

export type SourceMatchBy = 'number' | 'name' | 'none'

export interface SourceMatch {
  raw: string
  number?: string
  name: string
  matched: boolean
  source?: SourceEntry
  by: SourceMatchBy
}

// 对账
export type ReconcileKind = 'orphan' | 'renamed' | 'deprecated' | 'ok'

export interface ReconcileIssue {
  languageId: string
  draftStatus: ScriptStatus
  scope: 'narration' | 'segment' | 'sources'
  segmentId?: string
  segmentLabel?: string
  number?: string
  name?: string
  kind: ReconcileKind
  message: string
  applied: boolean       // 是否已自动重算（改名/改编号）；锁定或定稿为 false
}

export interface ReconcileReport {
  exhibitId: string
  exhibitTitle: string
  fromVersion: string
  toVersion: string
  ranAt: string
  issues: ReconcileIssue[]
  changedLanguages: string[]
}

export interface Hall {
  id: string
  name: string
  description: string
}

export interface Segment {
  id: string
  label: string
  content: string
  locked: boolean
}

export interface LanguageDraft {
  id: string
  languageId: string
  title: string
  narration: string
  accessibility: string
  durationMinutes: number
  sources: string
  status: ScriptStatus
  segments: Segment[]
  reviewFlags: ReviewFlag[]
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
  catalog: CatalogVersion
  catalogHistory: CatalogVersion[]
  reconcileBackups: Record<string, Record<string, LanguageDraft>>
  lastReconcile: ReconcileReport | null
  selectedHallId: string
  selectedExhibitId: string
  selectedLanguageId: string
  lastSavedAt: string
}

export interface DiffLine {
  type: 'same' | 'add' | 'remove'
  text: string
}
