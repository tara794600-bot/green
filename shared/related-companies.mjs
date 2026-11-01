// 상세페이지 아래에 연결할 다른 공개 업체를 고릅니다. 서버(첫 HTML)와 브라우저가 같은 결과를 내도록 공유합니다.
// 같은 유형 중 등록일이 가까운 업체를 먼저, 부족하면 다른 유형으로 채웁니다.
// 모든 상세페이지가 최신 업체 몇 곳만 가리키지 않고 서로 고르게 연결되어 검색로봇이 모든 업체를 찾습니다.
// 날짜가 없는 이전 자료는 가장 뒤로 보냅니다.
export function relatedCompanies(companies, item, limit = 6) {
  const time = Date.parse(item.createdAt)
  const distance = (c) => {
    const gap = Math.abs(Date.parse(c.createdAt) - time)
    return Number.isNaN(gap) ? Infinity : gap
  }
  const others = companies.filter((c) => c.id !== item.id).sort((a, b) => distance(a) - distance(b))
  return [
    ...others.filter((c) => c.service === item.service),
    ...others.filter((c) => c.service !== item.service),
  ].slice(0, limit)
}
