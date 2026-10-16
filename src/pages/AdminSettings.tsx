import { useEffect, useState, type FormEvent } from 'react'
import { Save, ShieldCheck } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import type { PublicData, Settings } from '../lib/types'
import { ErrorNotice } from '../components/ui'

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    api<PublicData>('/admin/content')
      .then((data) => {
        if (!active) return
        setSettings(data.settings)
      })
      .catch((e) => {
        if (active) setError(errorMessage(e))
      })
    return () => {
      active = false
    }
  }, [])
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) })
      setMessage('사이트 설정을 저장했습니다.')
      // App의 공개 데이터도 다시 읽어 공통 헤더·연락처·홈 문구를 함께 갱신합니다.
      window.dispatchEvent(new Event('content-updated'))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">SITE SETTINGS</p>
          <h1>사이트 설정</h1>
          <p>홈페이지의 기본 정보와 연락처를 관리하세요.</p>
        </div>
        <span className="small-pill">
          <ShieldCheck size={14} />
          관리자 전용
        </span>
      </div>
      {error && <ErrorNotice message={error} />}
      {settings && (
        <form onSubmit={save} className="settings-form">
          <section className="admin-card padded">
            <h2>메인 화면</h2>
            <p className="muted">홈페이지 첫 화면에 표시되는 메시지입니다.</p>
            <label>
              메인 제목
              <textarea
                required
                maxLength={120}
                rows={2}
                value={settings.heroTitle}
                onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
              />
            </label>
            <label>
              메인 설명
              <textarea
                rows={3}
                maxLength={500}
                value={settings.heroDescription}
                onChange={(e) => setSettings({ ...settings, heroDescription: e.target.value })}
              />
            </label>
          </section>
          <section className="admin-card padded">
            <h2>사무소 기본 정보</h2>
            <div className="admin-form-grid two">
              {(
                [
                  ['name', '사무소명'],
                  ['phone', '대표전화'],
                  ['representative', '대표자'],
                  ['businessNumber', '사업자등록번호'],
                  ['email', '이메일'],
                  ['kakaoUrl', '카카오톡 채널 주소'],
                ] as [keyof Settings, string][]
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    required={['name', 'phone'].includes(key)}
                    type={key === 'email' ? 'email' : 'text'}
                    value={settings[key]}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            {(
              [
                ['address', '본사무소 주소'],
                ['branchAddress', '분사무소 주소'],
                ['hours', '상담 시간 안내'],
              ] as [keyof Settings, string][]
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  maxLength={300}
                  value={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                />
              </label>
            ))}
          </section>
          {message && (
            <p className="success-message" role="status">
              {message}
            </p>
          )}
          <button className="button" disabled={busy}>
            <Save size={17} />
            {busy ? '저장 중…' : '변경 내용 저장'}
          </button>
        </form>
      )}
    </>
  )
}
