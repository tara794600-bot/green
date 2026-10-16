import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)
// SSR HTML이 있으면 재사용해 이벤트를 연결하고, 개발·관리자 화면의 빈 루트는 새로 그립니다.
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
