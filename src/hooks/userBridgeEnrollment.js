/**
 * useBridgeEnrollments.js
 * ─────────────────────────────────────────────────────────────────
 * React hook that merges website enrollment submissions (from
 * enrollmentBridge.js / localStorage) with the local mock data.
 *
 * Usage in any page:
 *   const { allEnrollments, websiteCount, refresh } = useBridgeEnrollments()
 *
 * allEnrollments — mockEnrollments + website submissions combined
 * websiteCount   — number of unread website submissions
 * refresh()      — manually re-read localStorage (called after approve/reject)
 */

import { useState, useEffect, useCallback } from 'react'
import { mockEnrollments } from '../data/mockEnrollments'
import {
  getWebsiteSubmissions,
  updateSubmissionStatus,
  deleteSubmission,
  getPendingCount,
} from './enrollmentBridge'

export function useBridgeEnrollments() {
  const [websiteSubmissions, setWebsiteSubmissions] = useState([])
  const [websiteCount, setWebsiteCount]             = useState(0)

  const load = useCallback(() => {
    const subs = getWebsiteSubmissions()
    setWebsiteSubmissions(subs)
    setWebsiteCount(subs.filter(s => s.status === 'pending').length)
  }, [])

  useEffect(() => {
    load()

    // Listen for new submissions from the website (same browser tab)
    const handleNew = () => load()
    window.addEventListener('cshc_new_submission', handleNew)

    // Listen for localStorage changes from another tab (website in different tab)
    const handleStorage = (e) => {
      if (e.key === 'cshc_submissions') load()
    }
    window.addEventListener('storage', handleStorage)

    // Poll every 10 seconds as fallback
    const interval = setInterval(load, 10_000)

    return () => {
      window.removeEventListener('cshc_new_submission', handleNew)
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
    }
  }, [load])

  // Merge: website submissions first (newest at top), then mock data
  const allEnrollments = [...websiteSubmissions, ...mockEnrollments]

  // Approve a website submission
  const approveWebsite = useCallback((referenceNumber) => {
    updateSubmissionStatus(referenceNumber, 'approved')
    load()
  }, [load])

  // Reject a website submission
  const rejectWebsite = useCallback((referenceNumber) => {
    updateSubmissionStatus(referenceNumber, 'rejected')
    load()
  }, [load])

  // Remove a website submission (after formal processing)
  const removeWebsite = useCallback((referenceNumber) => {
    deleteSubmission(referenceNumber)
    load()
  }, [load])

  return {
    allEnrollments,
    websiteSubmissions,
    websiteCount,
    refresh: load,
    approveWebsite,
    rejectWebsite,
    removeWebsite,
  }
}