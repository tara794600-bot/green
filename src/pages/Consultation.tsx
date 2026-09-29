import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ShieldCheck, Phone, Pencil } from 'lucide-react'
import { PageHero, Checklist, Modal, ErrorNotice } from '../components/ui'
import { useContent } from '../lib/content-context'
import { api, errorMessage } from '../lib/api'
import type { AppConfig } from '../lib/types'
import { visitFields } from '../lib/attribution'

export default function Consultation() {
  const { settings, articles } = useContent(),
    [params] = useSearchParams(),
    formRef = useRef<HTMLFormElement>(null)
  const categories = [
    ...articles.filter((a) => a.kind === 'practice').map((a) => a.category),
    '기타·잘 모르겠어요',
  ]
  const [form, setForm] = useState({
    name: '',
    phone: '',
    category: categories.includes(params.get('category') || '')
      ? params.get('category')!
      : '기타·잘 모르겠어요',
    details: params.get('company') ? `관련 업체: ${params.get('company')?.slice(0, 80)}\n` : '',
    preferredTime: '',
    consent: false,
    website: '',
  })
  const [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState<{ id: string; localPreview: boolean } | null>(null),
    [local, setLocal] = useState(false)
  const requestId = useRef(crypto.randomUUID())
  useEffect(() => {
    api<AppConfig>('/config')
      .then((c) => setLocal(c.localPreview))
      .catch(() => {})
  }, [])
  function check(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^0\d{8,10}$/.test(form.phone.replace(/[\s()-]/g, ''))) {
      setError('연락처를 확인해 주세요. 예: 010-1234-5678')
      return
    }
    setReview(true)
  }
  async function send() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await api<{ id: string; localPreview: boolean }>('/consultation', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          requestId: requestId.current,
          source: location.pathname + location.search,
          ...visitFields(),
        }),
      })
      setReceipt(result)
      setReview(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  if (receipt)
    return (
      <section className="container receipt-page">
        <CheckCircle2 size={52} strokeWidth={1} />
        <p className="eyebrow">THANK YOU FOR YOUR TRUST</p>
        <h1>{receipt.localPreview ? '개발용 접수가 저장되었습니다.' : '당신의 이야기가 도착했습니다.'}</h1>
        <p>
          {receipt.localPreview
            ? '개발 환경에 접수 내용이 저장되었습니다. 실제 상담 요청이나 외부 알림은 전송되지 않았습니다.'
            : '남겨주신 내용을 확인한 뒤 담당자가 연락드리겠습니다.'}
        </p>
        <div className="receipt">
          <span>접수번호</span>
          <strong>{receipt.id}</strong>
          <span>연락처</span>
          <strong>{form.phone}</strong>
          <span>상담 분야</span>
          <strong>{form.category}</strong>
        </div>
        <div className="button-row">
          <Link className="button" to="/">
            홈으로 돌아가기
            <ArrowRight size={16} />
          </Link>
          <a className="button outline" href={`tel:${settings.phone}`}>
            <Phone size={16} />
            전화 문의
          </a>
        </div>
      </section>
    )
  return (
    <>
      <PageHero
        eyebrow="CONTACT NARAN"
        title={'잘 정리된 말이 아니어도,\n괜찮습니다.'}
        description="현재 상황과 궁금한 점을 남겨주세요. 당신의 이야기를 듣는 것부터 시작하겠습니다."
      />
      <section className="section container consultation-grid">
        <div className="consultation-aside">
          <p className="eyebrow">TALK TO NARAN</p>
          <h2>
            당신의 이야기부터
            <br />
            들려주세요.
          </h2>
          <a className="phone-display" href={`tel:${settings.phone}`}>
            {settings.phone}
          </a>
          <p className="muted">상담 방식과 예약 가능 시간, 비용은 전화로 확인해 주세요.</p>
          <Checklist
            items={[
              '피해 경위를 간단히 정리하세요.',
              '현재 보유한 자료를 확인하세요.',
              '궁금한 질문을 적어두세요.',
            ]}
          />
          <Link className="arrow-link" to="/faq">
            자주 묻는 질문 보기
            <ArrowRight size={16} />
          </Link>
          <div className="privacy-note">
            <ShieldCheck size={20} />
            <p>
              남겨주신 정보는 상담 연락과
              <br />
              신청 내용 확인에 사용됩니다.
            </p>
          </div>
        </div>
        <form id="consultation-form" className="consultation-form" ref={formRef} onSubmit={check}>
          <div className="form-heading">
            <h3>상담 신청</h3>
            <span>
              <b>*</b> 필수 입력
            </span>
          </div>
          {local && (
            <div className="notice">
              현재 개발 환경입니다. 접수는 이 컴퓨터에만 저장되며 실제 상담이나 외부 알림은 전송되지 않습니다.
            </div>
          )}
          <label>
            성함 <b>*</b>
            <input
              required
              minLength={2}
              maxLength={60}
              autoComplete="name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="성함을 입력해 주세요"
            />
          </label>
          <label>
            연락처 <b>*</b>
            <input
              required
              maxLength={20}
              type="tel"
              autoComplete="tel"
              name="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-0000-0000"
            />
          </label>
          <label>
            상담 분야 <b>*</b>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            연락 가능 시간 <span className="optional">선택</span>
            <select
              value={form.preferredTime}
              onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
            >
              <option value="">편하신 시간을 선택해 주세요</option>
              <option>오전 (09:00~12:00)</option>
              <option>오후 (12:00~18:00)</option>
              <option>별도 협의 희망</option>
            </select>
          </label>
          <label>
            현재 상황 <span className="optional">선택</span>
            <textarea
              rows={5}
              maxLength={4000}
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="어떤 상황인지 편하게 남겨주세요. 주민등록번호, 비밀번호 등 민감한 정보는 입력하지 마세요."
            />
            <small className="char-count">{form.details.length.toLocaleString()} / 4,000</small>
          </label>
          <div className="honeypot" aria-hidden="true">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </label>
          </div>
          <div className="consent-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
              />
              <span>
                개인정보 수집·이용에 동의합니다. <b>*</b>
              </span>
            </label>
            <Link to="/privacy" target="_blank">
              내용 보기
              <ArrowUpIcon />
            </Link>
          </div>
          {error && !review && <ErrorNotice message={error} />}
          <button className="button full" type="submit">
            입력 내용 확인
            <ArrowRight size={17} />
          </button>
          <p className="form-footnote">내용 확인 후 최종 신청할 수 있습니다.</p>
        </form>
      </section>
      {review && (
        <Modal
          title="상담 신청 내용을 확인해 주세요"
          onClose={() => {
            if (!busy) setReview(false)
          }}
        >
          <p className="muted">연락받을 번호와 입력하신 내용이 맞는지 확인해 주세요.</p>
          <dl className="review-list">
            <dt>성함</dt>
            <dd>{form.name}</dd>
            <dt>연락처</dt>
            <dd>{form.phone}</dd>
            <dt>상담 분야</dt>
            <dd>{form.category}</dd>
            <dt>연락 가능 시간</dt>
            <dd>{form.preferredTime || '미지정'}</dd>
            <dt>현재 상황</dt>
            <dd>{form.details || '입력하지 않음'}</dd>
          </dl>
          {error && <ErrorNotice message={error} />}
          <div className="button-row">
            <button className="button outline" disabled={busy} onClick={() => setReview(false)}>
              <Pencil size={16} />
              수정하기
            </button>
            <button className="button" disabled={busy} onClick={send}>
              {busy ? '접수 중…' : local ? '개발용 접수 저장' : '상담 신청 완료'}
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
function ArrowUpIcon() {
  return <span aria-hidden="true">↗</span>
}
