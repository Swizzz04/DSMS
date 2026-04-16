/**
 * GradeLevelSelect — backwards-compatible wrapper around GroupedSelect.
 *
 * All existing imports of GradeLevelSelect continue to work without
 * any changes to the pages that use it. Internally this just passes
 * the `gradeLevel` flag to GroupedSelect which handles the campus-aware,
 * role-aware group building.
 *
 * Usage (unchanged from before):
 *   <GradeLevelSelect
 *     value={gradeLevelFilter}
 *     onChange={setGradeLevelFilter}
 *     campusFilter={campusKey}
 *     userRole={user?.role}
 *   />
 *
 * You can also migrate call sites to use GroupedSelect directly:
 *   <GroupedSelect
 *     gradeLevel
 *     value={gradeLevelFilter}
 *     onChange={setGradeLevelFilter}
 *     campusFilter={campusKey}
 *     userRole={user?.role}
 *   />
 */

import GroupedSelect from './GroupedSelect'

export default function GradeLevelSelect({ value, onChange, campusFilter = 'all', userRole = 'admin' }) {
  return (
    <GroupedSelect
      gradeLevel
      value={value}
      onChange={onChange}
      campusFilter={campusFilter}
      userRole={userRole}
    />
  )
}