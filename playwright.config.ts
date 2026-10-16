import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  // 같은 테스트 서버의 관리자·콘텐츠 상태를 공유하므로 브라우저 시나리오는 순서대로 실행합니다.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1440, height: 1000 },
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/test-server.mjs',
    url: 'http://127.0.0.1:5174/api/config',
    // 개발 중인 서버를 재사용하지 않고 외부 키가 제거된 전용 서버를 띄웁니다.
    reuseExistingServer: false,
    timeout: 30000,
  },
})
