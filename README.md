# 법무법인 나란

SVG 디자인을 바탕으로 구현한 반응형 홈페이지, 상세페이지, 비밀번호 기반 관리자 시스템입니다.

```powershell
npm install
npm run dev
```

홈페이지: http://127.0.0.1:5173/  
관리자: http://127.0.0.1:5173/admin

참고 사이트의 홈 롤링 사례, 사기업체 등록·수정·노출 설정, 파워링크 URL 생성 기능을 포함합니다. [관리자 기능 대조표](./ADMIN_FEATURE_PARITY.md)에서 반영 항목을 확인할 수 있습니다.

관리자는 첫 접속에서 비밀번호를 정한 후 **비밀번호만 입력해 로그인**합니다.

Firebase·Telegram·Google Sheets 연동 코드를 포함합니다. 현재 키가 없어 개발용 로컬 저장을 사용합니다. 실제 연결과 배포 방법은 [운영 안내](./OPERATIONS.md)를 참고하세요.

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
```
