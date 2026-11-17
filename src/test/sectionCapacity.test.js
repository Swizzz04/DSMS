import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SECTION_CAPACITY, MAX_SECTION_CAPACITY, normalizeCapacity, getSectionCapacity,
} from '../config/appConfig'
import {
  toSectionRecords, countBySection, sectionStatuses, overCapacity, canAssign,
} from '../utils/sectionCapacity'

describe('normalizeCapacity', () => {
  it.each([[40, 40], ['35', 35], [' 12 ', 12], [1, 1], [200, 200]])('%s -> %s', (i, o) => {
    expect(normalizeCapacity(i)).toBe(o)
  })
  it.each([[0], [-5], [201], ['abc'], ['4.5'], [''], [null], [undefined], ['1e2']])('%s is not valid', (i) => {
    expect(normalizeCapacity(i)).toBeNull()
  })
  it('the limits are 1 and 200', () => {
    expect(normalizeCapacity(MAX_SECTION_CAPACITY + 1)).toBeNull()
  })
})

describe('getSectionCapacity: own number, then campus default, then 40', () => {
  const cfg = {
    Carcar: { capacity: { 'Grade 7': 35, 'BS Nursing - 1st Year': 25 }, defaultCapacity: 45 },
    Talisay: {},
  }
  it('uses the level\'s own number', () => {
    expect(getSectionCapacity('Carcar', 'Grade 7', cfg)).toBe(35)
    expect(getSectionCapacity('Carcar', 'BS Nursing - 1st Year', cfg)).toBe(25)
  })
  it('falls back to the campus default for a level with no number', () => {
    expect(getSectionCapacity('Carcar', 'Grade 8', cfg)).toBe(45)
  })
  it('falls back to 40 when the campus has nothing saved', () => {
    expect(getSectionCapacity('Talisay', 'Grade 7', cfg)).toBe(DEFAULT_SECTION_CAPACITY)
    expect(getSectionCapacity('Unknown', 'Grade 7', cfg)).toBe(40)
    expect(getSectionCapacity('Carcar', 'Grade 7', undefined)).toBe(40)
  })
  it('ignores a bad saved value instead of breaking', () => {
    expect(getSectionCapacity('X', 'Grade 7', { X: { capacity: { 'Grade 7': 'lots' }, defaultCapacity: 0 } })).toBe(40)
  })
  it('campuses do not share numbers', () => {
    expect(getSectionCapacity('Talisay', 'Grade 7', cfg)).not.toBe(getSectionCapacity('Carcar', 'Grade 7', cfg))
  })
})

const rec = (section, extra = {}) => ({
  campus: 'Carcar City Campus', gradeLevel: 'Grade 7', schoolYear: '2026-2027', section, status: 'approved', ...extra,
})

describe('countBySection (D4: assigned students, same campus, level and school year)', () => {
  const records = [
    rec('A'), rec('A'), rec('B'),
    rec('A', { status: 'withdrawn' }),                  // never takes a seat
    rec('A', { status: 'rejected' }),
    rec('A', { schoolYear: '2025-2026' }),              // last year
    rec('A', { gradeLevel: 'Grade 8' }),                // other level
    rec('A', { campus: 'Talisay Campus' }),             // other campus
    rec(''),                                            // no section yet
  ]
  it('counts only the right students', () => {
    expect(countBySection(records, { campus: 'Carcar City Campus', level: 'Grade 7', schoolYear: '2026-2027' }))
      .toEqual({ A: 2, B: 1 })
  })
  it('turns submissions into records', () => {
    const subs = [{ status: 'approved', enrollment: { campus: 'C', gradeLevel: 'Grade 7', schoolYear: '2026-2027', section: 'A' } }]
    expect(toSectionRecords(subs)).toEqual([{ campus: 'C', gradeLevel: 'Grade 7', schoolYear: '2026-2027', section: 'A', status: 'approved' }])
  })
})

describe('sectionStatuses / canAssign (a full section blocks, a student already in it stays)', () => {
  const counts = { A: 40, B: 12, C: 44 }
  it('marks full and over', () => {
    const s = sectionStatuses(['A', 'B', 'C'], counts, 40)
    expect(s.find(x => x.name === 'A')).toMatchObject({ full: true, over: false, seatsLeft: 0 })
    expect(s.find(x => x.name === 'B')).toMatchObject({ full: false, over: false, seatsLeft: 28 })
    expect(s.find(x => x.name === 'C')).toMatchObject({ full: true, over: true, seatsLeft: 0 })
  })
  it('the student\'s own section is never full for them', () => {
    expect(sectionStatuses(['A'], counts, 40, 'A')[0].full).toBe(false)
  })
  it('canAssign blocks a full section, allows room, staying put and clearing', () => {
    expect(canAssign(counts, 40, 'A')).toBe(false)
    expect(canAssign(counts, 40, 'B')).toBe(true)
    expect(canAssign(counts, 40, 'C', 'C')).toBe(true)
    expect(canAssign(counts, 40, '', 'A')).toBe(true)
    expect(canAssign({}, 40, 'A')).toBe(true)
  })
  it('lowering the limit below the head count leaves students alone but blocks new ones (D3)', () => {
    expect(canAssign({ A: 30 }, 25, 'A')).toBe(false)
    expect(canAssign({ A: 30 }, 25, 'A', 'A')).toBe(true)
    expect(overCapacity(['A', 'B'], { A: 30, B: 5 }, 25)).toEqual([{ name: 'A', count: 30, capacity: 25 }])
  })
  it('overCapacity also finds sections that are not in the name list', () => {
    expect(overCapacity([], { 'Grade 7-C': 50 }, 40)).toEqual([{ name: 'Grade 7-C', count: 50, capacity: 40 }])
  })
})

// ── Subject Load generates sections from the per-level seats (6.1 step 3) ──────────────────────────
import { getConfiguredCapacity } from '../config/appConfig'
import { getSubjectLoadData } from '../utils/subjectLoadBridge'

describe('getConfiguredCapacity: null when nothing is set (so the old saved max still applies)', () => {
  it('own number, then campus default, else null', () => {
    const cfg = { Carcar: { capacity: { 'Grade 7': 30 }, defaultCapacity: 45 } }
    expect(getConfiguredCapacity('Carcar', 'Grade 7', cfg)).toBe(30)
    expect(getConfiguredCapacity('Carcar', 'Grade 8', cfg)).toBe(45)
    expect(getConfiguredCapacity('Carcar', 'Grade 8', { Carcar: {} })).toBeNull()
    expect(getConfiguredCapacity('Other', 'Grade 8', cfg)).toBeNull()
  })
})

describe('section generation uses seats per level', () => {
  const CAMPUS = 'Carcar City Campus'
  const enrol = (n, gradeLevel) => Array.from({ length: n }, (_, i) => ({
    id: `${gradeLevel}-${i}`, status: 'approved', enrollment: { campus: CAMPUS, gradeLevel },
  }))
  const setup = (subs) => { localStorage.clear(); localStorage.setItem('almirene_submissions', JSON.stringify(subs)) }
  const load = (cap, year = '2026-2027') => getSubjectLoadData('Carcar', year, CAMPUS, [], undefined, undefined, cap)

  it('each level splits by its own seats: Grade 7 at 2 gets 3 sections, Grade 8 at 10 gets 1', () => {
    setup([...enrol(5, 'Grade 7'), ...enrol(5, 'Grade 8')])
    const d = load(level => ({ 'Grade 7': 2, 'Grade 8': 10 }[level] ?? null))
    expect(d.basicEdSections['Grade 7']).toHaveLength(3)
    expect(d.basicEdSections['Grade 8']).toHaveLength(1)
  })
  it('a level with no seats set falls back to the old saved max, then 40', () => {
    setup(enrol(50, 'Grade 7'))
    expect(load(() => null).basicEdSections['Grade 7']).toHaveLength(2)          // 50 students, 40 seats
    const all = JSON.parse(localStorage.getItem('almirene_subject_loads'))
    all.Carcar['2026-2027'].maxPerSection = 25
    localStorage.setItem('almirene_subject_loads', JSON.stringify(all))
    expect(load(() => null).basicEdSections['Grade 7']).toHaveLength(2)          // 50 students, old max 25
  })
  it('seats from Settings win over the old saved max', () => {
    setup(enrol(50, 'Grade 7'))
    load(() => null)
    const all = JSON.parse(localStorage.getItem('almirene_subject_loads'))
    all.Carcar['2026-2027'].maxPerSection = 5
    localStorage.setItem('almirene_subject_loads', JSON.stringify(all))
    expect(load(() => 50).basicEdSections['Grade 7']).toHaveLength(1)
  })
  it('a section keeps its id when seats change but the section still exists', () => {
    setup(enrol(50, 'Grade 7'))
    const first = load(() => 25).basicEdSections['Grade 7'].map(s => s.id)
    const again = load(() => 30).basicEdSections['Grade 7'].map(s => s.id)
    expect(again).toEqual(first)
  })
})
