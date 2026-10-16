import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  FileText,
  Settings,
  LogOut,
  ExternalLink,
  LockKeyhole,
  ArrowRight,
  Menu,
  X,
  Eye,
  EyeOff,
  Layers,
  Building2,
  Link2,
} from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import type { AdminIdentity, AppConfig } from '../lib/types'
import { ErrorNotice } from '../components/ui'
import './admin.css'
const ContentManager = lazy(() => import('./ContentManager'))
const AdminSettings = lazy(() => import('./AdminSettings'))
const AdminReference = lazy(() => import('./AdminReference'))
// 현재 제공하는 다섯 메뉴입니다. 서버에 남아 있는 상담·감사 API와 화면 범위는 다릅니다.
const nav = [
  { path: '/admin/rolling', label: '홈 롤링 사례', icon: Layers },
  { path: '/admin/companies', label: '사기업체 관리', icon: Building2 },
  { path: '/admin/powerlinks', label: '파워링크 URL', icon: Link2 },
  { path: '/admin/content', label: '콘텐츠 관리', icon: FileText },
  { path: '/admin/settings', label: '사이트 설정', icon: Settings },
]
export default function Admin() {
  const [config, setConfig] = useState<AppConfig | null>(null),
    [identity, setIdentity] = useState<AdminIdentity | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    let active = true
    async function init() {
      try {
        const c = await api<AppConfig>('/config')
        if (!active) return
        setConfig(c)
        // 비밀번호나 토큰을 JS 저장소에서 복원하지 않고 HttpOnly 쿠키의 서버 세션을 조회합니다.
        if (c.passwordConfigured) {
          try {
            const user = await api<AdminIdentity>('/admin/me')
            if (active) setIdentity(user)
          } catch {
            /* login required */
          }
        }
      } catch (e) {
        if (active) setError(errorMessage(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [])
  async function signOut() {
    try {
      await api('/admin/logout', { method: 'POST' })
      setIdentity(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  if (loading)
    return (
      <div className="loading-screen">
        <span className="wordmark">나란</span>
        <p>관리자 화면을 준비하고 있습니다.</p>
      </div>
    )
  if (!identity)
    return (
      <AdminLogin
        config={config}
        error={error}
        onLogin={(user) => {
          setIdentity(user)
          if (config) setConfig({ ...config, passwordConfigured: true })
        }}
      />
    )
  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${menu ? 'open' : ''}`}>
        <Link className="admin-brand" to="/admin">
          <span className="wordmark">나란</span>
          <span>ADMIN CONSOLE</span>
        </Link>
        <button className="icon-button sidebar-close" aria-label="메뉴 닫기" onClick={() => setMenu(false)}>
          <X size={22} />
        </button>
        <p className="sidebar-section-label">WORKSPACE</p>
        <nav aria-label="관리자 메뉴">
          {nav.map((n) => (
            <NavLink key={n.path} to={n.path} onClick={() => setMenu(false)}>
              <n.icon size={19} strokeWidth={1.6} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="admin-user">
            <span>N</span>
            <div>
              <strong>나란 관리자</strong>
              <small>사이트 운영 관리</small>
            </div>
          </div>
          <button onClick={signOut}>
            <LogOut size={17} />
            로그아웃
          </button>
        </div>
      </aside>
      {menu && <button aria-label="메뉴 닫기" className="sidebar-backdrop" onClick={() => setMenu(false)} />}
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <button
              className="icon-button admin-menu"
              aria-label="관리자 메뉴 열기"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>나란 운영 관리</span>
            <span className="topbar-slash">/</span>
            <strong>{nav.find((n) => n.path === pathname)?.label || '관리'}</strong>
          </div>
          <Link to="/" target="_blank">
            사이트 보기
            <ExternalLink size={15} />
          </Link>
        </header>
        {config?.localPreview && (
          <div className="admin-preview-notice">
            <span className="status-dot amber" />
            개발 환경 · 이 컴퓨터에 저장된 데이터입니다. 외부 서비스는 설정 후 연결됩니다.
          </div>
        )}
        {error && <ErrorNotice message={error} />}
        <div className="admin-content">
          <Suspense fallback={<p>불러오는 중…</p>}>
            <Routes>
              <Route index element={<Navigate to="/admin/rolling" replace />} />
              {['consultations', 'integrations', 'audit'].map((path) => (
                <Route key={path} path={path} element={<Navigate to="/admin/rolling" replace />} />
              ))}
              <Route path="rolling" element={<AdminReference key="rolling" kind="rolling" />} />
              <Route path="companies" element={<AdminReference key="companies" kind="companies" />} />
              <Route path="powerlinks" element={<AdminReference key="powerlinks" kind="powerlinks" />} />
              <Route path="content" element={<ContentManager />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route
                path="*"
                element={
                  <div>
                    <h1>페이지를 찾을 수 없습니다.</h1>
                    <Link to="/admin/rolling">홈 롤링 사례 관리로 돌아가기</Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  )
}
function AdminLogin({
  config,
  error: initialError,
  onLogin,
}: {
  config: AppConfig | null
  error: string
  onLogin: (user: AdminIdentity) => void
}) {
  const [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError)
  const setup = config?.localPreview && !config.passwordConfigured
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    if (setup && password !== confirm) {
      setError('두 비밀번호가 일치하지 않습니다.')
      return
    }
    setBusy(true)
    try {
      onLogin(
        await api<AdminIdentity>(setup ? '/admin/setup' : '/admin/login', {
          method: 'POST',
          body: JSON.stringify({ password }),
        }),
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="admin-login">
      <div className="login-story">
        <Link className="brand" to="/">
          <span className="wordmark">나란</span>
          <span className="brand-detail">
            법무법인 나란<small>NARAN LAW FIRM</small>
          </span>
        </Link>
        <div>
          <p className="eyebrow">NARAN ADMINISTRATION</p>
          <h1>
            더 세심한 관리로,
            <br />한 걸음 더 나란히.
          </h1>
          <p>
            사례부터 콘텐츠까지.
            <br />
            나란의 모든 이야기를 한곳에서 관리하세요.
          </p>
        </div>
        <span>© NARAN LAW FIRM</span>
      </div>
      <div className="login-panel">
        <div className="login-box">
          <span className="login-icon">
            <LockKeyhole size={24} strokeWidth={1.3} />
          </span>
          <p className="eyebrow">ADMIN ACCESS</p>
          <h2>{setup ? '관리자 비밀번호 설정' : '관리자 로그인'}</h2>
          <p>
            {setup
              ? '처음 접속하셨습니다. 사용할 비밀번호를 정해 주세요.'
              : '관리자 비밀번호를 입력해 주세요.'}
          </p>
          <form onSubmit={submit}>
            <label>
              비밀번호
              <div className="password-field">
                <input
                  type={visible ? 'text' : 'password'}
                  autoComplete={setup ? 'new-password' : 'current-password'}
                  minLength={8}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상의 비밀번호"
                />
                <button
                  type="button"
                  aria-label={visible ? '비밀번호 숨기기' : '비밀번호 표시'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {setup && (
              <label>
                비밀번호 확인
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="한 번 더 입력해 주세요"
                />
              </label>
            )}
            {error && <ErrorNotice message={error} />}
            <button
              className="button full"
              disabled={busy || !config || (!config.localPreview && !config.passwordConfigured)}
            >
              {busy ? '확인 중…' : setup ? '비밀번호 설정하고 시작하기' : '로그인'}
              <ArrowRight size={17} />
            </button>
          </form>
          {config && !config.passwordConfigured && !config.localPreview && (
            <div className="notice">
              서버에 관리자 비밀번호 설정이 필요합니다. 설치 안내의 admin:password 명령을 실행해 주세요.
            </div>
          )}
          {config?.localPreview && (
            <p className="login-footnote">개발 환경 · 비밀번호는 암호화된 해시로 저장됩니다.</p>
          )}
          <Link className="login-home" to="/">
            홈페이지로 돌아가기
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
