import { memo, useMemo } from 'react'
import {
  documentHtml,
  fontStylesheet,
  sanitizeContent,
  type CompanyDocument,
} from '../../shared/company-document.mjs'
import './company-document.css'

// 저장된 본문과 편집기 미리보기의 공통 렌더러입니다. blob URL 이미지는 편집기 미리보기에서만 허용합니다.
// 이전 블록 형식도 documentHtml에서 HTML로 바꿔 같은 규칙으로 정제합니다.
export default memo(function CompanyDocumentView({
  document,
  localImages = false,
}: {
  document: CompanyDocument
  localImages?: boolean
}) {
  const html = useMemo(
    () => sanitizeContent(documentHtml(document), { localImages }),
    [document, localImages],
  )
  const fonts = fontStylesheet(html)
  return (
    <>
      {/* React가 head로 옮기며, 같은 주소는 한 번만 불러옵니다. */}
      {fonts && <link rel="stylesheet" href={fonts} precedence="default" />}
      <div className="company-rich-document se-content" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  )
})
