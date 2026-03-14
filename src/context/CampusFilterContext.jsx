import { createContext, useContext, useState } from 'react'

const CampusFilterContext = createContext(null)

export function CampusFilterProvider({ children }) {
  const [campusFilter, setCampusFilter] = useState('all')

  return (
    <CampusFilterContext.Provider value={{ campusFilter, setCampusFilter }}>
      {children}
    </CampusFilterContext.Provider>
  )
}

export function useCampusFilter() {
  const ctx = useContext(CampusFilterContext)
  if (!ctx) throw new Error('useCampusFilter must be used inside <CampusFilterProvider>')
  return ctx
}