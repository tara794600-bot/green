// 브라우저·SSR 공통 본문 변환의 허용/차단 규칙과 문서 제한을 검증합니다.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  companyDocumentSchema,
  documentImageUrls,
  markdownParts,
  sanitizeContent,
} from '../shared/company-document.mjs'

import { testDocument } from './fixtures/company-document.mjs'

test('Markdown renders tables, checklists, reference links and Mermaid fences', () => {
  const parts = markdownParts(
    testDocument.blocks[0].content +
      '\n\n[링크][ref]\n\n```mermaid\nflowchart LR\nA-->B\n```\n\n다음 문단 [링크][ref]\n\n[ref]: https://example.com',
  )
  assert.equal(parts.length, 3)
  assert.match(parts[0].content, /<h2>상세 안내<\/h2>/)
  assert.match(parts[0].content, /<table>/)
  assert.match(parts[0].content, /type="checkbox" disabled checked/)
  assert.match(parts[0].content, /href="https:\/\/example.com"/)
  assert.equal(parts[1].kind, 'diagram')
  assert.match(parts[2].content, /href="https:\/\/example.com"/)
})

test('HTML keeps safe presentation but removes scripts, events, frames, unsafe URLs and CSS', () => {
  const clean = sanitizeContent(
    '<div class="doc-box site-header" style="color:#bd633f;background-color:rgb(240,240,240);position:fixed;background-image:url(https://evil.example);font-size:32px">안내</div><script>alert(1)</script><iframe src="https://evil.example"></iframe><img src="javascript:alert(1)" onerror="alert(1)"><a href="javascript:alert(1)" onclick="alert(1)">링크</a><style>body{display:none}</style>',
  )
  assert.match(clean, /class="doc-box"/)
  assert.match(clean, /color:#bd633f/)
  assert.match(clean, /font-size:32px/)
  assert.doesNotMatch(
    clean,
    /script|iframe|onerror|onclick|javascript:|position|background-image|site-header|evil.example|display:none/,
  )
  assert.doesNotMatch(
    sanitizeContent(
      '<svg><foreignObject><iframe srcdoc="<script>alert(1)</script>"></iframe></foreignObject></svg>',
    ),
    /<svg|<iframe|<script/,
  )
})

test('document schema rejects invalid styles, duplicate IDs, huge documents and unsafe images', () => {
  assert.equal(companyDocumentSchema.safeParse(testDocument).success, true)
  const first = testDocument.blocks[0]
  for (const blocks of [
    [first, first],
    [{ ...first, style: { ...first.style, color: 'url(javascript:alert(1))' } }],
    [{ ...first, type: 'image', content: 'data:image/svg+xml,<svg onload=alert(1)>' }],
    Array.from({ length: 81 }, (_, i) => ({ ...first, id: String(i) })),
    Array.from({ length: 6 }, (_, i) => ({ ...first, id: String(i), content: '가'.repeat(20000) })),
  ])
    assert.equal(companyDocumentSchema.safeParse({ version: 1, blocks }).success, false)
})

test('image references include covers, image blocks and embedded Markdown/HTML uploads', () => {
  const url = '/api/media/12345678-1234-1234-1234-123456789012.webp'
  assert.deepEqual(
    documentImageUrls({
      image: url,
      document: {
        blocks: [
          { type: 'markdown', content: `![자료](${url})` },
          { type: 'image', content: '/images/second.webp' },
        ],
      },
    }),
    [url, '/images/second.webp'],
  )
})
