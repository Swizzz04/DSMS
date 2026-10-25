/**
 * DataTable.jsx — ALMIRENE DX
 * Shared pieces for every list table (Clearance, Document Requests, Students):
 *
 *   useTablePaging(items, opts)  → sorts the already-filtered list and cuts it into pages
 *   <SortTh />                   → a sortable column header (aria-sort, arrow icon)
 *   <Pager />                    → "Showing 21–40 of 132" + rows-per-page + Prev / Next
 *
 * Rows per page: 20 (default), 50, 100, 200, 300, 500, 1000. The choice is remembered for
 * every table in the system under localStorage key `almirene_table_page_size`.
 *
 * Usage:
 *   const SORTERS = {
 *     student:   (a, b) => a.name.localeCompare(b.name),
 *     requested: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
 *   }
 *   const { rows, sort, onSort, page, pageCount, total, setPage, pageSize, setPageSize } = useTablePaging(filtered, {
 *     sorters:   SORTERS,                       // keep it OUTSIDE the component (stable identity)
 *     defaultSort: { key: 'requested', dir: 'desc' },
 *     descFirst: ['requested'],                 // columns that start newest/biggest first
 *     resetOn:   [statusFilter, search],        // back to page 1 when any of these change
 *   })
 *
 *   …
 *   <Pager page={page} pageCount={pageCount} total={total} onPage={setPage}
 *          pageSize={pageSize} onPageSize={setPageSize} noun="student" />
 *
 * Call the hook BEFORE any early return (`if (loading) return …`). If a page computes its
 * list after an early return, put the table in a small child component and call the hook there.
 * Flat brand colors and CSS variables only — no gradients, no hardcoded hex.
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import GroupedSelect from './GroupedSelect'

export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 500, 1000]   // plus the default (20)

const PAGE_SIZE_KEY = 'almirene_table_page_size'

function readPageSize() {
  try {
    const n = Number(localStorage.getItem(PAGE_SIZE_KEY))
    return n === DEFAULT_PAGE_SIZE || PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE
  } catch { return DEFAULT_PAGE_SIZE }
}
function writePageSize(n) {
  try { localStorage.setItem(PAGE_SIZE_KEY, String(n)) } catch { /* private mode / blocked storage */ }
}

export function useTablePaging(items, { sorters, defaultSort, descFirst = [], resetOn = [] }) {
  const [sort, setSort] = useState(defaultSort)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(readPageSize)

  const setPageSize = useCallback((n) => { setPageSizeState(n); writePageSize(n) }, [])

  const onSort = useCallback((key) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: descFirst.includes(key) ? 'desc' : 'asc' })
    // descFirst is a small static list; it never changes between renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = useMemo(() => {
    const cmp = sorters[sort.key]
    if (!cmp) return items
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...items].sort((a, b) => dir * cmp(a, b))
  }, [items, sort, sorters])

  // Back to page 1 whenever the filters, the search, the sort or the page size change the result set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [...resetOn, sort, pageSize])

  const total     = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage  = Math.min(page, pageCount)
  const rows      = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  )

  return { rows, sort, onSort, page: safePage, pageCount, total, setPage, pageSize, setPageSize }
}

/** Sortable column header. */
export function SortTh({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey
  const Icon   = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      className={`th ${className}`}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold hover:text-[var(--color-text-primary)] transition-colors"
      >
        {label}
        <Icon size={12} className={active ? 'text-[var(--color-primary-readable)]' : 'opacity-50'} />
      </button>
    </th>
  )
}

/** "Showing 21–40 of 132 students" + rows per page + previous / next. */
export function Pager({ page, pageCount, total, onPage, noun = 'record', pageSize = DEFAULT_PAGE_SIZE, onPageSize }) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
      <span>Showing {from}–{to} of {total} {noun}{total !== 1 ? 's' : ''}</span>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onPageSize && (
          // The reset option of GroupedSelect ('all') is the default size, so the clear "x" on
          // a custom size simply goes back to 20 per page.
          <div className="w-40" title="Rows per page">
            <GroupedSelect
              value={pageSize === DEFAULT_PAGE_SIZE ? 'all' : String(pageSize)}
              onChange={v => onPageSize(v === 'all' ? DEFAULT_PAGE_SIZE : Number(v))}
              allLabel={`${DEFAULT_PAGE_SIZE} per page`}
              options={PAGE_SIZE_OPTIONS.map(n => ({ value: String(n), label: `${n} per page` }))}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="btn btn-ghost text-xs py-1.5 px-3 gap-1 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <span className="font-semibold text-[var(--color-text-secondary)] tabular-nums whitespace-nowrap">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pageCount}
            className="btn btn-ghost text-xs py-1.5 px-3 gap-1 disabled:opacity-40"
            aria-label="Next page"
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
