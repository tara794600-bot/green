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
