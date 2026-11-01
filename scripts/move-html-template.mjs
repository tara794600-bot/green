import { mkdir, rename } from 'node:fs/promises'

// Vercel은 rewrite보다 정적 파일을 먼저 제공합니다. dist/index.html이 남아 있으면 홈(/)이
// api/render를 거치지 않고 빈 템플릿으로 나가 본문·canonical·구조화 데이터가 빠집니다.
// 템플릿을 공개되지 않는 dist-server로 옮겨 홈도 다른 공개 경로처럼 SSR로 응답하게 합니다.
// SSR 빌드가 dist-server를 비우므로 반드시 SSR 빌드 다음에 실행합니다.
await mkdir('dist-server', { recursive: true })
await rename('dist/index.html', 'dist-server/index.html')
