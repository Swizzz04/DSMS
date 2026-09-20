# ALMIRENE DX (DSMS) — Project Status & Priorities

> Keep this file updated. Any new conversation/agent should read this first
> before touching code — it's the source of truth for where the project stands.

Last updated: July 28, 2026

---

## Project Identity

- **Name**: ALMIRENE DX (also called DSMS — Dynamic School Management System)
- **Type**: White-label SaaS school management platform, targeting Philippine
  private schools
- **Repo**: `github.com/Swizzz04/DSMS`, branch `development`
- **Local path**: `C:\Users\LENOVO\Downloads\DSMS`
- **Team**: Jhon (frontend — React) + collaborator (backend — ASP.NET Core 8)
- **Frontend stack**: React 19 + Vite + Tailwind CSS
- **Backend**: ASP.NET Core 8 (JWT-based auth, `POST /api/auth/login`)
- **Predecessor project**: CSHC Admin Portal (built for Cebu Sacred Heart
  College, localStorage-based) — DSMS is the generalized/white-label evolution
  of that codebase.

## Core Architecture Principles (do not violate these)

1. **Nothing school-specific hardcoded** — all school/campus/department names,
   fees, grading rules, etc. come from config, not literals in components.
2. **All computation lives in pure engine functions** — config passed in as
   parameters. Engines live in `src/engines/` (e.g. `gradingEngine.js`,
   `attendanceEngine.js`, `workflowEngine.js`).
3. **All data operations go through bridge files** in `src/utils/` (e.g.
   `enrollmentBridge.js`) — no direct localStorage/API calls scattered in
   components.
4. **All workflow/state transitions go through `workflowEngine.js`** — not
   ad hoc status changes in page components.
5. **Module access is always via `perms.canAccess(user, moduleKey, action)`**
   — never raw `user.role === '...'` checks. *(Currently violated — see
   Priority 1 below.)*
6. **All design tokens live in CSS variables** — consistent with Tailwind
   config, dark mode always has a `dark:` variant.

Build order originally planned: Phase 0 (workflow engine) → Phase 1 (grading)
→ Phase 2 (operations) → Phase 3 (automation) → Phase 4 (portals/notifications).

## Current Priorities (in order)

### 1. Build the shared `perms.js` access-control engine
**Why**: `RolePermissionsTab.jsx` (settings UI) already exists and lets an
admin configure role permissions — but it does nothing. There is **zero**
usage of `canAccess()` anywhere in the codebase. Instead there are **88 raw
`user.role === '...'` checks** scattered across 11 files:

| File | Raw role checks |
|---|---|
| `Enrollments.jsx` | 23 |
| `Students.jsx` | 20 |
| `Dashboard.jsx` | 12 |
| `SchoolComponents.jsx` | 14 |
| `NotificationPanel.jsx` | 8 |
| `Payments.jsx` | 3 |
| `AuthContext.jsx` | 3 |
| `Settings.jsx` | 2 |
| `Header.jsx`, `Eclassrecord.jsx`, `Reports.jsx` | 1 each |

**Plan**:
1. Build `perms.js` as a pure engine: `canAccess(user, moduleKey, action)`,
   config-driven from whatever `RolePermissionsTab.jsx` writes. No hardcoded
   role names inside the engine itself.
2. Wire it into **`Enrollments.jsx` first** as proof (highest raw-check count).
3. Test as **both** super admin and a restricted role — super-admin-only
   testing won't validate this, since it IS the restriction layer.
4. Mechanically sweep remaining files, swapping raw checks for `canAccess()`.

### 2. Make the grading system DepEd-compliant and configurable
**Why**: DepEd Order No. 9, s. 2026 shifted Philippine basic education from a
4-quarter to a 3-term (trimester) calendar starting SY 2026-2027, with a
stricter transmutation table (raw score 70–72.99 → 75, previously raw 60 →
75). Full **zero-based grading** (no transmutation at all) is planned for SY
2027-2028.

**Current state**: `TRANSMUTATION_TABLE` in `src/engines/gradingEngine.js` is
a **hardcoded array** of `[minInitial, maxInitial, transmutedGrade]` triplets
— violates architecture principle #1/#2 above, and means every future DepEd
policy change requires an engine code change instead of a config change.

**Plan**:
- Move `TRANSMUTATION_TABLE` into config (per-school or per-department —
  private schools may run quarterly for college programs while going
  trimester for basic ed).
- Add a `gradingPeriodType` config value (`'quarterly' | 'trimester'`) in
  `appConfig.js` — `gradingEngine.js` reads this to determine period count
  and weighting, no hardcoded branch.
- Preserve historical quarter-based grade records **per school year** rather
  than overwriting them when a school switches period types.

### 3. Resume teacher-facing modules
Once perms + grading compliance are done, resume the per-module build/test/
restrict loop (see Workflow below) for teacher-facing modules still needing
to be wired up and made functional. `Eclassrecord.jsx` is a known touchpoint.

### Deprioritized (parked, not urgent)
- **ZKTeco biometric attendance + payroll automation module** — planned
  (config-driven payroll engine for all PH employment types + SSS/PhilHealth/
  Pag-IBIG deductions), but explicitly set aside until teacher-facing modules
  and the two priorities above are done.

## Preferred Development Workflow

For each module:
1. Build the module's logic/UI under the **super admin** account (bypasses
   permission friction while validating core logic).
2. Test thoroughly as super admin.
3. Wire the actual `canAccess()` check for that specific module.
4. Test again as the intended restricted role (registrar, teacher, etc.) —
   not just super admin.
5. Assign the module to real users only once step 4 passes.
6. Move to the next module.

## Known Architectural Strengths (don't break these)

- `workflowEngine.js`, `gradingEngine.js`, `attendanceEngine.js` are properly
  isolated in `src/engines/` — no hardcoded grade/attendance formulas leaking
  into page components (confirmed clean as of last scan).
- Storage event listeners (`window.addEventListener('storage', ...)`) are
  correctly filtered by `e.key` across `Sidebar.jsx`, `Payments.jsx`,
  `Students.jsx`, `Dashboard.jsx`, `Enrollments.jsx`, `SubjectLoad.jsx` — no
  re-render-on-unrelated-change bug.
- JWT auth is real and working: `AuthContext.jsx` → `POST /api/auth/login`,
  tokens in `sessionStorage`, CORS preflight resolved.

## Known Bugs Fixed Previously (inherited from CSHC codebase — don't reintroduce)

1. `userBridgeEnrollment.js` filename typo → corrected to `useBridgeEnrollment.js`
2. `Students.jsx` — lazy `useState(() => ...)` init for submissions (not eager)
3. `Students.jsx` — storage event filtered by `e.key === 'cshc_submissions'` only
4. `Students.jsx` — print timeout stored in ref with cleanup on unmount
5. `AuthContext.jsx` — `doLogout` stored in ref to prevent stale closure in timer
6. `Enrollments.jsx` — storage event fixed (was checking custom event names as storage keys)
7. `Dashboard.jsx` — same storage event fix in both main and `RegistrarDashboard`

## Folder Structure (DSMS)

```
src/
├── pages/          → Dashboard, Students, Enrollments, Payments, Reports,
│                     Settings, SubjectLoad, Eclassrecord
├── components/      → SchoolComponents, dashboard/ (Sidebar, Header,
│                      NotificationPanel), settings/ (RolePermissionsTab,
│                      WorkflowConfigTab)
├── context/         → AuthContext, AppConfigContext, CampusFilterContext, ThemeContext
├── config/          → appConfig.js ← SINGLE SOURCE OF TRUTH
├── engines/         → gradingEngine.js, attendanceEngine.js, workflowEngine.js
├── hooks/           → useBridgeEnrollment.js, useWorkflow.js, useAvatar.js
├── utils/           → enrollmentBridge.js, workflowConfigBridge.js, exportToExcel.js
└── data/            → mock data (temporary)
```

## Open Questions / Not Yet Decided

- Whether ALMIRENE DX build-out is targeting go-live at Jhon's own school
  (CSHC) first, or a demo-ready state for outside schools — affects whether
  "narrow and sellable" vs "harden what exists" should be the next-level
  strategy once current priorities are done.
