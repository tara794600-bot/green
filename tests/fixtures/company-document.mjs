// API·본문 변환·SSR 검증에서 공유하는 문서입니다. 차단 대상 HTML도 의도적으로 포함합니다.
export const testDocument = {
  version: 2,
  html:
    '<h2>상세 안내</h2>' +
    '<p style="text-align: center; line-height: 2"><span style="color: #e5212e; font-family: \'Nanum Gothic\', sans-serif; font-size: 19px"><strong>확인할 내용</strong></span> 과 <mark data-color="#fff3a3" style="background-color: #fff3a3; color: inherit">형광펜</mark></p>' +
    '<div class="tableWrapper"><table style="min-width: 50px"><colgroup><col style="min-width: 25px"><col style="min-width: 25px"></colgroup><tbody><tr><th><p>항목</p></th><th><p>수량</p></th></tr><tr><td style="background-color: #fff3a3"><p>자료</p></td><td><p>12</p></td></tr></tbody></table></div>' +
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>자료 확인</p></div></li></ul>' +
    '<blockquote data-style="postit"><p><strong>HTML 안내</strong></p></blockquote>' +
    '<hr data-style="diamond">' +
    '<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="640" height="360" allowfullscreen="true"></iframe></div>' +
    '<a data-type="linkCard" href="https://example.com" target="_blank" rel="noopener noreferrer"><strong>참고 자료</strong><small>example.com</small></a>' +
    '<script>alert(1)</script><iframe src="https://evil.example/embed/x"></iframe><img src="/images/lawyer-seo.webp" onerror="alert(1)">',
}

// 이전 블록 편집기로 저장된 문서입니다. 읽기·유지 호환성을 검증합니다.
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
export const legacyDocument = {
  version: 1,
  blocks: [
    {
      id: 'intro',
      type: 'markdown',
      content:
        '## 이전 안내\n\n**확인할 내용**\n\n| 항목 | 수량 |\n| --- | --- |\n| 자료 | 12 |\n\n- [x] 자료 확인',
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
        '<div class="doc-box" style="color:#bc5432"><strong>이전 HTML 안내</strong></div><script>alert(1)</script>',
      caption: '',
      style: testBlockStyle,
    },
  ],
}
