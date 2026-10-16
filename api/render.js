// HTML 렌더러를 Vercel 함수로 노출합니다. 배포에 dist와 dist-server가 모두 포함되어야 합니다.
export { renderPage as default } from '../server/render.mjs'
