import { createContext, useContext } from 'react'
import type { PublicData } from './types'
export const ContentContext = createContext<PublicData | null>(null)
export function useContent() {
  const value = useContext(ContentContext)
  if (!value) throw new Error('사이트 데이터를 불러오지 못했습니다.')
  return value
}
