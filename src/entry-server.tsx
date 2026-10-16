import { Suspense } from 'react'
import { renderToString } from 'react-dom/server'
import { Routes, Route, StaticRouter } from 'react-router-dom'
import { ContentContext } from './lib/content-context'
import type { PublicData } from './lib/types'
import Layout from './components/Layout'
import Home from './pages/Home'
import PublicPages from './pages/PublicPages'
import Consultation from './pages/Consultation'
import Landing from './pages/Landing'

// 서버에서는 브라우저 전역 객체 없이 경로와 데이터만 받아 공개 HTML을 만듭니다.
// 공개 라우트 변경 시 App.tsx와 server/render.mjs의 경로 판정도 함께 확인합니다.
export function render(path: string, data: PublicData) {
  return renderToString(
    <ContentContext value={data}>
      <StaticRouter location={path}>
        <Suspense>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="/consultation" element={<Consultation />} />
              <Route path={`${data.powerlinkPrefix || '/p/'}:token`} element={<Landing />} />
              <Route path="*" element={<PublicPages />} />
            </Route>
          </Routes>
        </Suspense>
      </StaticRouter>
    </ContentContext>,
  )
}
