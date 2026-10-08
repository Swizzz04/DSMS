# ALMIRENE DX — Full Workflow Simulation Setup

## How it works

Both the school website and admin portal run under `localhost:5173`
(Vite's dev server) so they share the same localStorage.

Workflow:
  Student → fills enrollment form → submits
  → data saved to localStorage key: almirene_submissions
  → Admin portal reads it instantly in Enrollments page

---

## Folder structure

```
DSMS/                            ← your React admin portal
├── src/                         ← unchanged
├── public/
│   ├── assets/
│   │   ├── logo.png             ← copy from DSMS-Website/assets/
│   │   ├── logo1995.png
│   │   ├── talisay.jpg
│   │   ├── Carcar.jpg
│   │   └── Bohol.jpg
│   ├── index.html               ← copy from DSMS-Website/
│   ├── enrollment.html          ← copy from DSMS-Website/
│   ├── site_data.js             ← copy from DSMS-Website/
│   ├── site_render.js           ← copy from DSMS-Website/
│   ├── enrollment.js            ← copy from DSMS-Website/
│   ├── enrollmentBridge.website.js  ← copy from DSMS-Website/
│   ├── style.css                ← copy from DSMS-Website/
│   └── enrollment-style.css     ← copy from DSMS-Website/
└── ...

DSMS-Website/                    ← source of truth (standalone)
├── assets/
│   ├── logo.png
│   ├── logo1995.png
│   ├── talisay.jpg
│   ├── Carcar.jpg
│   └── Bohol.jpg
├── index.html
├── enrollment.html
├── site_data.js
├── site_render.js
├── enrollment.js
├── enrollmentBridge.website.js
├── style.css
└── enrollment-style.css
```

---

## To run the simulation

1. Copy DSMS-Website files into DSMS/public/ (as shown above)
2. Run: npm run dev
3. Open browser:
   - School website:    http://localhost:5173/index.html
   - Enrollment form:   http://localhost:5173/enrollment.html
   - Admin portal:      http://localhost:5173

## Workflow to test

1. Go to http://localhost:5173/enrollment.html
2. Fill out the form and submit
3. Open http://localhost:5173 and log in as:
   - accounting.carcar@school.edu.ph / accounting123
   → Go to Enrollments → see new submission with "Awaiting Payment"
   → Click Record Payment → fill in fee assessment
4. Log in as:
   - registrar.college.carcar@school.edu.ph / registrar123  (for college)
   - registrar.basic.carcar@school.edu.ph / registrar123  (for basic ed)
   → Go to Enrollments → see "Payment Received" submissions
   → Click Approve → enrollment becomes "Approved"
5. Log in as:
   - admin@school.edu.ph / admin123
   → Dashboard shows updated stats
   → Reports shows payment data

---

## Full account reference (verified against src/config/users.js)

- `admin@school.edu.ph` / `admin123` — School Owner
- `techadmin@school.edu.ph` / `techadmin123` — Technical Administrator
- `sysadmin.{carcar,talisay,bohol}@school.edu.ph` / `sysadmin123` — System Admin, one per campus
- `registrar.{basic,college}.{campus}@school.edu.ph` / `registrar123` — Registrar, one per campus per level
- `accounting.{campus}@school.edu.ph` / `accounting123` — Accounting Officer, one per campus
- `principal.{campus}@school.edu.ph` / `principal123` — Principal, one per campus
- `programhead.{campus}@school.edu.ph` / `principal123` — Program Head, one per campus
- `teacher.{lastname}@school.edu.ph` / `teacher123` — 8 teacher accounts across all campuses

**Note:** Bohol does not have a seeded college registrar or program head account.

---

## When backend is ready

Only ONE file changes: enrollmentBridge.website.js
Replace the localStorage.setItem call with:

  fetch('/api/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized)
  })

Everything else stays the same.

---

## Important: always edit files in DSMS-Website/
Never edit files directly in DSMS/public/ — they are copies.
When you change something in DSMS-Website/, copy it back to DSMS/public/.
