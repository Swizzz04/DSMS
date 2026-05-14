/**
 * teacherFormsBridge.js — ALMIRENE DX
 * Data gathering + export for DepEd Teacher Forms: SF2, SF5, SF8, SF9, SF10
 */

const SCHOOL_YEAR_KEY = 'almirene_app_config'
const SUBMISSIONS_KEY = 'almirene_submissions'
const STUDENTS_KEY    = 'almirene_students'
const GRADES_KEY      = 'almirene_grades'
const ATTEND_KEY      = 'almirene_attendance'
const LOADS_KEY       = 'almirene_subject_loads'
const TEMPLATES_KEY   = 'almirene_form_templates'
const WEBSITE_KEY     = 'almirene_website_content'

// ─────────────────────────────────────────────────────────────────
export const FORM_TYPES = [
  { id:'sf1',  label:'School Form 1 (SF1)',  description:'School Register — master list of all enrolled learners with complete profile', icon:'BookOpen', color:'red',    needsMonth:false, templateKey:'sf1'  },
  { id:'sf2',  label:'School Form 2 (SF2)',  description:'Daily Attendance Report of Learners — per month',              icon:'Calendar',   color:'blue',   needsMonth:true,  templateKey:'sf2'  },
  { id:'sf5',  label:'School Form 5 (SF5)',  description:'Report on Promotion and Learning Progress & Achievement',      icon:'TrendingUp', color:'green',  needsMonth:false, templateKey:'sf5'  },
  { id:'sf8',  label:'School Form 8 (SF8)',  description:'Learner Basic Health and Nutrition Report',                    icon:'Heart',      color:'pink',   needsMonth:false, templateKey:'sf8'  },
  { id:'sf9',  label:'School Form 9 (SF9)',  description:"Learner's Progress Report Card — quarterly grades per subject", icon:'FileText',   color:'purple', needsMonth:false, templateKey:'sf9'  },
  { id:'sf10', label:'School Form 10 (SF10)',description:"Learner's Permanent Academic Record",                           icon:'Archive',    color:'orange', needsMonth:false, templateKey:'sf10' },
]

export const MONTHS = [
  'June','July','August','September','October','November',
  'December','January','February','March','April','May',
]

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

function getSchoolInfo() {
  const w = load(WEBSITE_KEY) || {}
  const c = load(SCHOOL_YEAR_KEY) || {}
  return {
    schoolName: w.schoolName || 'School Name',
    schoolId:   w.schoolId   || '',
    region:     w.region     || '',
    division:   w.division   || '',
    district:   w.district   || '',
    schoolYear: (c.schoolYears || []).find(y => y.isActive)?.year || '2025-2026',
  }
}

function normaliseStudent(s) {
  const first  = s.student?.firstName  || s.firstName  || ''
  const middle = s.student?.middleName || s.middleName || ''
  const last   = s.student?.lastName   || s.lastName   || ''
  const full   = `${last}, ${first}${middle ? ' ' + middle.charAt(0) + '.' : ''}`
  return {
    id:        s.id || s.studentId,
    studentId: s.studentId || s.id,
    lrn:       s.student?.lrn || s.lrn || '',
    name:      full.trim(),
    firstName: first,
    lastName:  last,
    sex:       s.student?.sex || s.sex || '',
    birthdate: s.student?.birthdate || s.birthdate || '',
    gradeLevel: s.academic?.gradeLevel || s.enrollment?.gradeLevel || s.gradeLevel || '',
    section:   s.academic?.section || s.enrollment?.section || s.section || '',
  }
}

// ─────────────────────────────────────────────────────────────────
// DATA FUNCTIONS
// ─────────────────────────────────────────────────────────────────
export function getSectionStudents(campusKey, gradeLevel, section, schoolYear) {
  const students = load(STUDENTS_KEY) || []
  const fromStudents = students.filter(s =>
    (!campusKey  || s.campusName === campusKey || s.campusKey === campusKey) &&
    (!gradeLevel || s.academic?.gradeLevel === gradeLevel || s.gradeLevel === gradeLevel) &&
    (!section    || s.academic?.section === section || s.section === section) &&
    (!schoolYear || s.schoolYear === schoolYear)
  )
  if (fromStudents.length) return fromStudents.map(normaliseStudent)

  const subs = load(SUBMISSIONS_KEY) || []
  return subs
    .filter(s =>
      ['officially_enrolled','temporarily_enrolled','approved','for_payment'].includes(s.status) &&
      (!campusKey  || s.campusName === campusKey || s.enrollment?.campus === campusKey) &&
      (!gradeLevel || s.enrollment?.gradeLevel === gradeLevel || s.gradeLevel === gradeLevel) &&
      (!section    || s.enrollment?.section === section || s.section === section) &&
      (!schoolYear || s.enrollment?.schoolYear === schoolYear)
    )
    .map(normaliseStudent)
}

export function getAvailableSections(campusKey, schoolYear) {
  const subs     = load(SUBMISSIONS_KEY) || []
  const students = load(STUDENTS_KEY) || []
  const all = [
    ...subs.filter(s =>
      ['officially_enrolled','temporarily_enrolled','approved','for_payment'].includes(s.status) &&
      (!campusKey  || s.campusName === campusKey || s.enrollment?.campus === campusKey) &&
      (!schoolYear || s.enrollment?.schoolYear === schoolYear)
    ).map(s => ({ gradeLevel: s.enrollment?.gradeLevel || s.gradeLevel || '', section: s.enrollment?.section || s.section || '' })),
    ...students.filter(s =>
      (!campusKey  || s.campusName === campusKey) &&
      (!schoolYear || s.schoolYear === schoolYear)
    ).map(s => ({ gradeLevel: s.academic?.gradeLevel || s.gradeLevel || '', section: s.academic?.section || s.section || '' }))
  ]
  const map = new Map()
  all.forEach(({ gradeLevel, section }) => {
    const key = `${gradeLevel}||${section}`
    if (!map.has(key)) map.set(key, { gradeLevel, section })
  })
  return Array.from(map.values()).sort((a,b) =>
    a.gradeLevel.localeCompare(b.gradeLevel) || a.section.localeCompare(b.section)
  )
}

export function getTeacherSections(campusKey, schoolYear, teacherIdentifier) {
  try {
    const raw = load(LOADS_KEY)
    if (raw && typeof raw === 'object') {
      const allLoads = []
      for (const [key, val] of Object.entries(raw)) {
        if (key.includes(schoolYear) && val) {
          if (val.basicEdLoads) allLoads.push(...val.basicEdLoads)
          if (val.collegeLoads)  allLoads.push(...val.collegeLoads)
        }
      }
      const teacherLoads = allLoads.filter(l =>
        l.teacherId === teacherIdentifier ||
        l.teacherEmail === teacherIdentifier ||
        l.teacherName === teacherIdentifier
      )
      if (teacherLoads.length > 0) {
        const map = new Map()
        teacherLoads.forEach(l => {
          const gl  = l.gradeLevel || l.program || ''
          const sec = l.section || l.sectionId || ''
          const key = `${gl}||${sec}`
          if (!map.has(key)) map.set(key, { gradeLevel: gl, section: sec })
        })
        return Array.from(map.values()).sort((a,b) =>
          a.gradeLevel.localeCompare(b.gradeLevel) || a.section.localeCompare(b.section)
        )
      }
    }
  } catch {}
  return getAvailableSections(campusKey, schoolYear)
}

export function getAttendanceForMonth(campusKey, gradeLevel, section, schoolYear, monthName) {
  const records  = load(ATTEND_KEY) || []
  const monthIdx = MONTHS.indexOf(monthName)
  if (monthIdx < 0) return {}
  const syStart  = parseInt(schoolYear)
  const calMonth = monthIdx < 6 ? monthIdx + 6 : monthIdx - 6
  const calYear  = monthIdx < 7 ? syStart : syStart + 1
  const filtered = records.filter(r => {
    if (!r.date) return false
    const d = new Date(r.date)
    return d.getMonth() === calMonth && d.getFullYear() === calYear &&
      (!campusKey  || r.campusKey === campusKey) &&
      (!gradeLevel || r.gradeLevel === gradeLevel) &&
      (!section    || r.section === section)
  })
  const byStudent = {}
  filtered.forEach(r => {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = {}
    byStudent[r.studentId][r.date] = r.status
  })
  return byStudent
}

export function getGradesForSection(campusKey, gradeLevel, section, schoolYear) {
  const grades = load(GRADES_KEY) || []
  return grades.filter(g =>
    g.status === 'posted' &&
    (!campusKey  || g.campusKey === campusKey) &&
    (!gradeLevel || g.gradeLevel === gradeLevel) &&
    (!section    || g.section === section) &&
    (!schoolYear || g.schoolYear === schoolYear)
  )
}

export function getSubjectsForSection(campusKey, gradeLevel, section, schoolYear) {
  const loads = load(LOADS_KEY) || []
  const items = Array.isArray(loads) ? loads : []
  const sectionLoads = items.filter(l =>
    (!campusKey  || l.campusKey === campusKey) &&
    (!gradeLevel || l.gradeLevel === gradeLevel) &&
    (!section    || l.section === section) &&
    (!schoolYear || l.schoolYear === schoolYear)
  )
  return Array.from(new Set(sectionLoads.map(l => l.subject))).sort()
}

// ─────────────────────────────────────────────────────────────────
// BUILD DATA
// ─────────────────────────────────────────────────────────────────

export function buildSF1Data(campusKey, gradeLevel, section, schoolYear) {
  const info     = getSchoolInfo()
  const students = getSectionStudents(campusKey, gradeLevel, section, schoolYear)

  return {
    header: {
      schoolName: info.schoolName,
      schoolId:   info.schoolId,
      region:     info.region,
      division:   info.division,
      district:   info.district,
      schoolYear,
      gradeLevel,
      section,
    },
    students: students.map(s => {
      // Age as of 1st Friday of June (approx June 7 of school year start)
      let age = ''
      if (s.birthdate) {
        const syYear = parseInt(schoolYear)
        const refDate = new Date(syYear, 5, 7) // June 7
        const bday    = new Date(s.birthdate)
        if (!isNaN(bday)) {
          age = Math.floor((refDate - bday) / (365.25 * 24 * 60 * 60 * 1000))
        }
      }
      return {
        lrn:          s.lrn || '',
        name:         s.name,
        sex:          s.sex || '',
        birthdate:    s.birthdate || '',
        age:          age || '',
        ipGroup:      s.ipGroup      || '',  // ethnic/IP group
        religion:     s.religion     || '',
        // Address fields
        houseStreet:  s.houseStreet  || s.address || '',
        barangay:     s.barangay     || '',
        municipality: s.municipality || '',
        province:     s.province     || '',
        // Parents / Guardian
        fatherName:   s.fatherName   || '',
        motherName:   s.motherName   || '',
        guardianName: s.guardianName || '',
        guardianRelationship: s.guardianRelationship || '',
        contactNumber: s.contactNumber || s.contact || '',
        remarks:       '',
      }
    }),
  }
}

export function buildSF2Data(campusKey, gradeLevel, section, schoolYear, monthName) {
  const info       = getSchoolInfo()
  const students   = getSectionStudents(campusKey, gradeLevel, section, schoolYear)
  const attendance = getAttendanceForMonth(campusKey, gradeLevel, section, schoolYear, monthName)
  return {
    header: { schoolName: info.schoolName, schoolId: info.schoolId, schoolYear, gradeLevel, section, month: monthName },
    students: students.map(s => {
      const atRec = attendance[s.id] || attendance[s.studentId] || {}
      return {
        lrn: s.lrn, name: s.name, sex: s.sex, attendance: atRec,
        totalAbsent: Object.values(atRec).filter(v => v === 'absent').length,
        totalTardy:  Object.values(atRec).filter(v => v === 'late').length,
      }
    }),
  }
}

export function buildSF5Data(campusKey, gradeLevel, section, schoolYear) {
  const info     = getSchoolInfo()
  const students = getSectionStudents(campusKey, gradeLevel, section, schoolYear)
  const grades   = getGradesForSection(campusKey, gradeLevel, section, schoolYear)
  return {
    header: { schoolName: info.schoolName, schoolId: info.schoolId, region: info.region, division: info.division, district: info.district, schoolYear, gradeLevel, section },
    students: students.map(s => {
      const stuGrades = grades.filter(g => g.studentId === s.id || g.studentId === s.studentId)
      const q4 = stuGrades.filter(g => g.period === 'Q4' || g.period === 'Finals')
      const gwaRaw = q4.length ? q4.reduce((sum, g) => sum + (g.transmuted || 0), 0) / q4.length : null
      const gwa = gwaRaw ? Math.round(gwaRaw) : null
      const failedAreas = stuGrades.filter(g => (g.period==='Q4'||g.period==='Finals') && g.transmuted < 75).map(g => g.subjectName).join(', ')
      return { lrn: s.lrn, name: s.name, sex: s.sex, gwa, action: gwa === null ? 'N/A' : gwa >= 75 ? 'PROMOTED' : 'RETAINED', failedAreas: failedAreas || '' }
    }),
  }
}

export function buildSF8Data(campusKey, gradeLevel, section, schoolYear) {
  const info     = getSchoolInfo()
  const students = getSectionStudents(campusKey, gradeLevel, section, schoolYear)
  return {
    header: { schoolName: info.schoolName, schoolId: info.schoolId, schoolYear, gradeLevel, section },
    students: students.map(s => ({ lrn: s.lrn, name: s.name, sex: s.sex, birthdate: s.birthdate, height: '', weight: '', bmi: '', remarks: '' })),
  }
}

export function buildSF9Data(campusKey, gradeLevel, section, schoolYear) {
  const info     = getSchoolInfo()
  const students = getSectionStudents(campusKey, gradeLevel, section, schoolYear)
  const grades   = getGradesForSection(campusKey, gradeLevel, section, schoolYear)
  const subjects = getSubjectsForSection(campusKey, gradeLevel, section, schoolYear)
  const periods  = ['Q1','Q2','Q3','Q4']
  return {
    header: { schoolName: info.schoolName, schoolId: info.schoolId, schoolYear, gradeLevel, section },
    subjects,
    students: students.map(s => {
      const stuGrades = grades.filter(g => g.studentId === s.id || g.studentId === s.studentId)
      const gradeMap  = {}
      subjects.forEach(sub => {
        gradeMap[sub] = {}
        periods.forEach(p => {
          const rec = stuGrades.find(g => g.subjectName === sub && g.period === p)
          gradeMap[sub][p] = rec?.transmuted ?? ''
        })
        const vals = periods.map(p => gradeMap[sub][p]).filter(v => v !== '')
        gradeMap[sub]['Final'] = vals.length ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length) : ''
      })
      return { lrn: s.lrn, name: s.name, sex: s.sex, grades: gradeMap }
    }),
  }
}

export function buildSF10Data(campusKey, gradeLevel, section, schoolYear) {
  const info     = getSchoolInfo()
  const students = getSectionStudents(campusKey, gradeLevel, section, schoolYear)
  const grades   = getGradesForSection(campusKey, gradeLevel, section, schoolYear)
  const subjects = getSubjectsForSection(campusKey, gradeLevel, section, schoolYear)
  return {
    header: { schoolName: info.schoolName, schoolId: info.schoolId, schoolYear, gradeLevel, section },
    subjects,
    students: students.map(s => {
      const stuGrades = grades.filter(g => g.studentId === s.id || g.studentId === s.studentId)
      const gradeMap  = {}
      subjects.forEach(sub => {
        const q4 = stuGrades.find(g => g.subjectName === sub && (g.period==='Q4'||g.period==='Finals'))
        gradeMap[sub] = q4?.transmuted ?? ''
      })
      const finals = Object.values(gradeMap).filter(v => v !== '')
      const gwa = finals.length ? Math.round(finals.reduce((a,b) => a+b, 0) / finals.length) : ''
      return { lrn: s.lrn, name: s.name, sex: s.sex, birthdate: s.birthdate, grades: gradeMap, gwa }
    }),
  }
}

// ─────────────────────────────────────────────────────────────────
// EXCEL HELPERS
// ─────────────────────────────────────────────────────────────────
function setCell(ws, addr, value, opts = {}) {
  ws[addr] = {
    t: typeof value === 'number' ? 'n' : 's',
    v: value,
    s: {
      font:      { bold: opts.bold, sz: opts.sz || 10, name: 'Arial', color: opts.fontColor ? { rgb: opts.fontColor } : undefined },
      fill:      opts.fill ? { fgColor: { rgb: opts.fill }, patternType: 'solid' } : undefined,
      alignment: { horizontal: opts.align || 'left', vertical: 'center', wrapText: opts.wrap },
      border:    opts.border ? {
        top: { style:'thin', color:{rgb:'AAAAAA'} }, bottom: { style:'thin', color:{rgb:'AAAAAA'} },
        left: { style:'thin', color:{rgb:'AAAAAA'} }, right: { style:'thin', color:{rgb:'AAAAAA'} },
      } : undefined,
    }
  }
}

const HEADER_FILL = '1A3A6B'
const COL = (c) => c < 26 ? String.fromCharCode(65+c) : 'A' + String.fromCharCode(65+c-26)

function addHeaderRow(ws, cols, rowNum) {
  cols.forEach((h, i) => {
    setCell(ws, `${COL(i)}${rowNum}`, h, { bold: true, align: 'center', fill: HEADER_FILL, fontColor: 'FFFFFF', border: true })
  })
}

function buildSF2Sheet(data) {
  const { header, students } = data
  const ws = {}
  setCell(ws, 'A1', 'School Form 2 (SF2) Daily Attendance Report of Learners', { bold: true, sz: 12 })
  setCell(ws, 'A2', `School: ${header.schoolName}  |  ID: ${header.schoolId}  |  SY: ${header.schoolYear}  |  Grade: ${header.gradeLevel}  |  Section: ${header.section}  |  Month: ${header.month}`)
  const hcols = ['No.', "Learner's Name", 'LRN', 'Sex',
    'M1','T1','W1','H1','F1','M2','T2','W2','H2','F2','M3','T3','W3','H3','F3',
    'M4','T4','W4','H4','F4','M5','T5','W5','H5','F5','Absent','Tardy','Remarks']
  addHeaderRow(ws, hcols, 4)
  students.forEach((s, i) => {
    const r = i + 5
    setCell(ws, `A${r}`, i+1, { align:'center', border:true })
    setCell(ws, `B${r}`, s.name, { border:true })
    setCell(ws, `C${r}`, s.lrn || '', { border:true })
    setCell(ws, `D${r}`, s.sex || '', { align:'center', border:true })
    for (let c = 4; c < 29; c++) setCell(ws, `${COL(c)}${r}`, '', { align:'center', border:true })
    setCell(ws, `${COL(29)}${r}`, s.totalAbsent || 0, { align:'center', border:true })
    setCell(ws, `${COL(30)}${r}`, s.totalTardy  || 0, { align:'center', border:true })
    setCell(ws, `${COL(31)}${r}`, '', { border:true })
  })
  ws['!ref'] = `A1:AF${students.length+4}`
  ws['!cols'] = [{ wch:4 },{ wch:32 },{ wch:14 },{ wch:4 },...Array(25).fill({ wch:3 }),{ wch:7 },{ wch:7 },{ wch:20 }]
  return ws
}

function buildSF5Sheet(data) {
  const { header, students } = data
  const ws = {}
  setCell(ws, 'A1', 'School Form 5 (SF5) Report on Promotion and Learning Progress & Achievement', { bold:true, sz:12 })
  setCell(ws, 'A2', `School: ${header.schoolName}  |  SY: ${header.schoolYear}  |  Grade: ${header.gradeLevel}  |  Section: ${header.section}`)
  addHeaderRow(ws, ['No.','LRN',"Learner's Name",'Sex','General Average','Action Taken','Failed Learning Areas'], 4)
  students.forEach((s, i) => {
    const r = i + 5
    setCell(ws, `A${r}`, i+1, { align:'center', border:true })
    setCell(ws, `B${r}`, s.lrn || '', { border:true })
    setCell(ws, `C${r}`, s.name, { border:true })
    setCell(ws, `D${r}`, s.sex || '', { align:'center', border:true })
    setCell(ws, `E${r}`, s.gwa !== null && s.gwa !== undefined ? s.gwa : '', { align:'center', border:true })
    setCell(ws, `F${r}`, s.action, { align:'center', border:true })
    setCell(ws, `G${r}`, s.failedAreas || '', { border:true })
  })
  ws['!ref'] = `A1:G${students.length+4}`
  ws['!cols'] = [{ wch:4 },{ wch:14 },{ wch:32 },{ wch:4 },{ wch:8 },{ wch:12 },{ wch:40 }]
  return ws
}

function buildSF8Sheet(data) {
  const { header, students } = data
  const ws = {}
  setCell(ws, 'A1', 'School Form 8 (SF8) Learner Basic Health and Nutrition Report', { bold:true, sz:12 })
  setCell(ws, 'A2', `School: ${header.schoolName}  |  SY: ${header.schoolYear}  |  Grade: ${header.gradeLevel}  |  Section: ${header.section}`)
  addHeaderRow(ws, ['No.','LRN',"Learner's Name",'Sex','Birthdate','Height (cm)','Weight (kg)','BMI','Nutritional Status','Remarks'], 4)
  students.forEach((s, i) => {
    const r = i + 5
    setCell(ws, `A${r}`, i+1, { align:'center', border:true })
    setCell(ws, `B${r}`, s.lrn || '', { border:true })
    setCell(ws, `C${r}`, s.name, { border:true })
    setCell(ws, `D${r}`, s.sex || '', { align:'center', border:true })
    setCell(ws, `E${r}`, s.birthdate || '', { border:true })
    for (let c = 5; c < 10; c++) setCell(ws, `${COL(c)}${r}`, '', { align:'center', border:true })
  })
  ws['!ref'] = `A1:J${students.length+4}`
  ws['!cols'] = [{ wch:4 },{ wch:14 },{ wch:32 },{ wch:4 },{ wch:12 },{ wch:10 },{ wch:10 },{ wch:8 },{ wch:16 },{ wch:20 }]
  return ws
}

function buildSF9Sheet(data) {
  const { header, subjects, students } = data
  const ws = {}
  const periods = ['Q1','Q2','Q3','Q4','Final']
  setCell(ws, 'A1', "School Form 9 (SF9) Learner's Progress Report Card", { bold:true, sz:12 })
  setCell(ws, 'A2', `School: ${header.schoolName}  |  SY: ${header.schoolYear}  |  Grade: ${header.gradeLevel}  |  Section: ${header.section}`)
  let col = 0
  for (const h of ['No.','LRN',"Learner's Name",'Sex']) {
    setCell(ws, `${COL(col)}4`, h, { bold:true, align:'center', fill:HEADER_FILL, fontColor:'FFFFFF', border:true })
    col++
  }
  subjects.forEach(sub => {
    periods.forEach(p => {
      setCell(ws, `${COL(col)}4`, `${sub.substring(0,10)} ${p}`, { bold:true, align:'center', fill:HEADER_FILL, fontColor:'FFFFFF', border:true, wrap:true })
      col++
    })
  })
  students.forEach((s, i) => {
    const r = i + 5
    let c = 0
    setCell(ws, `${COL(c++)}${r}`, i+1, { align:'center', border:true })
    setCell(ws, `${COL(c++)}${r}`, s.lrn || '', { border:true })
    setCell(ws, `${COL(c++)}${r}`, s.name, { border:true })
    setCell(ws, `${COL(c++)}${r}`, s.sex || '', { align:'center', border:true })
    subjects.forEach(sub => {
      periods.forEach(p => {
        const val = s.grades?.[sub]?.[p] ?? ''
        setCell(ws, `${COL(c++)}${r}`, val, { align:'center', border:true })
      })
    })
  })
  ws['!ref'] = `A1:${COL(col-1)}${students.length+4}`
  ws['!cols'] = [{ wch:4 },{ wch:14 },{ wch:32 },{ wch:4 },...subjects.flatMap(() => Array(5).fill({ wch:7 }))]
  return ws
}

function buildSF10Sheet(data) {
  const { header, subjects, students } = data
  const ws = {}
  setCell(ws, 'A1', "School Form 10 (SF10) Learner's Permanent Academic Record", { bold:true, sz:12 })
  setCell(ws, 'A2', `School: ${header.schoolName}  |  SY: ${header.schoolYear}  |  Grade: ${header.gradeLevel}  |  Section: ${header.section}`)
  let col = 0
  for (const h of ['No.','LRN',"Learner's Name",'Sex','Birthdate']) {
    setCell(ws, `${COL(col)}4`, h, { bold:true, align:'center', fill:HEADER_FILL, fontColor:'FFFFFF', border:true })
    col++
  }
  subjects.forEach(sub => {
    setCell(ws, `${COL(col)}4`, sub, { bold:true, align:'center', fill:HEADER_FILL, fontColor:'FFFFFF', border:true, wrap:true })
    col++
  })
  setCell(ws, `${COL(col)}4`, 'GWA', { bold:true, align:'center', fill:HEADER_FILL, fontColor:'FFFFFF', border:true })
  students.forEach((s, i) => {
    const r = i + 5
    let c = 0
    setCell(ws, `${COL(c++)}${r}`, i+1, { align:'center', border:true })
    setCell(ws, `${COL(c++)}${r}`, s.lrn || '', { border:true })
    setCell(ws, `${COL(c++)}${r}`, s.name, { border:true })
    setCell(ws, `${COL(c++)}${r}`, s.sex || '', { align:'center', border:true })
    setCell(ws, `${COL(c++)}${r}`, s.birthdate || '', { border:true })
    subjects.forEach(sub => setCell(ws, `${COL(c++)}${r}`, s.grades?.[sub] ?? '', { align:'center', border:true }))
    setCell(ws, `${COL(c)}${r}`, s.gwa || '', { align:'center', bold:true, border:true })
  })
  ws['!ref'] = `A1:${COL(col)}${students.length+4}`
  ws['!cols'] = [{ wch:4 },{ wch:14 },{ wch:32 },{ wch:4 },{ wch:12 },...subjects.map(() => ({ wch:8 })),{ wch:6 }]
  return ws
}

// ─────────────────────────────────────────────────────────────────
// TEMPLATE FILL
// ─────────────────────────────────────────────────────────────────
async function fillTemplate(XLSX, templateBase64, formId, data) {
  const binary = atob(templateBase64.split(',').pop())
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const wb = XLSX.read(bytes, { type: 'array', cellStyles: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const safe = (cell, val) => { if (!ws[cell]) ws[cell] = {}; ws[cell].v = val; ws[cell].t = typeof val === 'number' ? 'n' : 's' }
  const { header, students } = data
  if (formId === 'sf2') {
    safe('H1', header.schoolId); safe('S1', header.schoolYear); safe('AK1', header.month)
    safe('A2', header.schoolName); safe('S2', header.gradeLevel); safe('AE2', header.section)
    students.forEach((s, i) => { const r = i + 9; safe(`B${r}`, s.name); safe(`AD${r}`, s.totalAbsent || 0); safe(`AE${r}`, s.totalTardy || 0) })
  }
  if (formId === 'sf5') {
    safe('A2', header.schoolId); safe('F2', header.schoolYear); safe('A3', header.schoolName)
    safe('J3', header.gradeLevel); safe('M3', header.section)
    students.forEach((s, i) => { const r = i + 8; safe(`A${r}`, s.lrn); safe(`B${r}`, s.name); safe(`G${r}`, s.gwa ?? ''); safe(`H${r}`, s.action); safe(`I${r}`, s.failedAreas || '') })
  }
  return wb
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────
function getFormTemplate(formType) {
  const templates = load(TEMPLATES_KEY) || []
  return templates.find(t => t.type === formType) || null
}


function buildSF1Sheet(data) {
  const { header, students } = data
  const ws = {}
  setCell(ws, 'A1', 'School Form 1 (SF1) School Register', { bold:true, sz:12 })
  setCell(ws, 'A2', `Region: ${header.region}  |  Division: ${header.division}  |  District: ${header.district}  |  School ID: ${header.schoolId}`)
  setCell(ws, 'A3', `School Name: ${header.schoolName}  |  SY: ${header.schoolYear}  |  Grade: ${header.gradeLevel}  |  Section: ${header.section}`)

  const headers = [
    'No.', 'LRN', "Learner's Name (Last, First, Middle)", 'Sex', 'Birthdate (mm/dd/yyyy)',
    'Age (as of June)', 'IP/Ethnic Group', 'Religion',
    'House # / Street / Sitio / Purok', 'Barangay', 'Municipality / City', 'Province',
    "Father's Name (Last, First, Middle)", "Mother's Maiden Name (Last, First, Middle)",
    'Guardian (if not parent)', 'Relationship', 'Contact Number', 'Remarks'
  ]
  headers.forEach((h, i) => {
    setCell(ws, `${COL(i)}5`, h, { bold:true, align:'center', fill:HEADER_FILL, fontColor:'FFFFFF', border:true, wrap:true, sz:8 })
  })
  students.forEach((s, i) => {
    const r = i + 6
    setCell(ws, `A${r}`, i+1,                     { align:'center', border:true })
    setCell(ws, `B${r}`, s.lrn,                   { border:true })
    setCell(ws, `C${r}`, s.name,                  { border:true })
    setCell(ws, `D${r}`, s.sex,                   { align:'center', border:true })
    setCell(ws, `E${r}`, s.birthdate,             { align:'center', border:true })
    setCell(ws, `F${r}`, s.age !== '' ? Number(s.age) : '', { align:'center', border:true })
    setCell(ws, `G${r}`, s.ipGroup,               { border:true })
    setCell(ws, `H${r}`, s.religion,              { border:true })
    setCell(ws, `I${r}`, s.houseStreet,           { border:true })
    setCell(ws, `J${r}`, s.barangay,              { border:true })
    setCell(ws, `K${r}`, s.municipality,          { border:true })
    setCell(ws, `L${r}`, s.province,              { border:true })
    setCell(ws, `M${r}`, s.fatherName,            { border:true })
    setCell(ws, `N${r}`, s.motherName,            { border:true })
    setCell(ws, `O${r}`, s.guardianName,          { border:true })
    setCell(ws, `P${r}`, s.guardianRelationship,  { align:'center', border:true })
    setCell(ws, `Q${r}`, s.contactNumber,         { border:true })
    setCell(ws, `R${r}`, s.remarks,               { border:true })
  })
  ws['!ref'] = `A1:R${students.length + 5}`
  ws['!cols'] = [
    { wch:4  },  // No
    { wch:14 },  // LRN
    { wch:30 },  // Name
    { wch:4  },  // Sex
    { wch:12 },  // Birthdate
    { wch:6  },  // Age
    { wch:10 },  // IP Group
    { wch:12 },  // Religion
    { wch:22 },  // House/Street
    { wch:16 },  // Barangay
    { wch:18 },  // Municipality
    { wch:14 },  // Province
    { wch:24 },  // Father
    { wch:24 },  // Mother
    { wch:20 },  // Guardian
    { wch:10 },  // Relationship
    { wch:14 },  // Contact
    { wch:20 },  // Remarks
  ]
  return ws
}

export async function exportSF1(campusKey, gradeLevel, section, schoolYear) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'))
  const data = buildSF1Data(campusKey, gradeLevel, section, schoolYear)
  const tmpl = getFormTemplate('sf1')
  const wb   = tmpl?.fileData
    ? await fillTemplate(XLSX, tmpl.fileData, 'sf1', data)
    : (() => { const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, buildSF1Sheet(data), 'SF1'); return w })()
  XLSX.writeFile(wb, `SF1_${(gradeLevel||'').replace(/\W/g,'_')}_${(section||'').replace(/\W/g,'_')}_${schoolYear}.xlsx`)
  return data.students.length
}

export async function exportSF2(campusKey, gradeLevel, section, schoolYear, monthName) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'))
  const data = buildSF2Data(campusKey, gradeLevel, section, schoolYear, monthName)
  const tmpl = getFormTemplate('sf2')
  const wb   = tmpl?.fileData ? await fillTemplate(XLSX, tmpl.fileData, 'sf2', data) : (() => { const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, buildSF2Sheet(data), 'SF2'); return w })()
  XLSX.writeFile(wb, `SF2_${(gradeLevel||'').replace(/\W/g,'_')}_${(section||'').replace(/\W/g,'_')}_${monthName}_${schoolYear}.xlsx`)
  return data.students.length
}

export async function exportSF5(campusKey, gradeLevel, section, schoolYear) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'))
  const data = buildSF5Data(campusKey, gradeLevel, section, schoolYear)
  const tmpl = getFormTemplate('sf5')
  const wb   = tmpl?.fileData ? await fillTemplate(XLSX, tmpl.fileData, 'sf5', data) : (() => { const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, buildSF5Sheet(data), 'SF5'); return w })()
  XLSX.writeFile(wb, `SF5_${(gradeLevel||'').replace(/\W/g,'_')}_${(section||'').replace(/\W/g,'_')}_${schoolYear}.xlsx`)
  return data.students.length
}

export async function exportSF8(campusKey, gradeLevel, section, schoolYear) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'))
  const data = buildSF8Data(campusKey, gradeLevel, section, schoolYear)
  const tmpl = getFormTemplate('sf8')
  const wb   = tmpl?.fileData ? await fillTemplate(XLSX, tmpl.fileData, 'sf8', data) : (() => { const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, buildSF8Sheet(data), 'SF8'); return w })()
  XLSX.writeFile(wb, `SF8_${(gradeLevel||'').replace(/\W/g,'_')}_${(section||'').replace(/\W/g,'_')}_${schoolYear}.xlsx`)
  return data.students.length
}

export async function exportSF9(campusKey, gradeLevel, section, schoolYear) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'))
  const data = buildSF9Data(campusKey, gradeLevel, section, schoolYear)
  const tmpl = getFormTemplate('sf9')
  const wb   = tmpl?.fileData ? await fillTemplate(XLSX, tmpl.fileData, 'sf9', data) : (() => { const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, buildSF9Sheet(data), 'SF9'); return w })()
  XLSX.writeFile(wb, `SF9_${(gradeLevel||'').replace(/\W/g,'_')}_${(section||'').replace(/\W/g,'_')}_${schoolYear}.xlsx`)
  return data.students.length
}

export async function exportSF10(campusKey, gradeLevel, section, schoolYear) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'))
  const data = buildSF10Data(campusKey, gradeLevel, section, schoolYear)
  const tmpl = getFormTemplate('sf10')
  const wb   = tmpl?.fileData ? await fillTemplate(XLSX, tmpl.fileData, 'sf10', data) : (() => { const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, buildSF10Sheet(data), 'SF10'); return w })()
  XLSX.writeFile(wb, `SF10_${(gradeLevel||'').replace(/\W/g,'_')}_${(section||'').replace(/\W/g,'_')}_${schoolYear}.xlsx`)
  return data.students.length
}

export function hasTemplate(formId) {
  const templates = load(TEMPLATES_KEY) || []
  return templates.some(t => t.type === formId && t.fileData)
}