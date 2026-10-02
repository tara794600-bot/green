export const testBlockStyle = {
  color: '#263b2c',
  background: '#f1f5ec',
  borderColor: '#dce4d7',
  accent: '#59754a',
  shadow: 'soft',
  animation: 'fade',
  align: 'left',
  radius: 12,
  padding: 24,
  borderWidth: 1,
  fontSize: 16,
}
export const testDocument = {
  version: 1,
  blocks: [
    {
      id: 'intro',
      type: 'markdown',
      content:
        '## 상세 안내\n\n**확인할 내용**\n\n| 항목 | 수량 |\n| --- | --- |\n| 자료 | 12 |\n\n- [x] 자료 확인',
      caption: '',
      style: testBlockStyle,
    },
    {
      id: 'number',
      type: 'stat',
      content: '128건',
      caption: '확인한 자료',
      style: { ...testBlockStyle, fontSize: 48, align: 'center' },
    },
    {
      id: 'diagram',
      type: 'mermaid',
      content: 'flowchart LR\n A[확인] --> B[상담]',
      caption: '',
      style: testBlockStyle,
    },
    {
      id: 'html',
      type: 'html',
      content:
        '<div class="doc-box" style="color:#bc5432"><strong>HTML 안내</strong></div><script>alert(1)</script>',
      caption: '',
      style: testBlockStyle,
    },
  ],
}
