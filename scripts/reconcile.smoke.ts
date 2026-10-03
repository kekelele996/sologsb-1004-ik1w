// 对账核心逻辑冒烟测试：在最小 Pinia + 假 localStorage 下运行
import { createPinia, setActivePinia } from 'pinia'
import { useScriptStore, LANGUAGES } from '~/stores/script'

const mem: Record<string, string> = {}
;(globalThis as any).localStorage = {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => { mem[k] = v },
  removeItem: (k: string) => { delete mem[k] }
}

const pinia = createPinia()
setActivePinia(pinia)
const store = useScriptStore()
store.hydrate()

const findDraft = (exId: string, lang: string) =>
  store.exhibits.find(e => e.id === exId)!.drafts.find(d => d.languageId === lang)!

let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log('PASS', name) }
  else { fail++; console.log('FAIL', name, detail) }
}

// --- 1. 对账：以当前 2026-Q3 目录 ---
const report = store.reconcile()
check('三语言均成功', report.perLanguage.every(r => r.ok))

// 已定稿中文玉琮：引用名称保持旧快照，不改名
const jadeZh = findDraft('exhibit-jade', 'zh')
const zhJadeBook = jadeZh.sourceRefs.find(r => r.code === 'SRC-0001')!
check('定稿稿不自动改名', zhJadeBook.nameSnapshot === '《中国玉器全集》第一卷', zhJadeBook.nameSnapshot)
// 有效来源不应被标待复核
check('定稿有效引用不标复核', !zhJadeBook.needsReview)

// 待审英文：同样保留旧名
const jadeEn = findDraft('exhibit-jade', 'en')
const enBook = jadeEn.sourceRefs.find(r => r.code === 'SRC-0001')!
check('待审稿不自动改名', enBook.nameSnapshot === 'Complete Collection of Chinese Jades, Vol. 1', enBook.nameSnapshot)

// 草稿日文：按新版重算名称
const jadeJa = findDraft('exhibit-jade', 'ja')
const jaBook = jadeJa.sourceRefs.find(r => r.code === 'SRC-0001')!
check('草稿稿按新版重算名称', jaBook.nameSnapshot.includes('改訂版'), jaBook.nameSnapshot)

// 中文退回稿引用已撤销的 SRC-0003 → 待复核（文稿级与段落级）
const bronzeZh = findDraft('exhibit-bronze', 'zh')
const zhWithdrawn = bronzeZh.sourceRefs.find(r => r.code === 'SRC-0003')!
check('失去资料引用标待复核', zhWithdrawn.needsReview === true)
const zhSegWithdrawn = bronzeZh.segments[0].sources.find(r => r.code === 'SRC-0003')!
check('段落失效引用标待复核', zhSegWithdrawn.needsReview === true)

// 锁定段落引用：留住旧名称快照（SRC-0004 目录已改名，但锁定段不重算）
const lockedSeg = bronzeZh.segments[1]
const lockedRef = lockedSeg.sources.find(r => r.code === 'SRC-0004')!
check('锁定段落留住原文', lockedRef.nameSnapshot === '展品说明卡 A-08', lockedRef.nameSnapshot)

// 英文草稿：SRC-0004 按新版改名（未锁定）
const bronzeEn = findDraft('exhibit-bronze', 'en')
const enLabel = bronzeEn.sourceRefs.find(r => r.code === 'SRC-0004')!
check('英文草稿按新版改名', enLabel.nameSnapshot.includes('2026'), enLabel.nameSnapshot)

// 旧来源（无编号）保留
check('旧来源按名称保留', bronzeZh.sourceRefs.some(r => !r.code && r.legacyName?.includes('专家讲座')))
check('旧来源计为 legacy', report.perLanguage.find(r => r.languageId === 'zh')!.legacy >= 2)

// --- 2. 按语言回滚：直接调 restoreReportLanguage ---
store.restoreReportLanguage(report.id, 'ja')
const jadeJaAfter = findDraft('exhibit-jade', 'ja')
const jaBookAfter = jadeJaAfter.sourceRefs.find(r => r.code === 'SRC-0001')!
check('日文恢复到对账前旧名', !jaBookAfter.nameSnapshot.includes('改訂版'), jaBookAfter.nameSnapshot)
// 中文不受影响
check('回滚按语言隔离：中文仍有复核标记', findDraft('exhibit-bronze', 'zh').sourceRefs.find(r => r.code === 'SRC-0003')!.needsReview === true)

// --- 3. 失败注入：让日文在对账执行阶段抛错，验证自动回滚不影响其他语言 ---
const origReconcileLanguage = store.reconcileLanguage.bind(store)
;(store as any).reconcileLanguage = (lang: string, map: Map<string, any>, items: any[]) => {
  if (lang === 'ja') throw new Error('injected ja failure')
  return origReconcileLanguage(lang, map, items)
}
const jaNameBefore = findDraft('exhibit-jade', 'ja').sourceRefs.find(r => r.code === 'SRC-0001')!.nameSnapshot
const report2 = store.reconcile()
const jaResult = report2.perLanguage.find(r => r.languageId === 'ja')!
check('日文失败被捕获', !jaResult.ok && jaResult.error === 'injected ja failure')
check('日文出现在回滚列表', report2.restoredLanguages.includes('ja'))
const jaNameAfter = findDraft('exhibit-jade', 'ja').sourceRefs.find(r => r.code === 'SRC-0001')!.nameSnapshot
check('日文失败后恢复对账前状态', jaNameAfter === jaNameBefore)
const zhResult = report2.perLanguage.find(r => r.languageId === 'zh')!
check('其他语言不受失败影响', zhResult.ok)

// --- 4. 旧 v1 存储迁移 ---
const demoRaw = mem['museum-script-studio-v2']
// 构造一个只有自由文本 sources 的旧文稿
const parsed = JSON.parse(demoRaw)
const oldExhibit = parsed.exhibits[0]
const oldDraft = { ...oldExhibit.drafts[0], sources: '某旧档案；某旧画册', sourceRefs: undefined, segments: [] }
const v1 = { halls: parsed.halls, exhibits: [{ ...oldExhibit, drafts: [oldDraft] }], versions: [], selectedHallId: '', selectedExhibitId: '', selectedLanguageId: 'zh' }
delete mem['museum-script-studio-v2']
mem['museum-script-studio-v1'] = JSON.stringify(v1)
const pinia2 = createPinia(); setActivePinia(pinia2)
const store2 = useScriptStore()
store2.hydrate()
const migrated = store2.exhibits[0].drafts[0]
check('旧自由文本迁移为旧来源', migrated.sourceRefs.length === 2 && migrated.sourceRefs.every(r => !r.code), JSON.stringify(migrated.sourceRefs.map(r => r.legacyName)))

// --- 5. 定稿保护：UI 层 updateDraft 对 approved 无效 ---
const pinia3 = createPinia(); setActivePinia(pinia3)
delete mem['museum-script-studio-v1']
delete mem['museum-script-studio-v2']
const store3 = useScriptStore()
store3.hydrate()
store3.selectLanguage('zh') // jade 已选定 hall/exhibit
const before = store3.selectedDraft!.narration
store3.updateDraft({ narration: 'HACK' })
check('定稿稿不能被 updateDraft 修改', store3.selectedDraft!.narration === before)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
