// 본문 편집 → 저장 → 공개 상세 표시를 연결해 검증하며 스크립트 실행·브라우저 오류도 감시합니다.
import { expect, test, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/admin/companies')
  const config = await (await page.request.get('/api/config')).json()
  await page.getByRole('textbox', { name: '비밀번호 비밀번호 표시' }).fill('Local-Verification-2026!')
  if (!config.passwordConfigured) {
    await page.getByRole('textbox', { name: '비밀번호 확인' }).fill('Local-Verification-2026!')
    await page.getByRole('button', { name: '비밀번호 설정하고 시작하기' }).click()
  } else await page.getByRole('button', { name: '로그인', exact: true }).click()
}
// 작성 영역의 빈 곳을 눌러 마지막 줄로 이동합니다. 실제 사용자처럼 다음 내용을 이어 씁니다.
const toEnd = (page: Page) => page.locator('.se-canvas').click({ position: { x: 4, y: 4 } })

test('blog editor writes styled text, quotes, photos, cards and videos that render on the detail page', async ({
  page,
}) => {
  test.setTimeout(150000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('dialog', async (dialog) => {
    errors.push('Unexpected script dialog: ' + dialog.message())
    await dialog.dismiss()
  })
  await login(page)
  await page.getByRole('button', { name: '사기업체 추가', exact: true }).click()
  await page.getByLabel('업체명', { exact: true }).fill('본문 기능 검증 업체')
  await page.getByLabel('유형', { exact: true }).fill('자동 검증 자료')
  await page.getByLabel('설명 · 목록용 요약', { exact: false }).fill('자동 검증을 위한 업체입니다.')
  await page.locator('.reference-upload input').setInputFiles('public/images/lawyer-seo.webp')
  const editor = page.locator('.se-paper .ProseMirror')

  // 제목 · 글자 색 · 형광펜 · 굵게
  await editor.click()
  await page.keyboard.type('자료 안내')
  await page.getByRole('button', { name: '문단 서식' }).click()
  await page.getByRole('menuitemradio', { name: '제목 2' }).click()
  await expect(editor.locator('h2')).toHaveText('자료 안내')
  await toEnd(page)
  await page.keyboard.press('Enter')
  await page.keyboard.type('중요한 내용을 강조합니다.')
  await page.keyboard.press('Shift+Home')
  await page.getByRole('button', { name: '글자 색' }).click()
  await page.getByRole('button', { name: '색상 #e5212e' }).click()
  await page.getByRole('button', { name: '형광펜' }).click()
  await page.getByRole('button', { name: '색상 #fff3a3' }).click()
  await page.getByRole('button', { name: '굵게' }).click()
  await expect(editor.locator('strong mark')).toHaveText('중요한 내용을 강조합니다.')

  // 인용구 · 구분선
  await toEnd(page)
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '인용구' }).click()
  await page.getByRole('menuitemradio', { name: '말풍선' }).click()
  await page.keyboard.type('자료를 삭제하지 말고 보관해 주세요.')
  await expect(editor.locator('blockquote[data-style="bubble"]')).toHaveText(
    '자료를 삭제하지 말고 보관해 주세요.',
  )
  await toEnd(page)
  await page.getByRole('button', { name: '구분선' }).click()
  await page.getByRole('menuitemradio', { name: '다이아몬드' }).click()
  await expect(editor.locator('hr[data-style="diamond"]')).toHaveCount(1)

  // 사진 한 장(설명·크기) · 여러 장 콜라주
  await page.getByLabel('본문 사진 파일').setInputFiles('public/images/lawyer-choi.webp')
  await page.getByLabel('사진 설명', { exact: true }).fill('본문 업로드 검증 자료')
  await editor.locator('figure[data-type="image"] img').click()
  await page.getByRole('button', { name: '사진 크기 중간' }).click()
  await expect(editor.locator('figure[data-type="image"]')).toHaveAttribute('data-size', 'medium')
  await page
    .getByLabel('본문 사진 파일')
    .setInputFiles([
      'public/images/lawyer-jung.webp',
      'public/images/consultation.webp',
      'public/images/lawyer-seo.webp',
    ])
  await page.getByRole('button', { name: '콜라주', exact: true }).click()
  await expect(editor.locator('figure[data-type="gallery"] img')).toHaveCount(3)
  // 사진을 넣은 뒤 다른 요소를 추가해도 기존 구분선과 사진이 남아 있어야 합니다.
  await expect(editor.locator('hr[data-style="diamond"]')).toHaveCount(1)
  await expect(editor.locator('figure[data-type="image"]')).toHaveCount(1)

  // 표 · 장소 · 링크 카드 · 동영상 · 이모티콘
  await toEnd(page)
  await page.getByRole('button', { name: '표', exact: true }).click()
  await page.getByRole('button', { name: '3행 3열 표 넣기' }).click()
  await page.keyboard.type('항목')
  await page.keyboard.press('Tab')
  await page.keyboard.type('수량')
  await expect(page.getByRole('toolbar', { name: '본문 서식' }).getByText('행 삭제')).toBeVisible()
  await toEnd(page)
  await page.getByRole('button', { name: '장소', exact: true }).click()
  await page.getByRole('textbox', { name: '장소 이름' }).fill('법무법인 나란')
  await page.getByRole('textbox', { name: '주소', exact: true }).fill('서울특별시 서초구 서초대로 1')
  await page.getByRole('button', { name: '장소 넣기' }).click()
  await page.getByRole('button', { name: '링크', exact: true }).click()
  await page.getByRole('textbox', { name: '링크 주소' }).fill('example.com/guide')
  await page.getByRole('textbox', { name: '제목', exact: true }).fill('참고 자료')
  await page.getByRole('button', { name: '링크 넣기' }).click()
  await page.getByRole('button', { name: '동영상', exact: true }).click()
  await page.getByRole('textbox', { name: 'YouTube 주소' }).fill('not a video')
  await page.getByRole('button', { name: '동영상 넣기' }).click()
  await expect(page.getByRole('alert')).toHaveText('YouTube 동영상 주소를 확인해 주세요.')
  await page
    .getByRole('textbox', { name: 'YouTube 주소' })
    .fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.getByRole('button', { name: '동영상 넣기' }).click()
  await expect(editor.locator('div[data-youtube-video] iframe')).toHaveAttribute(
    'src',
    /youtube-nocookie.com\/embed\/dQw4w9WgXcQ/,
  )
  await toEnd(page)
  await page.getByRole('button', { name: '이모티콘' }).click()
  await page.getByRole('button', { name: '✅ 넣기' }).click()
  await expect(editor).toContainText('✅')

  // 외부에서 붙여넣은 HTML의 스크립트·이벤트·위험한 링크는 편집기에 들어오지 않습니다.
  await editor.evaluate((el) => {
    const data = new DataTransfer()
    data.setData(
      'text/html',
      '<p>붙여넣은 문단</p><img src="x" onerror="alert(1)"><script>alert(2)</script><p><a href="javascript:alert(3)">나쁜 링크</a></p>',
    )
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(editor).toContainText('붙여넣은 문단')
  await expect(editor.locator('script, img[src="x"], a[href^="javascript"]')).toHaveCount(0)
  await page.getByRole('button', { name: '실행 취소' }).click()
  await expect(editor).not.toContainText('붙여넣은 문단')
  await page.getByRole('button', { name: '다시 실행' }).click()
  await expect(editor).toContainText('붙여넣은 문단')

  // 미리보기는 저장 후 상세페이지와 같은 정제 규칙으로 보여줍니다.
  await page.getByRole('button', { name: '미리보기', exact: true }).click()
  const preview = page.locator('.se-preview .company-rich-document')
  await expect(preview.locator('blockquote[data-style="bubble"]')).toBeVisible()
  await expect(preview.locator('figure[data-type="gallery"] img')).toHaveCount(3)
  await page.getByRole('button', { name: '모바일' }).click()
  await expect(page.locator('.se-preview-frame')).toHaveClass(/is-mobile/)
  await page.locator('.se-editor').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'artifacts/company-editor-preview.png' })
  await page.getByRole('button', { name: '편집으로 돌아가기' }).click()
  await page.locator('.se-editor').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'artifacts/company-editor-desktop.png' })
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const company = (
    await (
      await page.request.get('/api/admin/companies?q=' + encodeURIComponent('본문 기능 검증 업체'))
    ).json()
  ).items[0]
  const html: string = company.document.html
  expect(company.document.version).toBe(2)
  expect(html).not.toContain('blob:')
  for (const part of [
    'data-style="bubble"',
    'data-style="diamond"',
    'data-size="medium"',
    'data-layout="collage"',
    'data-type="place"',
    'href="https://example.com/guide"',
    'youtube-nocookie.com/embed/dQw4w9WgXcQ',
  ])
    expect(html).toContain(part)
  const bodyImages = [...html.matchAll(/\/api\/media\/[a-f0-9-]{36}\.webp/g)].map((m) => m[0])
  expect(new Set(bodyImages).size).toBe(4)
  const singleImage = html.match(/<figure data-type="image"[^>]*><img src="([^"]+)"/)![1]

  await page.goto(`/companies/${company.id}`)
  const article = page.locator('.company-rich-section')
  await expect(article.locator('h2')).toHaveText('자료 안내')
  await expect(article.locator('mark')).toHaveCSS('background-color', 'rgb(255, 243, 163)')
  await expect(article.locator('span[style*="color"]').first()).toHaveCSS('color', 'rgb(229, 33, 46)')
  await expect(article.locator('blockquote[data-style="bubble"]')).toBeVisible()
  await expect(article.locator('figure[data-type="gallery"] img')).toHaveCount(3)
  await expect(page.getByAltText('본문 업로드 검증 자료')).toBeVisible()
  await expect(article.locator('figcaption')).toContainText('본문 업로드 검증 자료')
  await expect(article.locator('table th').first()).toHaveText('항목')
  await expect(article.locator('[data-type="place"]')).toContainText('법무법인 나란')
  await expect(article.locator('a[data-type="linkCard"]')).toHaveAttribute(
    'href',
    'https://example.com/guide',
  )
  await expect(article.locator('iframe')).toHaveAttribute('src', /youtube-nocookie/)
  await expect(article.locator('script, img[src="x"]')).toHaveCount(0)
  await page.screenshot({ path: 'artifacts/company-document-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'artifacts/company-document-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  // 저장하지 않고 닫은 수정 내용은 임시저장에서 다시 불러올 수 있습니다.
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin/companies')
  await page.getByRole('button', { name: '본문 기능 검증 업체 수정', exact: true }).last().click()
  await expect(editor.locator('h2')).toHaveText('자료 안내')
  await toEnd(page)
  await page.keyboard.type('저장하지 않은 수정')
  await expect(page.locator('.se-footer')).toContainText('자동 임시저장됨')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.getByRole('button', { name: '본문 기능 검증 업체 수정', exact: true }).last().click()
  await expect(editor).not.toContainText('저장하지 않은 수정')
  await expect(page.locator('.se-draft')).toContainText('임시저장한 글이 있습니다')
  await page.getByRole('button', { name: '불러오기' }).click()
  await expect(editor).toContainText('저장하지 않은 수정')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.getByRole('button', { name: '본문 기능 검증 업체 수정', exact: true }).last().click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.locator('.se-draft')).toHaveCount(0)

  // 모바일 편집 화면도 가로로 넘치지 않습니다.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.se-editor').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'artifacts/company-editor-mobile.png' })
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })

  // 본문에서 뺀 업로드 사진은 저장 후 정리됩니다.
  await editor.locator('figure[data-type="image"] img').click()
  await page.getByRole('button', { name: '사진 삭제' }).click()
  await expect(editor.locator('figure[data-type="image"]')).toHaveCount(0)
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await page.request.get(singleImage)).status()).toBe(404)
  await page.getByRole('button', { name: '본문 기능 검증 업체 삭제', exact: true }).click()
  await page.getByRole('button', { name: '삭제하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('legacy block documents open in the blog editor without losing content', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: '사기업체 추가', exact: true }).waitFor()
  const id = await page.evaluate(async () => {
    const style = {
      color: '#263b2c',
      background: 'transparent',
      borderColor: '#dce4d7',
      accent: '#bd633f',
      shadow: 'none',
      animation: 'none',
      align: 'left',
      radius: 12,
      padding: 0,
      borderWidth: 0,
      fontSize: 16,
    }
    const response = await fetch('/api/admin/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '이전 본문 업체',
        service: '호환성 검증',
        description: '이전 블록 형식 본문',
        image: '/images/lawyer-seo.webp',
        visibility: 'public',
        document: {
          version: 1,
          blocks: [
            { id: 'a', type: 'markdown', content: '## 이전 안내\n\n- 목록 항목', caption: '', style },
            { id: 'b', type: 'stat', content: '128건', caption: '확인한 자료', style },
          ],
        },
      }),
    })
    return (await response.json()).id as string
  })
  await page.goto(`/companies/${id}`)
  await expect(page.locator('.company-rich-section h2')).toHaveText('이전 안내')
  await expect(page.locator('.company-rich-section strong')).toHaveText('128건')
  await page.goto('/admin/companies')
  await page.getByRole('button', { name: '이전 본문 업체 수정', exact: true }).last().click()
  const editor = page.locator('.se-paper .ProseMirror')
  await expect(editor.locator('h2')).toHaveText('이전 안내')
  await expect(editor.locator('li')).toHaveText('목록 항목')
  await expect(editor.locator('span[style*="font-size: 38px"]')).toHaveText('128건')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.getByRole('button', { name: '이전 본문 업체 삭제', exact: true }).click()
  await page.getByRole('button', { name: '삭제하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
