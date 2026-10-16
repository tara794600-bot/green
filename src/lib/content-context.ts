import { createContext, useContext } from 'react'
import type { PublicData } from './types'
// 브라우저 App과 SSR 진입점이 같은 데이터 계약으로 공개 컴포넌트를 렌더링합니다.
export const ContentContext = createContext<PublicData | null>(null)
export function useContent() {
  const value = useContext(ContentContext)
  if (!value) throw new Error('사이트 데이터를 불러오지 못했습니다.')
  return value
}
