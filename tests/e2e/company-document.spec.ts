// 본문 편집 → 저장 → 공개 상세 표시를 연결해 검증하며 스크립트 실행·브라우저 오류도 감시합니다.
import { expect, test } from '@playwright/test'

test('company document editor persists blocks, styles, diagrams, HTML and uploaded images', async ({
  page,
}) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('dialog', async (dialog) => {
    errors.push('Unexpected script dialog: ' + dialog.message())
    await dialog.dismiss()
  })
  await page.goto('/admin/companies')
  const config = await (await page.request.get('/api/config')).json()
  await page.getByRole('textbox', { name: '비밀번호 비밀번호 표시' }).fill('Local-Verification-2026!')
  if (!config.passwordConfigured) {
    await page.getByRole('textbox', { name: '비밀번호 확인' }).fill('Local-Verification-2026!')
    await page.getByRole('button', { name: '비밀번호 설정하고 시작하기' }).click()
  } else await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.getByRole('button', { name: '사기업체 추가', exact: true }).click()
  await page.getByLabel('업체명', { exact: true }).fill('본문 기능 검증 업체')
  await page.getByLabel('유형', { exact: true }).fill('자동 검증 자료')
  await page.getByLabel('설명 · 목록용 요약', { exact: false }).fill('자동 검증을 위한 업체입니다.')
  await page.locator('.reference-upload input').setInputFiles('public/images/lawyer-seo.webp')
  await page.getByRole('button', { name: '첫 블록 쓰기', exact: true }).click()
  await page
    .getByLabel('1번 블록 내용')
    .fill(
      '## 자료 안내\n\n**중요한 내용**과 숫자를 정리합니다.\n\n| 항목 | 수량 |\n| --- | --- |\n| 증빙 | 12건 |\n\n- [x] 자료 확인',
    )
  await expect(page.locator('.doc-preview-canvas h2')).toHaveText('자료 안내')
  await expect(page.locator('.doc-preview-canvas table')).toContainText('12건')
  await expect(page.locator('.doc-preview-canvas input[type=checkbox]')).toBeChecked()
  async function add(label: string) {
    await page.getByRole('button', { name: '블록 추가', exact: true }).click()
    await page.locator('.doc-add-menu').getByRole('button', { name: label, exact: true }).click()
  }
  await add('HTML')
  await page
    .getByLabel('2번 블록 내용')
    .fill(
      '<div class="doc-box doc-fade" style="color:#bd633f;background-color:#fff5dc"><strong>HTML 강조 안내</strong></div><script>alert("xss")</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">안전한 링크</a>',
    )
  await expect(page.locator('.doc-preview-canvas .doc-box')).toHaveCSS('color', 'rgb(189, 99, 63)')
  await expect(
    page.locator(
      '.doc-preview-canvas script, .doc-preview-canvas [onerror], .doc-preview-canvas a[href^="javascript"]',
    ),
  ).toHaveCount(0)
  await add('다이어그램')
  await page.getByLabel('3번 블록 내용').fill('not a valid diagram')
  await expect(page.locator('.doc-preview-canvas .doc-diagram-error')).toBeVisible()
  await page
    .getByLabel('3번 블록 내용')
    .fill('flowchart LR\n  A[자료 확인] --> B[상담]\n  style A fill:#e8f0e0,stroke:#59754a')
  await expect(page.locator('.doc-preview-canvas .doc-diagram-svg svg')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.doc-preview-canvas .doc-diagram-svg')).toContainText('자료 확인')
  await add('강조 박스')
  await page.getByLabel('4번 블록 내용').fill('**자료를 보관해 주세요.**\n\n원본 파일을 준비하세요.')
  await page.locator('.doc-style-controls summary').click()
  await page.getByLabel('배경 색상', { exact: true }).fill('#fff5dc')
  await page.getByLabel('그림자', { exact: true }).selectOption('strong')
  await page.getByLabel('강조 애니메이션', { exact: true }).selectOption('float')
  await add('숫자 강조')
  await page.getByLabel('5번 블록 내용').fill('128건')
  await page.getByLabel('5번 블록 캡션').fill('확인한 자료 · 검증용 수치')
  await page.locator('.doc-style-controls summary').click()
  await page.getByLabel('강조 색상', { exact: true }).fill('#bd633f')
  await page.getByLabel('그림자', { exact: true }).selectOption('soft')
  await page.getByLabel('강조 애니메이션', { exact: true }).selectOption('pulse')
  await page.getByRole('button', { name: '5번 블록 복제', exact: true }).click()
  await expect(page.locator('.doc-editor-block')).toHaveCount(6)
  await page.getByRole('button', { name: '6번 블록 삭제', exact: true }).click()
  await page.getByRole('button', { name: '본문 실행 취소', exact: true }).click()
  await expect(page.locator('.doc-editor-block')).toHaveCount(6)
  await page.getByRole('button', { name: '본문 다시 실행', exact: true }).click()
  await expect(page.locator('.doc-editor-block')).toHaveCount(5)
  await page.getByRole('button', { name: '5번 블록 위로', exact: true }).click()
  await expect(page.locator('.doc-editor-block').nth(3)).toContainText('숫자 강조')
  await page.getByRole('button', { name: '4번 블록 아래로', exact: true }).click()
  await add('이미지')
  await page.getByLabel('6번 본문 이미지 파일').setInputFiles('public/images/lawyer-choi.webp')
  await page.getByLabel('6번 블록 캡션').fill('본문 업로드 검증 자료')
  await expect(page.locator('.doc-preview-canvas img[alt="본문 업로드 검증 자료"]')).toBeVisible()
  await page.getByRole('button', { name: '미리보기', exact: true }).click()
  await expect(page.locator('.doc-edit-canvas')).toHaveCount(0)
  await page.getByRole('button', { name: '나란히 보기', exact: true }).click()
  await page.locator('.document-editor').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'artifacts/company-editor-desktop.png', fullPage: true })
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const company = (
    await (
      await page.request.get('/api/admin/companies?q=' + encodeURIComponent('본문 기능 검증 업체'))
    ).json()
  ).items[0]
  expect(company.document.blocks).toHaveLength(6)
  expect(company.document.blocks[3].style.background).toBe('#fff5dc')
  expect(company.document.blocks[4].style.accent).toBe('#bd633f')
  const bodyImage = company.document.blocks[5].content
  expect(bodyImage).toMatch(/^\/api\/media\//)
  await page.reload()
  await page.getByRole('button', { name: '본문 기능 검증 업체 수정', exact: true }).last().click()
  await expect(page.getByLabel('1번 블록 내용')).toContainText('자료 안내')
  await expect(page.locator('.doc-preview-canvas .doc-stat-value')).toHaveText('128건')
  await page.getByLabel('1번 블록 내용').fill('저장하지 않은 수정')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.goto(`/companies/${company.id}`)
  await expect(page.locator('.company-rich-section h2')).toHaveText('자료 안내')
  await expect(page.locator('.company-rich-section .doc-stat-value')).toHaveText('128건')
  await expect(page.locator('.company-rich-section .doc-stat-value')).toHaveCSS('color', 'rgb(189, 99, 63)')
  await expect(page.locator('.company-rich-section .doc-diagram-svg svg')).toBeVisible()
  await expect(page.getByAltText('본문 업로드 검증 자료')).toBeVisible()
  await page.screenshot({ path: 'artifacts/company-document-desktop.png', fullPage: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.company-rich-section .doc-type-stat')).toHaveCSS('animation-name', 'none')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'artifacts/company-document-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/admin/companies')
  await page.getByRole('button', { name: '본문 기능 검증 업체 수정', exact: true }).last().click()
  await page.locator('.document-editor').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'artifacts/company-editor-mobile.png', fullPage: true })
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.getByRole('button', { name: '6번 블록 삭제', exact: true }).click()
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await page.request.get(bodyImage)).status()).toBe(404)
  await page.getByRole('button', { name: '본문 기능 검증 업체 삭제', exact: true }).click()
  await page.getByRole('button', { name: '삭제하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
})
