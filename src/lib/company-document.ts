import type { BlockStyle, BlockType, CompanyDocument, DocumentBlock } from '../../shared/company-document.mjs'

export const blockLabels: Record<BlockType, string> = {
  markdown: '텍스트 · 마크다운',
  callout: '강조 박스',
  stat: '숫자 강조',
  mermaid: '다이어그램',
  html: 'HTML',
  image: '이미지',
  divider: '구분선',
}
export const defaultBlockStyle: BlockStyle = {
  color: '#263b2c',
  background: 'transparent',
  borderColor: '#dce4d7',
  accent: '#59754a',
  shadow: 'none',
  animation: 'none',
  align: 'left',
  radius: 12,
  padding: 0,
  borderWidth: 0,
  fontSize: 16,
}
export function createBlock(type: BlockType): DocumentBlock {
  return {
    id: crypto.randomUUID(),
    type,
    caption: '',
    content: '',
    style: {
      ...defaultBlockStyle,
      ...(type === 'callout' ? { background: '#f1f5ec', padding: 24, borderWidth: 1 } : {}),
      ...(type === 'stat'
        ? { background: '#f1f5ec', padding: 28, align: 'center' as const, fontSize: 48 }
        : {}),
      ...(type === 'mermaid' ? { background: '#f8faf6', padding: 20 } : {}),
    },
  }
}
export const diagramExample =
  'flowchart LR\n  A[상황 확인] --> B[자료 정리]\n  B --> C[상담 진행]\n  style A fill:#e8f0e0,stroke:#59754a,color:#263b2c\n  style B fill:#fff5dc,stroke:#b48a32,color:#54421b\n  style C fill:#e4edf8,stroke:#5a7fa4,color:#263b2c'
export function createTemplate(): CompanyDocument {
  const text = createBlock('markdown')
  text.content =
    '## 업체 관련 정보\n\n확인한 사실과 진행 상황을 작성하세요. **중요한 내용**은 굵게, 목록으로 읽기 쉽게 정리할 수 있습니다.\n\n- 업체명 및 사용 주소\n- 연락을 주고받은 경로\n- 확인한 피해 유형'
  const callout = createBlock('callout')
  callout.content = '**꼭 확인해 주세요**\n\n보관할 자료와 주의할 내용을 입력하세요.'
  const stat = createBlock('stat')
  stat.content = '00건'
  stat.caption = '확인된 자료 수 · 실제 수치로 수정해 주세요'
  const diagram = createBlock('mermaid')
  diagram.content = diagramExample
  return { version: 1, blocks: [text, callout, stat, diagram] }
}
