/**
 * mockPayments.js — expanded to cover all campuses, departments, and programs
 * All grade levels/programs are derived from appConfig (dynamic).
 */
import { CAMPUSES, BASIC_ED_GROUPS, COLLEGE_YEAR_LEVELS } from '../config/appConfig'

const campusName  = (key) => CAMPUSES.find(c => c.key === key)?.name ?? key
const basicGrade  = (groupIndex, optionIndex) => BASIC_ED_GROUPS[groupIndex]?.options[optionIndex] ?? 'Grade 1'
const collegeGrade = (campusKey, programIndex = 0, yearIndex = 0) => {
  const programs = CAMPUSES.find(c => c.key === campusKey)?.collegePrograms ?? []
  const program  = programs[programIndex] ?? programs[0]
  const year     = COLLEGE_YEAR_LEVELS[yearIndex] ?? COLLEGE_YEAR_LEVELS[0]
  return program ? `${program} - ${year}` : 'College'
}

let idCounter = 1
const mkPay = (studentId, studentName, gradeLevel, campus, totalFee, amountPaid, method, lastDate, dueDate, histories) => {
  const balance = totalFee - amountPaid
  const status  = balance === 0 ? 'paid' : new Date(dueDate) < new Date() && balance > 0 ? 'overdue' : amountPaid === 0 ? 'pending' : 'partial'
  return {
    id: idCounter++, studentId, studentName, gradeLevel, campus,
    totalFee, amountPaid, balance, status,
    paymentMethod: method,
    lastPaymentDate: lastDate,
    dueDate,
    paymentHistory: histories,
  }
}

export const mockPayments = [
  // ══════════════════════════════════════════════════════════════
  // TALISAY CAMPUS — Basic Education
  // ══════════════════════════════════════════════════════════════
  // Pre-Elementary
  mkPay('CSHC-2026-T001','Anna Dela Cruz',         basicGrade(0,0), campusName('Talisay'), 18000, 18000, 'Cash',          '2026-02-10T09:00:00','2026-03-15T00:00:00', [{id:1,amount:18000,method:'Cash',date:'2026-02-10T09:00:00',orNumber:'OR-T001',notes:'Full payment'}]),
  mkPay('CSHC-2026-T002','Leo Bautista',            basicGrade(0,1), campusName('Talisay'), 18000, 10000, 'GCash',         '2026-02-12T10:00:00','2026-03-20T00:00:00', [{id:1,amount:10000,method:'GCash',date:'2026-02-12T10:00:00',orNumber:'OR-T002',notes:'Partial payment'}]),
  mkPay('CSHC-2026-T003','Grace Santos',            basicGrade(0,2), campusName('Talisay'), 18000, 0,     null,            null,                 '2026-03-10T00:00:00', []),
  // Elementary
  mkPay('CSHC-2026-T004','Mark Reyes',              basicGrade(1,0), campusName('Talisay'), 25000, 25000, 'Bank Transfer', '2026-02-08T11:00:00','2026-03-01T00:00:00', [{id:1,amount:25000,method:'Bank Transfer',date:'2026-02-08T11:00:00',orNumber:'OR-T004',notes:'Full payment'}]),
  mkPay('CSHC-2026-T005','Liza Morales',            basicGrade(1,1), campusName('Talisay'), 25000, 12500, 'Cash',          '2026-02-14T09:00:00','2026-03-20T00:00:00', [{id:1,amount:12500,method:'Cash',date:'2026-02-14T09:00:00',orNumber:'OR-T005',notes:'50% down payment'}]),
  mkPay('CSHC-2026-T006','Rico Fernandez',          basicGrade(1,2), campusName('Talisay'), 25000, 25000, 'GCash',         '2026-01-20T14:00:00','2026-02-15T00:00:00', [{id:1,amount:25000,method:'GCash',date:'2026-01-20T14:00:00',orNumber:'OR-T006',notes:'Full payment'}]),
  mkPay('CSHC-2026-T007','Nina Castillo',           basicGrade(1,3), campusName('Talisay'), 25000, 25000, 'Cash',          '2026-02-05T10:00:00','2026-03-01T00:00:00', [{id:1,amount:25000,method:'Cash',date:'2026-02-05T10:00:00',orNumber:'OR-T007',notes:'Full payment'}]),
  mkPay('CSHC-2026-T008','Pio Villanueva',          basicGrade(1,4), campusName('Talisay'), 27000, 0,     null,            null,                 '2026-02-10T00:00:00', []),
  mkPay('CSHC-2026-T009','Cleo Aguilar',            basicGrade(1,5), campusName('Talisay'), 27000, 27000, 'Bank Transfer', '2026-02-01T08:00:00','2026-03-01T00:00:00', [{id:1,amount:27000,method:'Bank Transfer',date:'2026-02-01T08:00:00',orNumber:'OR-T009',notes:'Full payment'}]),
  // JHS
  mkPay('CSHC-2026-T010','Sofia Torres Ramos',      basicGrade(2,0), campusName('Talisay'), 42000, 20000, 'Bank Transfer', '2026-02-28T09:00:00','2026-03-20T00:00:00', [{id:1,amount:20000,method:'Bank Transfer',date:'2026-02-28T09:00:00',orNumber:'OR-T010',notes:'Down payment'}]),
  mkPay('CSHC-2025-T156','Juan Santos Dela Cruz',   basicGrade(2,3), campusName('Talisay'), 48000, 48000, 'GCash',         '2026-01-15T11:00:00','2026-02-01T00:00:00', [{id:1,amount:48000,method:'GCash',date:'2026-01-15T11:00:00',orNumber:'OR-T156',notes:'Full payment'}]),
  mkPay('CSHC-2026-T011','Carlo Mendez',            basicGrade(2,1), campusName('Talisay'), 42000, 42000, 'Cash',          '2026-02-10T10:00:00','2026-03-01T00:00:00', [{id:1,amount:42000,method:'Cash',date:'2026-02-10T10:00:00',orNumber:'OR-T011',notes:'Full payment'}]),
  mkPay('CSHC-2026-T012','Ana Cruz Reyes',          basicGrade(2,2), campusName('Talisay'), 44000, 0,     null,            null,                 '2026-03-10T00:00:00', []),
  // SHS
  mkPay('CSHC-2026-T013','Ben Ocampo',              basicGrade(3,0), campusName('Talisay'), 55000, 55000, 'Bank Transfer', '2026-02-03T09:00:00','2026-03-01T00:00:00', [{id:1,amount:55000,method:'Bank Transfer',date:'2026-02-03T09:00:00',orNumber:'OR-T013',notes:'Full payment'}]),
  mkPay('CSHC-2026-T014','Lea Gutierrez',           basicGrade(3,1), campusName('Talisay'), 55000, 27500, 'Cash',          '2026-02-15T13:00:00','2026-03-20T00:00:00', [{id:1,amount:27500,method:'Cash',date:'2026-02-15T13:00:00',orNumber:'OR-T014',notes:'50% payment'}]),

  // ══════════════════════════════════════════════════════════════
  // TALISAY CAMPUS — College
  // ══════════════════════════════════════════════════════════════
  // BS Nursing
  mkPay('CSHC-2026-T020','Rosa Villanueva',         collegeGrade('Talisay',0,1), campusName('Talisay'), 88000, 88000, 'GCash',         '2026-01-20T09:00:00','2026-02-01T00:00:00', [{id:1,amount:88000,method:'GCash',date:'2026-01-20T09:00:00',orNumber:'OR-T020',notes:'Full payment'}]),
  mkPay('CSHC-2026-T021','Mia Santos',              collegeGrade('Talisay',0,0), campusName('Talisay'), 85000, 42500, 'Bank Transfer', '2026-02-20T10:00:00','2026-03-30T00:00:00', [{id:1,amount:42500,method:'Bank Transfer',date:'2026-02-20T10:00:00',orNumber:'OR-T021',notes:'50% down payment'}]),
  mkPay('CSHC-2026-T022','Nico Rivera',             collegeGrade('Talisay',0,2), campusName('Talisay'), 90000, 90000, 'Cash',          '2026-02-01T08:00:00','2026-03-01T00:00:00', [{id:1,amount:90000,method:'Cash',date:'2026-02-01T08:00:00',orNumber:'OR-T022',notes:'Full payment'}]),
  mkPay('CSHC-2025-T201','Dan Aquino',              collegeGrade('Talisay',0,3), campusName('Talisay'), 92000, 50000, 'Cash',          '2026-01-10T11:00:00','2026-02-28T00:00:00', [{id:1,amount:50000,method:'Cash',date:'2026-01-10T11:00:00',orNumber:'OR-T201',notes:'Partial payment'}]),
  // BS HRM
  mkPay('CSHC-2026-T030','Tina Cruz',               collegeGrade('Talisay',1,0), campusName('Talisay'), 72000, 72000, 'GCash',         '2026-02-10T09:00:00','2026-03-01T00:00:00', [{id:1,amount:72000,method:'GCash',date:'2026-02-10T09:00:00',orNumber:'OR-T030',notes:'Full payment'}]),
  mkPay('CSHC-2026-T031','Ray Flores',              collegeGrade('Talisay',1,1), campusName('Talisay'), 70000, 35000, 'Bank Transfer', '2026-02-18T10:00:00','2026-03-30T00:00:00', [{id:1,amount:35000,method:'Bank Transfer',date:'2026-02-18T10:00:00',orNumber:'OR-T031',notes:'50% payment'}]),
  mkPay('CSHC-2026-T032','Joy Navarro',             collegeGrade('Talisay',1,2), campusName('Talisay'), 74000, 74000, 'Cash',          '2026-01-25T14:00:00','2026-02-15T00:00:00', [{id:1,amount:74000,method:'Cash',date:'2026-01-25T14:00:00',orNumber:'OR-T032',notes:'Full payment'}]),
  mkPay('CSHC-2025-T301','Sam Dela Rosa',           collegeGrade('Talisay',1,3), campusName('Talisay'), 76000, 0,     null,            null,                 '2026-02-20T00:00:00', []),
  // BS Tourism
  mkPay('CSHC-2026-T040','Bea Lim',                collegeGrade('Talisay',2,0), campusName('Talisay'), 68000, 68000, 'GCash',         '2026-02-05T10:00:00','2026-03-01T00:00:00', [{id:1,amount:68000,method:'GCash',date:'2026-02-05T10:00:00',orNumber:'OR-T040',notes:'Full payment'}]),
  mkPay('CSHC-2026-T041','Kurt Pascual',            collegeGrade('Talisay',2,1), campusName('Talisay'), 66000, 33000, 'Cash',          '2026-02-22T09:00:00','2026-03-30T00:00:00', [{id:1,amount:33000,method:'Cash',date:'2026-02-22T09:00:00',orNumber:'OR-T041',notes:'Partial payment'}]),
  mkPay('CSHC-2026-T042','Mae Soriano',             collegeGrade('Talisay',2,2), campusName('Talisay'), 70000, 70000, 'Bank Transfer', '2026-01-30T13:00:00','2026-02-20T00:00:00', [{id:1,amount:70000,method:'Bank Transfer',date:'2026-01-30T13:00:00',orNumber:'OR-T042',notes:'Full payment'}]),

  // ══════════════════════════════════════════════════════════════
  // CARCAR CAMPUS — Basic Education
  // ══════════════════════════════════════════════════════════════
  // Pre-Elementary
  mkPay('CSHC-2026-C001','Maria Garcia Santos',     basicGrade(0,0), campusName('Carcar'), 17000, 17000, 'Cash',          '2026-02-27T10:00:00','2026-03-15T00:00:00', [{id:1,amount:17000,method:'Cash',date:'2026-02-27T10:00:00',orNumber:'OR-C001',notes:'Full payment'}]),
  mkPay('CSHC-2026-C002','Jose Macaraeg',           basicGrade(0,1), campusName('Carcar'), 17000, 8500,  'GCash',         '2026-02-20T10:00:00','2026-03-25T00:00:00', [{id:1,amount:8500,method:'GCash',date:'2026-02-20T10:00:00',orNumber:'OR-C002',notes:'50% payment'}]),
  // Elementary
  mkPay('CSHC-2026-C003','Luz Espiritu',            basicGrade(1,1), campusName('Carcar'), 24000, 24000, 'Bank Transfer', '2026-02-10T11:00:00','2026-03-01T00:00:00', [{id:1,amount:24000,method:'Bank Transfer',date:'2026-02-10T11:00:00',orNumber:'OR-C003',notes:'Full payment'}]),
  mkPay('CSHC-2026-C004','Ryan Padilla',            basicGrade(1,3), campusName('Carcar'), 24000, 12000, 'Cash',          '2026-02-15T09:00:00','2026-03-20T00:00:00', [{id:1,amount:12000,method:'Cash',date:'2026-02-15T09:00:00',orNumber:'OR-C004',notes:'Partial'}]),
  mkPay('CSHC-2026-C005','Mae Tolentino',           basicGrade(1,5), campusName('Carcar'), 26000, 26000, 'GCash',         '2026-02-01T14:00:00','2026-03-01T00:00:00', [{id:1,amount:26000,method:'GCash',date:'2026-02-01T14:00:00',orNumber:'OR-C005',notes:'Full payment'}]),
  // JHS
  mkPay('CSHC-2026-C006','Lito Buenaventura',       basicGrade(2,0), campusName('Carcar'), 40000, 40000, 'Cash',          '2026-02-05T10:00:00','2026-03-01T00:00:00', [{id:1,amount:40000,method:'Cash',date:'2026-02-05T10:00:00',orNumber:'OR-C006',notes:'Full payment'}]),
  mkPay('CSHC-2026-C007','Alma Santiago',           basicGrade(2,2), campusName('Carcar'), 40000, 20000, 'Bank Transfer', '2026-02-18T09:00:00','2026-03-25T00:00:00', [{id:1,amount:20000,method:'Bank Transfer',date:'2026-02-18T09:00:00',orNumber:'OR-C007',notes:'50% payment'}]),
  mkPay('CSHC-2026-C008','Vic Magno',               basicGrade(2,3), campusName('Carcar'), 42000, 0,     null,            null,                 '2026-03-10T00:00:00', []),
  // SHS
  mkPay('CSHC-2026-C009','Eva Domingo',             basicGrade(3,0), campusName('Carcar'), 52000, 52000, 'GCash',         '2026-02-10T11:00:00','2026-03-01T00:00:00', [{id:1,amount:52000,method:'GCash',date:'2026-02-10T11:00:00',orNumber:'OR-C009',notes:'Full payment'}]),
  mkPay('CSHC-2025-C156','Pedro Lopez Garcia',      basicGrade(3,1), campusName('Carcar'), 52000, 30000, 'Cash',          '2025-12-10T10:00:00','2026-02-15T00:00:00', [{id:1,amount:15000,method:'Cash',date:'2025-11-20T10:00:00',orNumber:'OR-C156a',notes:'Initial'},{id:2,amount:15000,method:'Cash',date:'2025-12-10T10:00:00',orNumber:'OR-C156b',notes:'2nd installment'}]),

  // ══════════════════════════════════════════════════════════════
  // CARCAR CAMPUS — College (BS Criminology)
  // ══════════════════════════════════════════════════════════════
  mkPay('CSHC-2026-C020','Carlo Mendoza Bautista',  collegeGrade('Carcar',0,0), campusName('Carcar'), 85000, 40000, 'Bank Transfer', '2026-02-28T15:00:00','2026-03-30T00:00:00', [{id:1,amount:40000,method:'Bank Transfer',date:'2026-02-28T15:00:00',orNumber:'OR-C020',notes:'Down payment'}]),
  mkPay('CSHC-2026-C021','Elena Marquez',           collegeGrade('Carcar',0,1), campusName('Carcar'), 87000, 87000, 'GCash',         '2026-01-25T10:00:00','2026-02-15T00:00:00', [{id:1,amount:87000,method:'GCash',date:'2026-01-25T10:00:00',orNumber:'OR-C021',notes:'Full payment'}]),
  mkPay('CSHC-2025-C201','Ryan Corpus',             collegeGrade('Carcar',0,2), campusName('Carcar'), 89000, 44500, 'Cash',          '2026-02-10T09:00:00','2026-03-20T00:00:00', [{id:1,amount:44500,method:'Cash',date:'2026-02-10T09:00:00',orNumber:'OR-C201',notes:'50% payment'}]),
  mkPay('CSHC-2024-C301','Gina Ramos',              collegeGrade('Carcar',0,3), campusName('Carcar'), 91000, 91000, 'Bank Transfer', '2026-01-15T14:00:00','2026-02-01T00:00:00', [{id:1,amount:91000,method:'Bank Transfer',date:'2026-01-15T14:00:00',orNumber:'OR-C301',notes:'Full payment'}]),

  // ══════════════════════════════════════════════════════════════
  // BOHOL CAMPUS — Basic Education only
  // ══════════════════════════════════════════════════════════════
  // Pre-Elementary
  mkPay('CSHC-2026-B001','Amy Concepcion',          basicGrade(0,0), campusName('Bohol'), 16000, 16000, 'Cash',          '2026-02-12T09:00:00','2026-03-15T00:00:00', [{id:1,amount:16000,method:'Cash',date:'2026-02-12T09:00:00',orNumber:'OR-B001',notes:'Full payment'}]),
  mkPay('CSHC-2026-B002','Luis Salas',              basicGrade(0,1), campusName('Bohol'), 16000, 8000,  'GCash',         '2026-02-20T10:00:00','2026-03-25T00:00:00', [{id:1,amount:8000,method:'GCash',date:'2026-02-20T10:00:00',orNumber:'OR-B002',notes:'Partial'}]),
  // Elementary
  mkPay('CSHC-2026-B003','Clara Ybañez',            basicGrade(1,0), campusName('Bohol'), 22000, 22000, 'Bank Transfer', '2026-02-05T11:00:00','2026-03-01T00:00:00', [{id:1,amount:22000,method:'Bank Transfer',date:'2026-02-05T11:00:00',orNumber:'OR-B003',notes:'Full payment'}]),
  mkPay('CSHC-2026-B004','Efren Regala',            basicGrade(1,2), campusName('Bohol'), 22000, 11000, 'Cash',          '2026-02-18T09:00:00','2026-03-20T00:00:00', [{id:1,amount:11000,method:'Cash',date:'2026-02-18T09:00:00',orNumber:'OR-B004',notes:'50% payment'}]),
  mkPay('CSHC-2026-B005','Helen Gabat',             basicGrade(1,4), campusName('Bohol'), 23000, 23000, 'GCash',         '2026-01-28T14:00:00','2026-02-20T00:00:00', [{id:1,amount:23000,method:'GCash',date:'2026-01-28T14:00:00',orNumber:'OR-B005',notes:'Full payment'}]),
  // JHS
  mkPay('CSHC-2026-B006','Ramon Torres',            basicGrade(2,0), campusName('Bohol'), 38000, 38000, 'Cash',          '2026-02-08T10:00:00','2026-03-01T00:00:00', [{id:1,amount:38000,method:'Cash',date:'2026-02-08T10:00:00',orNumber:'OR-B006',notes:'Full payment'}]),
  mkPay('CSHC-2026-B007','Nora Alcantara',          basicGrade(2,1), campusName('Bohol'), 38000, 19000, 'Bank Transfer', '2026-02-22T09:00:00','2026-03-25T00:00:00', [{id:1,amount:19000,method:'Bank Transfer',date:'2026-02-22T09:00:00',orNumber:'OR-B007',notes:'50% payment'}]),
  // SHS
  mkPay('CSHC-2024-B089','Pedro Lopez Garcia',      basicGrade(3,1), campusName('Bohol'), 52000, 30000, 'Cash',          '2025-12-10T10:00:00','2026-02-15T00:00:00', [{id:1,amount:15000,method:'Cash',date:'2025-11-20T10:00:00',orNumber:'OR-B089a',notes:'Initial'},{id:2,amount:15000,method:'Cash',date:'2025-12-10T10:00:00',orNumber:'OR-B089b',notes:'2nd installment'}]),
  mkPay('CSHC-2026-B008','Faye Magbanua',           basicGrade(3,0), campusName('Bohol'), 50000, 50000, 'GCash',         '2026-02-12T11:00:00','2026-03-01T00:00:00', [{id:1,amount:50000,method:'GCash',date:'2026-02-12T11:00:00',orNumber:'OR-B008',notes:'Full payment'}]),
]