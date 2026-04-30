import { GRADING_PERIODS, WEIGHT_TABLES, transmute } from './gradingEngine'

let XLSX = null
async function getXLSX() {
  if (!XLSX) { const m = await import('xlsx'); XLSX = m.default || m }
  return XLSX
}

export async function exportEClassRecord(params) {
  const XLSX = await getXLSX()
  const { subjectName, section, gradeLevel, teacherName, schoolYear, schoolName, periodType, subjectArea, activitiesByPeriod, scoresByPeriod, students } = params
  const wb = XLSX.utils.book_new()
  const periods = GRADING_PERIODS[periodType] || GRADING_PERIODS.quarterly
  const weights = WEIGHT_TABLES[subjectArea] || { ww: 0.40, pt: 0.40, qa: 0.20 }
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name))

  periods.forEach((period, pIdx) => {
    const acts = activitiesByPeriod[period.id] || { ww: [{ name: 'WW1', maxScore: 20 }], pt: [{ name: 'PT1', maxScore: 50 }], qa: [{ name: 'QA', maxScore: 100 }] }
    const scores = scoresByPeriod[period.id] || {}
    const wwCount = acts.ww.length, ptCount = acts.pt.length
    const wwMax = acts.ww.reduce((s, a) => s + (a.maxScore || 0), 0)
    const ptMax = acts.pt.reduce((s, a) => s + (a.maxScore || 0), 0)
    const qaMax = acts.qa[0]?.maxScore || 100
    const rows = []

    rows.push(['', subjectName])
    rows.push(['', section, '', '', schoolName || ''])
    rows.push([]); rows.push([])
    rows.push(['', '', '', '', section])
    rows.push(['', '', '', '', subjectName])
    rows.push(['', '', '', '', period.label])
    rows.push(['', '', '', '', teacherName])
    rows.push([])

    const h = [section, 'ID no.', 'STUDENT NAME', '']
    acts.ww.forEach(a => h.push(a.name)); h.push('TOTAL', 'PS', 'WS')
    acts.pt.forEach(a => h.push(a.name)); h.push('TOTAL', 'PS', 'WS')
    h.push('QUARTERLY ASSESSMENT', 'PS', 'WS', 'Initial Grade', 'Quarterly Grade (' + period.label.split(' ')[0] + ')', 'Adjusted Grades', 'MARK')
    for (let p = pIdx - 1; p >= 0; p--) h.push(periods[p].label)
    rows.push(h)

    const wr = new Array(h.length).fill('')
    wr[4 + wwCount + 1] = 100; wr[4 + wwCount + 2] = weights.ww * 100 + '%'
    wr[4 + wwCount + 3 + ptCount + 1] = 100; wr[4 + wwCount + 3 + ptCount + 2] = weights.pt * 100 + '%'
    wr[4 + wwCount + 3 + ptCount + 4] = 100; wr[4 + wwCount + 3 + ptCount + 5] = weights.qa * 100 + '%'
    rows.push(wr)

    const hp = new Array(h.length).fill('')
    hp[2] = 'HIGHEST POSSIBLE SCORE'
    acts.ww.forEach((a, i) => { hp[4 + i] = a.maxScore }); hp[4 + wwCount] = wwMax
    acts.pt.forEach((a, i) => { hp[4 + wwCount + 3 + i] = a.maxScore }); hp[4 + wwCount + 3 + ptCount] = ptMax
    hp[4 + wwCount + 3 + ptCount + 3] = qaMax
    rows.push(hp); rows.push([])

    sorted.forEach((stu, idx) => {
      const sc = scores[stu.id] || {}, ww = sc.ww || [], pt = sc.pt || [], qa = sc.qa || []
      const wwS = ww.reduce((s, v) => s + (Number(v) || 0), 0), ptS = pt.reduce((s, v) => s + (Number(v) || 0), 0), qaV = Number(qa[0]) || 0
      const wwP = wwMax > 0 ? Math.round((wwS / wwMax) * 10000) / 100 : 0
      const ptP = ptMax > 0 ? Math.round((ptS / ptMax) * 10000) / 100 : 0
      const qaP = qaMax > 0 ? Math.round((qaV / qaMax) * 10000) / 100 : 0
      const wwW = Math.round(wwP * weights.ww * 100) / 100, ptW = Math.round(ptP * weights.pt * 100) / 100, qaW = Math.round(qaP * weights.qa * 100) / 100
      const ini = Math.round((wwW + ptW + qaW) * 100) / 100
      const has = ww.some(v => v !== '' && v !== 0) || pt.some(v => v !== '' && v !== 0) || qaV > 0
      const tg = has ? transmute(ini) : ''

      const r = [idx + 1, stu.id, stu.name, '']
      ww.forEach(v => r.push(v !== '' ? Number(v) || 0 : '')); r.push(has ? wwS : '', has ? wwP : '', has ? wwW : '')
      pt.forEach(v => r.push(v !== '' ? Number(v) || 0 : '')); r.push(has ? ptS : '', has ? ptP : '', has ? ptW : '')
      r.push(qaV || '', has ? qaP : '', has ? qaW : '', has ? ini : '', tg, tg, has ? (tg >= 75 ? 'PASSED' : 'FAILED') : '')
      for (let p = pIdx - 1; p >= 0; p--) {
        const ps = (scoresByPeriod[periods[p].id] || {})[stu.id], pa = activitiesByPeriod[periods[p].id] || acts
        let pg = ''
        if (ps) {
          const w = (ps.ww || []).reduce((s, v) => s + (Number(v) || 0), 0), wm = pa.ww.reduce((s, a) => s + (a.maxScore || 0), 0)
          const p2 = (ps.pt || []).reduce((s, v) => s + (Number(v) || 0), 0), pm = pa.pt.reduce((s, a) => s + (a.maxScore || 0), 0)
          const q = Number((ps.qa || [])[0]) || 0, qm = pa.qa[0]?.maxScore || 100
          pg = transmute((wm > 0 ? (w / wm) * 100 * weights.ww : 0) + (pm > 0 ? (p2 / pm) * 100 * weights.pt : 0) + (qm > 0 ? (q / qm) * 100 * weights.qa : 0))
        }
        r.push(pg)
      }
      rows.push(r)
    })
    rows.push([]); rows.push(['', '', 'Date Submitted:']); rows.push(['', '', 'Checked By:'])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 4 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, ...Array(wwCount).fill({ wch: 6 }), { wch: 6 }, { wch: 7 }, { wch: 8 }, ...Array(ptCount).fill({ wch: 6 }), { wch: 5 }, { wch: 7 }, { wch: 8 }, { wch: 9 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws, period.label)
  })

  // Summary
  const sr = [[], ['', '', '', schoolName || ''], ['', '', '', 'Grading Sheet'], [],
    ['Subject Teacher:', '', '', '', '', '', '', teacherName], ['Grade and Section:', '', '', '', '', '', '', section], ['Subject:', '', '', '', '', '', '', subjectName], []]
  const sh = ['', 'NAMES', '', '']; periods.forEach(p => sh.push(p.label.toUpperCase())); sh.push('FINAL GRADE', 'REMARKS'); sr.push(sh)
  sorted.forEach((stu, idx) => {
    const r = [idx + 1, stu.name, '', ''], pg = []
    periods.forEach(period => {
      const sc = (scoresByPeriod[period.id] || {})[stu.id], ac = activitiesByPeriod[period.id] || { ww: [], pt: [], qa: [] }
      if (!sc) { r.push(''); return }
      const w = (sc.ww || []).reduce((s, v) => s + (Number(v) || 0), 0), wm = ac.ww.reduce((s, a) => s + (a.maxScore || 0), 0)
      const p2 = (sc.pt || []).reduce((s, v) => s + (Number(v) || 0), 0), pm = ac.pt.reduce((s, a) => s + (a.maxScore || 0), 0)
      const q = Number((sc.qa || [])[0]) || 0, qm = ac.qa[0]?.maxScore || 100
      const t = transmute((wm > 0 ? (w / wm) * 100 * weights.ww : 0) + (pm > 0 ? (p2 / pm) * 100 * weights.pt : 0) + (qm > 0 ? (q / qm) * 100 * weights.qa : 0))
      r.push(t); pg.push(t)
    })
    const v = pg.filter(g => g > 0), f = v.length > 0 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : ''
    r.push(f, f >= 75 ? 'PASSED' : f ? 'FAILED' : ''); sr.push(r)
  })
  const sw = XLSX.utils.aoa_to_sheet(sr)
  sw['!cols'] = [{ wch: 4 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, ...periods.map(() => ({ wch: 14 })), { wch: 14 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, sw, 'SUMMARY OF GRADES')

  // Transmutation Table
  const td = [['Transmutation Table','',''], [0,3.99,60],[4,7.99,61],[8,11.99,62],[12,15.99,63],[16,19.99,64],[20,23.99,65],[24,27.99,66],[28,31.99,67],[32,35.99,68],[36,39.99,69],[40,43.99,70],[44,47.99,71],[48,51.99,72],[52,55.99,73],[56,59.99,74],[60,61.59,75],[61.6,63.19,76],[63.2,64.79,77],[64.8,66.39,78],[66.4,67.99,79],[68,69.59,80],[69.6,71.19,81],[71.2,72.79,82],[72.8,74.39,83],[74.4,75.99,84],[76,77.59,85],[77.6,79.19,86],[79.2,80.79,87],[80.8,82.39,88],[82.4,83.99,89],[84,85.59,90],[85.6,87.19,91],[87.2,88.79,92],[88.8,90.39,93],[90.4,91.99,94],[92,93.59,95],[93.6,95.19,96],[95.2,96.79,97],[96.8,98.39,98],[98.4,99.99,99],[100,100,100]]
  const tw = XLSX.utils.aoa_to_sheet(td); tw['!cols'] = [{ wch: 9 }, { wch: 9 }, { wch: 9 }]
  XLSX.utils.book_append_sheet(wb, tw, 'Transmutation Table')

  const filename = 'e-Class_Record_' + subjectName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + section.replace(/[^a-zA-Z0-9]/g, '_') + '_' + schoolYear + '.xlsx'
  XLSX.writeFile(wb, filename)
  return filename
}