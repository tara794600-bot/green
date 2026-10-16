import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Search, Pencil, Trash2, ExternalLink, Save, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, dateTime, errorMessage } from '../lib/api'
import { kindLabels, type Article, type ArticleKind, type PublicData } from '../lib/types'
import { EmptyState, ErrorNotice, Modal } from '../components/ui'

const pathFor = (a: Article) =>
  ({ practice: '/practice/', case: '/cases/', guide: '/guides/', faq: '/faq#', lawyer: '/lawyers/' })[
    a.kind
  ] + a.id
// 공개 API와 달리 비공개 글도 불러옵니다. 한 Article 형식으로 업무 분야·사례·가이드 등을 관리합니다.
export default function ContentManager() {
  const [articles, setArticles] = useState<Article[]>([]),
    [kind, setKind] = useState<ArticleKind>('case'),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [edit, setEdit] = useState<Article | null>(null),
    [loading, setLoading] = useState(true)
  const refresh = useCallback(
    () =>
      api<PublicData>('/admin/content')
        .then((data) => {
          setArticles(data.articles)
          setError('')
        })
        .catch((e) => setError(errorMessage(e)))
        .finally(() => setLoading(false)),
    [],
  )
  useEffect(() => {
    void refresh()
  }, [refresh])
  const filtered = articles.filter((a) => a.kind === kind && `${a.title} ${a.category}`.includes(query))
  function create() {
    setEdit({
      id: `${kind}-${crypto.randomUUID().slice(0, 8)}`,
      kind,
      category: kind === 'case' ? '투자·리딩방 사기' : '나란 안내',
      title: '',
      excerpt: '',
      body: '',
      checks: [],
      materials: [],
      flow: [],
      image: '',
      published: false,
      updatedAt: new Date().toISOString(),
    })
  }
  async function remove(a: Article) {
    if (!confirm(`“${a.title}” 콘텐츠를 삭제할까요?`)) return
    try {
      await api(`/admin/content/${a.id}`, { method: 'DELETE' })
      await refresh()
      window.dispatchEvent(new Event('content-updated'))
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">CONTENT STUDIO</p>
          <h1>콘텐츠 관리</h1>
          <p>나란의 이야기와 안내를 직접 편집하고 공개하세요.</p>
        </div>
        <button className="button small" onClick={create}>
          <Plus size={17} />새 콘텐츠
        </button>
      </div>
      {error && <ErrorNotice message={error} onRetry={refresh} />}
      <section className="admin-card">
        <div className="admin-tabs">
          {Object.entries(kindLabels).map(([key, label]) => (
            <button
              className={kind === key ? 'active' : ''}
              key={key}
              onClick={() => {
                setKind(key as ArticleKind)
                setQuery('')
              }}
            >
              {label}
              <span>{articles.filter((a) => a.kind === key).length}</span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <label className="search-box">
            <Search size={17} />
            <input
              aria-label="관리 콘텐츠 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목 또는 분야 검색"
            />
          </label>
          <span className="muted">전체 {filtered.length}개</span>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>제목</th>
                  <th>분류</th>
                  <th>공개 상태</th>
                  <th>수정일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button className="name-button content-name" onClick={() => setEdit(a)}>
                        {a.title}
                      </button>
                      <small className="table-secondary">/{a.id}</small>
                    </td>
                    <td>{a.category}</td>
                    <td>
                      <span className={`publish-badge ${a.published ? 'published' : ''}`}>
                        {a.published ? '공개' : '비공개'}
                      </span>
                    </td>
                    <td>{dateTime(a.updatedAt).split('오')[0]}</td>
                    <td>
                      <div className="table-actions">
                        {a.published && (
                          <Link
                            to={pathFor(a)}
                            target="_blank"
                            aria-label={`${a.title} 보기`}
                            className="icon-button"
                          >
                            <ExternalLink size={16} />
                          </Link>
                        )}
                        <button
                          className="icon-button"
                          aria-label={`${a.title} 수정`}
                          onClick={() => setEdit(a)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`${a.title} 삭제`}
                          onClick={() => remove(a)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={loading ? '콘텐츠를 불러오는 중입니다.' : '표시할 콘텐츠가 없습니다.'}
            description="검색어를 바꾸거나 새 콘텐츠를 작성해 주세요."
          />
        )}
      </section>
      {edit && (
        <ContentEditor
          article={edit}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            await refresh()
            setEdit(null)
            window.dispatchEvent(new Event('content-updated'))
          }}
        />
      )}
    </>
  )
}
function ContentEditor({
  article,
  onClose,
  onSaved,
}: {
  article: Article
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [form, setForm] = useState(article),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(false)
  // 목록 필드는 편집 중 줄바꿈 문자열로 다루고 저장할 때 빈 줄을 제외한 배열로 변환합니다.
  const [checks, setChecks] = useState(article.checks.join('\n')),
    [materials, setMaterials] = useState(article.materials.join('\n')),
    [flow, setFlow] = useState(article.flow.join('\n'))
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/admin/content', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          checks: checks.split('\n').filter(Boolean),
          materials: materials.split('\n').filter(Boolean),
          flow: flow.split('\n').filter(Boolean),
        }),
      })
      await onSaved()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  // 일반 콘텐츠 이미지는 선택 즉시 업로드합니다. 업체 편집기의 저장 시 업로드 흐름과 다릅니다.
  async function upload(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setError('JPG, PNG, WebP 이미지를 3MB 이하로 선택해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const result = await api<{ url: string }>('/admin/upload', {
        method: 'POST',
        body: JSON.stringify({ data }),
      })
      setForm((f) => ({ ...f, image: result.url }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  function close() {
    const changed =
      JSON.stringify(form) !== JSON.stringify(article) ||
      checks !== article.checks.join('\n') ||
      materials !== article.materials.join('\n') ||
      flow !== article.flow.join('\n')
    if (!changed || confirm('저장하지 않은 내용을 닫을까요?')) onClose()
  }
  return (
    <Modal title={`${kindLabels[form.kind]} 편집`} onClose={close} wide>
      <div className="editor-tabs">
        <button className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>
          내용 작성
        </button>
        <button className={preview ? 'active' : ''} onClick={() => setPreview(true)}>
          본문 미리보기
        </button>
      </div>
      {preview ? (
        <div className="editor-preview">
          <p className="eyebrow">{form.category}</p>
          <h2>{form.title || '제목 없음'}</h2>
          <p>{form.excerpt}</p>
          {form.image && <img src={form.image} alt="콘텐츠 이미지 미리보기" />}
          <p className="pre-wrap">{form.body}</p>
          <ul>
            {checks
              .split('\n')
              .filter(Boolean)
              .map((c, i) => (
                <li key={i}>{c}</li>
              ))}
          </ul>
          <p className="muted">미리보기입니다. 저장 후 사이트에 반영됩니다.</p>
        </div>
      ) : (
        <form onSubmit={save}>
          <div className="admin-form-grid two">
            <label>
              제목
              <input
                required
                minLength={2}
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              분류
              <input
                maxLength={80}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                list="content-categories"
              />
              <datalist id="content-categories">
                {[
                  '투자·리딩방 사기',
                  '출금 거부 거래소',
                  '유사수신·다단계',
                  '코인·가상자산 사기',
                  '기획 투자사기',
                  '부업·재테크 사기',
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </label>
          </div>
          <label>
            요약 설명
            <textarea
              rows={2}
              maxLength={600}
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            />
          </label>
          <label>
            본문
            <textarea
              className="editor-body"
              rows={8}
              maxLength={20000}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <div className="admin-form-grid two">
            <label>
              확인할 내용 / 경력<small>한 줄에 한 항목씩 입력</small>
              <textarea rows={4} value={checks} onChange={(e) => setChecks(e.target.value)} />
            </label>
            <label>
              준비 자료<small>한 줄에 한 항목씩 입력</small>
              <textarea rows={4} value={materials} onChange={(e) => setMaterials(e.target.value)} />
            </label>
          </div>
          {form.kind === 'case' && (
            <label>
              상황의 흐름<small>한 줄에 한 단계씩 입력</small>
              <textarea rows={3} value={flow} onChange={(e) => setFlow(e.target.value)} />
            </label>
          )}
          <label>
            이미지 주소
            <input
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="/images/… 또는 https://…"
            />
          </label>
          <label className="upload-button">
            <Upload size={16} />
            {busy ? '처리 중…' : '이미지 업로드'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          <small className="muted">JPG · PNG · WebP, 최대 3MB</small>
          <div className="editor-publish">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              <span>사이트에 공개하기</span>
            </label>
            <p>비공개 콘텐츠는 홈페이지와 검색 목록에 표시되지 않습니다.</p>
          </div>
          {error && <ErrorNotice message={error} />}
          <div className="button-row">
            <button type="button" className="button outline" onClick={close}>
              취소
            </button>
            <button className="button" disabled={busy}>
              <Save size={16} />
              {busy ? '저장 중…' : '저장하기'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
