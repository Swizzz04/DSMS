import { GRADING_PERIODS, transmute, DEFAULT_TRANSMUTATION_TABLE } from '../engines/gradingEngine'

let XLSX = null
async function getXLSX() {
  if (!XLSX) { const m = await import('xlsx'); XLSX = m.default || m }
  return XLSX
}

/**
 * Export the e-Class Record to Excel — one sheet per grading period plus a
 * summary and the transmutation table.
 *
 * Generic across however many components the active grading framework
 * defines (previously hardcoded to exactly Written Works/Performance
 * Tasks/Quarterly Assessment, with Quarterly Assessment oddly special-cased
 * as a single score rather than summed like the other two — inconsistent
 * with how the entry screen itself computes it). Every component is now
 * treated uniformly: its activities are summed the same way, whatever it's
 * called and however many components the framework has.
 *
 * @param {object} params.framework — the grading framework these scores were
 *   entered against (components, subjectGroups, transmutationTable,
 *   useTransmutation). Weights come from framework.subjectGroups, not the
 *   old hardcoded WEIGHT_TABLES constant, so a school's actual configured
 *   weights show up in the export, not always the DO 8, s.2015 defaults.
 */
export async function exportEClassRecord(params) {
  const XLSX = await getXLSX()
  const {
    subjectName, section, gradeLevel, teacherName, schoolYear, schoolName,
    periodType, subjectArea, activitiesByPeriod, scoresByPeriod, students,
    framework,
  } = params

  const wb = XLSX.utils.book_new()
  const periods = GRADING_PERIODS[periodType] || GRADING_PERIODS.quarterly
  const components = framework.components
  const weights = framework.subjectGroups.find(g => g.id === subjectArea)?.weights || {}
  const useTransmutation = framework.useTransmutation !== false
  const transmutationTable = framework.transmutationTable || DEFAULT_TRANSMUTATION_TABLE
  const applyFinal = (initial) => useTransmutation
    ? transmute(initial, transmutationTable)
    : Math.round(Math.min(100, Math.max(0, initial)))
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name))

  // Fill in a sensible default for any component this period's saved
  // activities config predates (e.g. a framework edited after this period's
  // activities were first set up).
  function normalizeActs(acts) {
    const out = { ...acts }
    components.forEach(c => { if (!out[c.key] || out[c.key].length === 0) out[c.key] = [{ name: c.label, maxScore: 100 }] })
    return out
  }

  // Per-student, per-period stats for every component: sum, max, percentage
  // score, and weighted score — plus the Initial Grade (sum of weighted
  // scores) and whether the student has any score entered at all.
  function computeStudent(scoresForStudent, acts) {
    let initial = 0
    let hasAny = false
    const perComp = {}
    components.forEach(c => {
      const arr = (scoresForStudent?.[c.key]) || []
      const max = acts[c.key].reduce((s, a) => s + (a.maxScore || 0), 0)
      const sum = arr.reduce((s, v) => s + (Number(v) || 0), 0)
      const pct = max > 0 ? Math.round((sum / max) * 10000) / 100 : 0
      const w   = weights[c.key] || 0
      const weighted = Math.round(pct * w * 100) / 100
      perComp[c.key] = { sum, max, pct, weighted }
      if (arr.some(v => v !== '' && v !== 0)) hasAny = true
      initial += weighted
    })
    return { perComp, initial: Math.round(initial * 100) / 100, hasAny }
  }

  periods.forEach((period, pIdx) => {
    const acts   = normalizeActs(activitiesByPeriod[period.id] || {})
    const scores = scoresByPeriod[period.id] || {}
    const colCounts = {}
    components.forEach(c => { colCounts[c.key] = acts[c.key].length })

    const rows = []
    rows.push(['', subjectName])
    rows.push(['', section, '', '', schoolName || ''])
    rows.push([]); rows.push([])
    rows.push(['', '', '', '', section])
    rows.push(['', '', '', '', subjectName])
    rows.push(['', '', '', '', period.label])
    rows.push(['', '', '', '', teacherName])
    rows.push([])

    // Header row: activity names per component, then TOTAL/PS/WS per component
    const h = [section, 'ID no.', 'STUDENT NAME', '']
    components.forEach(c => {
      acts[c.key].forEach(a => h.push(a.name))
      h.push('TOTAL', 'PS', 'WS')
    })
    h.push('Initial Grade', 'Quarterly Grade (' + period.label.split(' ')[0] + ')', 'Adjusted Grades', 'MARK')
    for (let p = pIdx - 1; p >= 0; p--) h.push(periods[p].label)
    rows.push(h)

    // Weight row — "if you scored 100% on this component, it's worth this
    // much of your final grade" — shown under each component's PS/WS columns
    const wr = new Array(h.length).fill('')
    let col = 4
    components.forEach(c => {
      col += colCounts[c.key]
      wr[col + 1] = 100
      wr[col + 2] = Math.round((weights[c.key] || 0) * 100) + '%'
      col += 3
    })
    rows.push(wr)

    // Highest Possible Score row
    const hp = new Array(h.length).fill('')
    hp[2] = 'HIGHEST POSSIBLE SCORE'
    let col2 = 4
    components.forEach(c => {
      acts[c.key].forEach((a, i) => { hp[col2 + i] = a.maxScore })
      hp[col2 + colCounts[c.key]] = acts[c.key].reduce((s, a) => s + (a.maxScore || 0), 0)
      col2 += colCounts[c.key] + 3
    })
    rows.push(hp); rows.push([])

    sorted.forEach((stu, idx) => {
      const studentScores = scores[stu.id] || {}
      const { perComp, initial, hasAny } = computeStudent(studentScores, acts)
      const finalGrade = hasAny ? applyFinal(initial) : ''

      const r = [idx + 1, stu.id, stu.name, '']
      components.forEach(c => {
        const arr = studentScores[c.key] || []
        for (let i = 0; i < colCounts[c.key]; i++) {
          const v = arr[i]
          r.push(v !== undefined && v !== '' ? Number(v) || 0 : '')
        }
        r.push(hasAny ? perComp[c.key].sum : '', hasAny ? perComp[c.key].pct : '', hasAny ? perComp[c.key].weighted : '')
      })
      r.push(hasAny ? initial : '', finalGrade, finalGrade, hasAny ? (finalGrade >= 75 ? 'PASSED' : 'FAILED') : '')

      // Recap of already-computed earlier periods (read-only reference columns)
      for (let p = pIdx - 1; p >= 0; p--) {
        const pastScores = (scoresByPeriod[periods[p].id] || {})[stu.id]
        const pastActs   = normalizeActs(activitiesByPeriod[periods[p].id] || acts)
        let pastGrade = ''
        if (pastScores) {
          const { initial: pastInitial } = computeStudent(pastScores, pastActs)
          pastGrade = applyFinal(pastInitial)
        }
        r.push(pastGrade)
      }
      rows.push(r)
    })

    rows.push([]); rows.push(['', '', 'Date Submitted:']); rows.push(['', '', 'Checked By:'])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const compColWidths = components.flatMap(c => [...Array(colCounts[c.key]).fill({ wch: 6 }), { wch: 6 }, { wch: 5 }, { wch: 7 }])
    ws['!cols'] = [{ wch: 4 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, ...compColWidths, { wch: 9 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, ...periods.slice(0, pIdx).map(() => ({ wch: 10 }))]
    XLSX.utils.book_append_sheet(wb, ws, period.label)
  })

  // Summary
  const sr = [[], ['', '', '', schoolName || ''], ['', '', '', 'Grading Sheet'], [],
    ['Subject Teacher:', '', '', '', '', '', '', teacherName], ['Grade and Section:', '', '', '', '', '', '', section], ['Subject:', '', '', '', '', '', '', subjectName], []]
  const sh = ['', 'NAMES', '', '']; periods.forEach(p => sh.push(p.label.toUpperCase())); sh.push('FINAL GRADE', 'REMARKS'); sr.push(sh)
  sorted.forEach((stu, idx) => {
    const r = [idx + 1, stu.name, '', ''], pg = []
    periods.forEach(period => {
      const studentScores = (scoresByPeriod[period.id] || {})[stu.id]
      const acts = normalizeActs(activitiesByPeriod[period.id] || {})
      if (!studentScores) { r.push(''); return }
      const { initial, hasAny } = computeStudent(studentScores, acts)
      const t = hasAny ? applyFinal(initial) : ''
      r.push(t); if (t !== '') pg.push(t)
    })
    const f = pg.length > 0 ? Math.round(pg.reduce((a, b) => a + b, 0) / pg.length) : ''
    r.push(f, f >= 75 ? 'PASSED' : f ? 'FAILED' : ''); sr.push(r)
  })
  const sw = XLSX.utils.aoa_to_sheet(sr)
  sw['!cols'] = [{ wch: 4 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, ...periods.map(() => ({ wch: 14 })), { wch: 14 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, sw, 'SUMMARY OF GRADES')

  // Transmutation Table — the one actually in effect for this framework, not
  // always DO 8, s.2015's, and omitted entirely for zero-based grading
  // (useTransmutation: false), since there'd be nothing to show.
  if (useTransmutation) {
    const sortedTable = [...transmutationTable].sort((a, b) => a[0] - b[0])
    const td = [['Transmutation Table', '', ''], ...sortedTable.map(row => [row[0], row[1], row[2]])]
    const tw = XLSX.utils.aoa_to_sheet(td); tw['!cols'] = [{ wch: 9 }, { wch: 9 }, { wch: 9 }]
    XLSX.utils.book_append_sheet(wb, tw, 'Transmutation Table')
  }

  const filename = 'e-Class_Record_' + subjectName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + section.replace(/[^a-zA-Z0-9]/g, '_') + '_' + schoolYear + '.xlsx'
  XLSX.writeFile(wb, filename)
  return filename
}