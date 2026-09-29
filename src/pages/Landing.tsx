import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useContent } from '../lib/content-context'
import type { LandingData } from '../lib/types'
import { PageHero } from '../components/ui'
import Home from './Home'

export default function Landing() {
  const { token = '' } = useParams(),
    { landing } = useContent()
  const [data, setData] = useState<LandingData | null>(landing?.token === token ? landing : null),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    api<LandingData>(`/landing/${encodeURIComponent(token)}`)
      .then((value) => {
        if (active) {
          setData(value)
          setFailed(false)
        }
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [token])
  if (failed || (landing === null && !data))
    return (
      <>
        <PageHero
          eyebrow="NARAN"
          title="광고 링크를 확인해 주세요."
          description="주소가 올바르지 않거나 더 이상 사용할 수 없는 링크입니다."
        />
        <div className="section container">
          <Link className="button" to="/">
            홈으로 돌아가기
          </Link>
        </div>
      </>
    )
  return <Home landing={data} />
}
