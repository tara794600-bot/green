// 브라우저·SSR 공통 본문 변환의 허용/차단 규칙과 문서 제한을 검증합니다.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_DOCUMENT_HTML,
  MAX_DOCUMENT_IMAGES,
  companyDocumentSchema,
  documentHtml,
  documentImageUrls,
  fontStylesheet,
  hasDocumentContent,
  sanitizeContent,
} from '../shared/company-document.mjs'

import { legacyDocument, testDocument } from './fixtures/company-document.mjs'

const upload = '/api/media/12345678-1234-1234-1234-123456789012.webp'

test('editor HTML keeps colors, highlights, fonts, quotes, dividers, tables, checklists and videos', () => {
  const clean = sanitizeContent(testDocument.html)
  assert.match(clean, /<h2>상세 안내<\/h2>/)
  assert.match(clean, /text-align:center;line-height:2/)
  assert.match(clean, /color:#e5212e;font-family:'Nanum Gothic', sans-serif;font-size:19px/)
  assert.match(clean, /<mark data-color="#fff3a3" style="background-color:#fff3a3;color:inherit">/)
  assert.match(clean, /<td style="background-color:#fff3a3">/)
  assert.match(clean, /<div class="tableWrapper">/)
  assert.match(
    clean,
    /<li data-type="taskItem" data-checked="true"><label><input type="checkbox" disabled checked \/>/,
  )
  assert.match(clean, /<blockquote data-style="postit">/)
  assert.match(clean, /<hr data-style="diamond" \/>/)
  assert.match(
    clean,
    /<iframe src="https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ" width="640" height="360"/,
  )
  assert.match(
    clean,
    /<a data-type="linkCard" href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">/,
  )
  assert.match(clean, /<img src="\/images\/lawyer-seo.webp" loading="lazy" \/>/)
  assert.doesNotMatch(clean, /script|evil.example|onerror/)
  assert.equal(
    fontStylesheet(clean),
    'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap',
  )
})

test('HTML removes scripts, events, foreign frames, unsafe URLs, unknown fonts and positioning CSS', () => {
  const clean = sanitizeContent(
    '<div class="doc-box site-header" style="color:#bd633f;position:fixed;background-image:url(https://evil.example);font-family:Comic Sans MS;font-size:32px">안내</div><script>alert(1)</script><iframe src="https://www.youtube.com.evil.example/embed/abcdefghijk"></iframe><iframe src="javascript:alert(1)"></iframe><img src="javascript:alert(1)" onerror="alert(1)"><img src="blob:http://localhost/1"><a href="javascript:alert(1)" onclick="alert(1)">링크</a><style>body{display:none}</style>',
  )
  assert.match(clean, /class="doc-box"/)
  assert.match(clean, /color:#bd633f/)
  assert.match(clean, /font-size:32px/)
  assert.doesNotMatch(
    clean,
    /script|iframe|onerror|onclick|javascript:|position|background-image|font-family|site-header|evil.example|display:none|blob:|<img/,
  )
  // 편집기 미리보기에서만 업로드 전 사진 주소를 표시합니다.
  assert.match(sanitizeContent('<img src="blob:http://localhost/1">', { localImages: true }), /src="blob:/)
  assert.doesNotMatch(
    sanitizeContent(
      '<svg><foreignObject><iframe srcdoc="<script>alert(1)</script>"></iframe></foreignObject></svg>',
    ),
    /<svg|<iframe|<script/,
  )
})

test('legacy block documents convert to editor HTML with diagrams kept as source code', () => {
  const html = sanitizeContent(documentHtml(legacyDocument))
  assert.match(html, /<h2>이전 안내<\/h2>/)
  assert.match(html, /<table>/)
  assert.match(html, /<span style="font-size:38px;color:#59754a"><strong>128건<\/strong><\/span>/)
  assert.match(html, /<pre><code>flowchart LR\n A\[확인\] --&gt; B\[상담\]<\/code><\/pre>/)
  assert.match(html, /<div class="doc-box" style="color:#bc5432"><strong>이전 HTML 안내<\/strong><\/div>/)
  assert.doesNotMatch(html, /script/)
  assert.equal(documentHtml(testDocument), testDocument.html)
  assert.equal(hasDocumentContent(legacyDocument), true)
  assert.equal(hasDocumentContent({ version: 2, html: '<p></p><p>&nbsp;</p>' }), false)
  assert.equal(hasDocumentContent({ version: 2, html: '<hr data-style="line">' }), true)
})

test('document schema accepts editor and legacy formats and rejects unsafe or oversized bodies', () => {
  assert.equal(companyDocumentSchema.safeParse(testDocument).success, true)
  assert.equal(companyDocumentSchema.safeParse(legacyDocument).success, true)
  const figure = (src) => `<figure data-type="image"><img src="${src}"></figure>`
  assert.equal(companyDocumentSchema.safeParse({ version: 2, html: figure(upload) }).success, true)
  for (const doc of [
    { version: 2, html: figure('blob:http://127.0.0.1:5173/1') },
    { version: 2, html: figure('http://example.com/a.png') },
    { version: 2, html: figure('data:image/svg+xml,<svg onload=alert(1)>') },
    { version: 2, html: '가'.repeat(MAX_DOCUMENT_HTML + 1) },
    { version: 2, html: figure(upload).repeat(MAX_DOCUMENT_IMAGES + 1) },
    { version: 2, html: '<p></p>', blocks: [] },
    { version: 3, html: '<p></p>' },
    { ...legacyDocument, blocks: [legacyDocument.blocks[0], legacyDocument.blocks[0]] },
  ])
    assert.equal(companyDocumentSchema.safeParse(doc).success, false)
  assert.equal(
    companyDocumentSchema.safeParse({ version: 2, html: figure('blob:x') }).error.issues[0].message,
    '본문 이미지는 업로드하거나 HTTPS 주소를 입력해 주세요.',
  )
})

test('image references include covers, editor HTML uploads and legacy blocks', () => {
  assert.deepEqual(
    documentImageUrls({
      image: upload,
      document: {
        version: 2,
        html: `<figure data-type="gallery"><div><img src="${upload}"><img src="/api/media/aaaaaaaa-1234-1234-1234-123456789012.webp"></div></figure>`,
      },
    }),
    [upload, '/api/media/aaaaaaaa-1234-1234-1234-123456789012.webp'],
  )
  assert.deepEqual(
    documentImageUrls({
      image: upload,
      document: {
        blocks: [
          { type: 'markdown', content: `![자료](${upload})` },
          { type: 'image', content: '/images/second.webp' },
        ],
      },
    }),
    [upload, '/images/second.webp'],
  )
})
