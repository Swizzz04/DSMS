export const SYSTEM_USERS = [
  {
    id: 1, name: 'School Owner',
    email: 'admin@cshc.edu.ph',
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    role: 'admin', campus: 'all', status: 'active', lastLogin: '2026-03-05T10:30:00',
  },
  {
    // Technical Administrator — full system access
    // Email: techadmin@cshc.edu.ph  Password: techadmin123
    id: 17, name: 'Technical Administrator',
    email: 'techadmin@cshc.edu.ph',
    passwordHash: '06b1a9074f0294f16e452d437b6d5ef1072de4080c67a11924cb6256f0a3768b',
    role: 'technical_admin', campus: 'all', status: 'active', lastLogin: null,
  },
  // ── System Admins (campus-locked) ─────────────────────────────
  {
    // System Admin — Carcar campus IT
    // Email: sysadmin.carcar@cshc.edu.ph  Password: sysadmin123
    id: 30, name: 'Carcar System Admin',
    email: 'sysadmin.carcar@cshc.edu.ph',
    passwordHash: 'beca88f0e2c27d8d8c093bd80b2f7f6245466f97b00f3cc8c78ca4049278cc9a',
    role: 'system_admin', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    // System Admin — Talisay campus IT
    // Email: sysadmin.talisay@cshc.edu.ph  Password: sysadmin123
    id: 31, name: 'Talisay System Admin',
    email: 'sysadmin.talisay@cshc.edu.ph',
    passwordHash: 'beca88f0e2c27d8d8c093bd80b2f7f6245466f97b00f3cc8c78ca4049278cc9a',
    role: 'system_admin', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  {
    // System Admin — Bohol campus IT
    // Email: sysadmin.bohol@cshc.edu.ph  Password: sysadmin123
    id: 32, name: 'Bohol System Admin',
    email: 'sysadmin.bohol@cshc.edu.ph',
    passwordHash: 'beca88f0e2c27d8d8c093bd80b2f7f6245466f97b00f3cc8c78ca4049278cc9a',
    role: 'system_admin', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
  // ── Talisay ─────────────────────────────────────────────────────
  {
    id: 2, name: 'Talisay Basic Ed Registrar',
    email: 'registrar.basic@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_basic', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: '2026-03-05T09:15:00',
  },
  {
    id: 3, name: 'Talisay College Registrar',
    email: 'registrar.college.talisay@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_college', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: '2026-03-04T14:20:00',
  },
  {
    id: 9, name: 'Talisay Accounting Officer',
    email: 'accounting.talisay@cshc.edu.ph',
    passwordHash: 'e33aaf52d546e1633eb40bf31a738dfd24e67d25ae44ada3d793464324b5bc97',
    role: 'accounting', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  {
    id: 12, name: 'Talisay Principal',
    email: 'principal.talisay@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'principal_basic', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  {
    id: 13, name: 'Talisay Program Head',
    email: 'programhead.talisay@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'program_head', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  // ── Carcar ──────────────────────────────────────────────────────
  {
    id: 7, name: 'Carcar Basic Ed Registrar',
    email: 'registrar.basic.carcar@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_basic', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: '2026-03-04T08:30:00',
  },
  {
    id: 6, name: 'Carcar College Registrar',
    email: 'registrar.college@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_college', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: '2026-03-04T14:20:00',
  },
  {
    id: 10, name: 'Carcar Accounting Officer',
    email: 'accounting.carcar@cshc.edu.ph',
    passwordHash: 'e33aaf52d546e1633eb40bf31a738dfd24e67d25ae44ada3d793464324b5bc97',
    role: 'accounting', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 14, name: 'Carcar Principal',
    email: 'principal.carcar@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'principal_basic', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 15, name: 'Carcar Program Head',
    email: 'programhead.carcar@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'program_head', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  // ── Bohol ───────────────────────────────────────────────────────
  {
    id: 8, name: 'Bohol Basic Ed Registrar',
    email: 'registrar.basic.bohol@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_basic', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: '2026-03-03T07:45:00',
  },
  {
    id: 11, name: 'Bohol Accounting Officer',
    email: 'accounting.bohol@cshc.edu.ph',
    passwordHash: 'e33aaf52d546e1633eb40bf31a738dfd24e67d25ae44ada3d793464324b5bc97',
    role: 'accounting', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
  {
    id: 16, name: 'Bohol Principal',
    email: 'principal.bohol@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'principal_basic', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
  // ── Teacher accounts (all campuses) ────────────────────────────
  // Password for all: teacher123
  // SHA-256 of 'teacher123': cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416
  // Carcar teachers
  {
    id: 19, name: 'Maria Santos',
    email: 'teacher.santos@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 20, name: 'Juan dela Cruz',
    email: 'teacher.delacruz@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 21, name: 'Ana Reyes',
    email: 'teacher.reyes@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 22, name: 'Pedro Bautista',
    email: 'teacher.bautista@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  // Talisay teachers
  {
    id: 40, name: 'Rosa Fernandez',
    email: 'teacher.fernandez@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  {
    id: 41, name: 'Carlos Mendoza',
    email: 'teacher.mendoza@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  // Bohol teachers
  {
    id: 42, name: 'Elena Villanueva',
    email: 'teacher.villanueva@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
  {
    id: 43, name: 'Ramon Espinosa',
    email: 'teacher.espinosa@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
]
