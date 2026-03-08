import { useState, useEffect } from 'react'

// Key builder per user
const avatarKey = (userId) => `cshc_avatar_${userId}`

// Custom event name for cross-component sync
const AVATAR_EVENT = 'cshc_avatar_change'

/**
 * useAvatar(userId)
 * Returns [avatarUrl, setAvatar]
 * Any component using this hook stays in sync — when ProfileModal
 * uploads a photo, Header's icon updates instantly without a page reload.
 */
export function useAvatar(userId) {
  const [avatar, setAvatarState] = useState(() => {
    if (!userId) return null
    return localStorage.getItem(avatarKey(userId)) || null
  })

  // Listen for changes from other components
  useEffect(() => {
    if (!userId) return
    const handler = (e) => {
      if (e.detail?.userId === userId) {
        setAvatarState(e.detail.avatar)
      }
    }
    window.addEventListener(AVATAR_EVENT, handler)
    return () => window.removeEventListener(AVATAR_EVENT, handler)
  }, [userId])

  const setAvatar = (dataUrl) => {
    if (!userId) return
    if (dataUrl) {
      localStorage.setItem(avatarKey(userId), dataUrl)
    } else {
      localStorage.removeItem(avatarKey(userId))
    }
    setAvatarState(dataUrl)
    // Broadcast to all other components using this hook
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT, {
      detail: { userId, avatar: dataUrl }
    }))
  }

  return [avatar, setAvatar]
}