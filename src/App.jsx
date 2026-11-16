import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine, ArrowRight, Bell, BookOpen, CalendarDays, CheckCircle2,
  ChevronDown, Clock3, FileText, LayoutDashboard,
  Info, LogOut, Menu, NotebookPen, Plus, Search, ShieldCheck, Trash2, Upload,
  UserRound, Users, Video, X, Pencil, Megaphone, Camera, Quote, AlertTriangle,
} from 'lucide-react'
import { initialData, subjects, semesters } from './data'
import { isSupabaseConfigured, supabase } from './supabase'
import DiaryFeed from './components/DiaryFeed'
import {
  formatSriLankaDate,
  formatSriLankaDateTimeLocal,
  formatSriLankaTime,
  getGreeting,
  getSriLankaDateInputValue,
  sriLankaDateTimeLocalToISOString,
} from './lib/time.ts'

const roleNavigation = {
  admin: ['Admin Dashboard', 'Users', 'Lecturers', 'Lecture Notes', 'Upload Your Notes', 'Assignments', 'Zoom Links', 'Deadlines', 'Announcements', 'Diary'],
  lecturer: ['Dashboard', 'Lecture Notes', 'Upload Your Notes', 'Assignments', 'Zoom Links', 'Deadlines', 'Students', 'Diary'],
  student: ['Dashboard', 'Lecture Notes', 'Upload Your Notes', 'Assignments', 'Zoom Links', 'My Notes', 'My Diary'],
}

const tableFor = {
  'Lecture Notes': 'lecture_notes',
  Assignments: 'assignments',
  'Zoom Links': 'zoom_meetings',
  Deadlines: 'deadlines',
  'My Notes': 'student_notes',
  'My Diary': 'diary',
  Announcements: 'announcements',
  Users: 'users',
  Students: 'students',
}

const actionToTable = {
  note_create: 'lecture_notes', note_update: 'lecture_notes', note_delete: 'lecture_notes',
  assignment_create: 'assignments', assignment_update: 'assignments', assignment_delete: 'assignments',
  assignment_info_create: 'assignment_information', assignment_info_update: 'assignment_information', assignment_info_delete: 'assignment_information',
  zoom_create: 'zoom_meetings', zoom_update: 'zoom_meetings', zoom_delete: 'zoom_meetings',
  deadline_create: 'deadlines', deadline_update: 'deadlines', deadline_delete: 'deadlines',
  announcement_create: 'announcements', announcement_update: 'announcements', announcement_delete: 'announcements',
  user_create: 'users', user_update: 'users', user_delete: 'users',
  student_note_create: 'student_notes', student_note_delete: 'student_notes',
  diary_create: 'diary', diary_delete: 'diary',
}

const sessionStorageKeys = ['ucb_user', 'ucb_role', 'ucb_session']

function readStoredSession() {
  if (!isSupabaseConfigured) return null
  try {
    const userValue = sessionStorage.getItem('ucb_user')
    const role = sessionStorage.getItem('ucb_role')
    const token = sessionStorage.getItem('ucb_session')
    if (!userValue || !role || !token) return null
    const user = JSON.parse(userValue)
    if (!user?.id || user.role !== role || !['admin', 'lecturer', 'student'].includes(role)) {
      throw new Error('Stored sign-in data is incomplete or invalid.')
    }
    return { user, token }
  } catch (error) {
    console.error('Could not restore the browser-tab session:', error)
    clearStoredSession()
    return null
  }
}

function saveStoredSession(user, token) {
  try {
    sessionStorage.setItem('ucb_user', JSON.stringify(user))
    sessionStorage.setItem('ucb_role', user.role)
    sessionStorage.setItem('ucb_session', token)
  } catch (error) {
    console.error('Could not save the browser-tab session:', error)
    clearStoredSession()
    throw new Error('Your browser could not retain this sign-in for the current tab.')
  }
}

function clearStoredSession() {
  try {
    sessionStorageKeys.forEach((key) => sessionStorage.removeItem(key))
  } catch (error) {
    console.error('Could not clear the browser-tab session:', error)
  }
}

function App() {
  const [initialSession] = useState(readStoredSession)
  const [user, setUser] = useState(initialSession?.user || null)
  const [token, setToken] = useState(initialSession?.token || '')
  const [active, setActive] = useState(initialSession?.user.role === 'admin' ? 'Admin Dashboard' : 'Dashboard')
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [diaryNotes, setDiaryNotes] = useState([])
  const [diaryPage, setDiaryPage] = useState(0)
  const [diaryHasMore, setDiaryHasMore] = useState(false)
  const [diaryLoading, setDiaryLoading] = useState(true)
  const [diaryLoadingMore, setDiaryLoadingMore] = useState(false)
  const [diaryError, setDiaryError] = useState('')
  const [greeting, setGreeting] = useState(getGreeting)

  const role = user?.role || 'student'
  const isAdmin = role === 'admin'
  const isLecturer = role === 'lecturer'
  const isStudent = role === 'student'
  const canManageCoursework = isAdmin || isLecturer
  const navigation = roleNavigation[role] || roleNavigation.student

  useEffect(() => {
    const timer = window.setInterval(() => setGreeting(getGreeting()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!user) {
      setDiaryNotes([])
      setDiaryPage(0)
      setDiaryHasMore(false)
      setDiaryLoading(false)
      setDiaryError('')
      return undefined
    }

    if (!isSupabaseConfigured || !supabase) {
      setDiaryLoading(false)
      setDiaryError('Supabase is not configured, so the public diary is unavailable.')
      return undefined
    }

    let active = true
    setDiaryLoading(true)
    fetchPublicDiaryPage(0)
      .then((rows) => {
        if (!active) return
        setDiaryNotes((current) => mergeDiaryNotes(rows, current))
        setDiaryPage(0)
        setDiaryHasMore(rows.length === 10)
      })
      .catch((error) => {
        if (!active) return
        console.error('Public diary load failed:', error)
        setDiaryError(error.message)
      })
      .finally(() => {
        if (active) setDiaryLoading(false)
      })

    const channel = supabase.channel('diary-realtime')
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'diary_notes' }, (payload) => {
        setDiaryNotes((current) => current.filter((note) => note.id !== payload.old?.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diary_notes' }, (payload) => {
        enrichPublicDiaryNotes([payload.new])
          .then(([note]) => {
            if (active) setDiaryNotes((current) => mergeDiaryNotes([note], current))
          })
          .catch((error) => {
            if (active) {
              console.error('Could not resolve public diary author role:', error)
              setDiaryError(error.message)
            }
          })
      })
      .subscribe((status, error) => {
        if (active && error) {
          console.error('Public diary realtime subscription failed:', error)
          setDiaryError(error.message)
        } else if (active && status === 'CHANNEL_ERROR') {
          setDiaryError('Live diary updates are unavailable.')
        }
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!user || !isSupabaseConfigured || !token) return
    let cancelled = false
    setLoading(true)
    loadData(token)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('hub_get_data RPC failed:', error)
        setNotice(`Couldn't load your study hub: ${error.message}`)
        if (error.message.includes('Session expired')) {
          clearStoredSession()
          setUser(null)
          setToken('')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user, token])

  const pageTitle = active === 'Dashboard' || active === 'Admin Dashboard'
    ? isAdmin ? 'Admin Dashboard' : `${greeting}, ${user?.name?.split(' ')[0] || 'there'}`
    : active

  async function login(userId, password, selectedRole) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and a Supabase anon or publishable key, then restart the dev server.')
    }

    const { data: result, error } = await supabase.rpc('login_user', {
      p_id: userId.trim(),
      p_password: password.trim(),
    })
    const debugResult = result && typeof result === 'object'
      ? { ...result, session_token: result.session_token ? '[redacted]' : result.session_token }
      : result
    console.log('Login RPC result:', debugResult, error)
    if (error) {
      console.error('Supabase login_user RPC failed:', error)
      throw new Error(error.message)
    }
    if (!result || result.success !== true) {
      throw new Error(result?.message || 'Login ID or password not recognized.')
    }

    const resultUser = result.user || result
    const accountId = result.id || resultUser.id
    const accountRole = String(result.role || resultUser.role || '').trim()
    const normalizedRole = accountRole.toLowerCase()
    if (!accountId || !normalizedRole) {
      throw new Error('The login_user RPC response is missing the account ID or role.')
    }
    if (String(selectedRole).trim().toLowerCase() !== normalizedRole) {
      if (result.session_token) {
        const { error: revokeError } = await supabase.rpc('hub_logout', { p_token: result.session_token })
        if (revokeError) throw new Error(`Role mismatch. Your account role is ${accountRole}. The temporary session could not be revoked: ${revokeError.message}`)
      }
      throw new Error(`Role mismatch. Your account role is ${accountRole}.`)
    }
    if (!result.session_token) {
      throw new Error('Login succeeded, but the login_user RPC did not return a session token needed to load study data. Run the latest supabase/schema.sql in the Supabase SQL Editor.')
    }

    const nextUser = {
      id: accountId,
      name: result.name || resultUser.name || accountId,
      role: normalizedRole,
    }
    saveStoredSession(nextUser, result.session_token)
    setToken(result.session_token)
    setUser(nextUser)
    setActive(nextUser.role === 'admin' ? 'Admin Dashboard' : 'Dashboard')
  }

  async function logout() {
    if (token && isSupabaseConfigured) {
      const { error } = await supabase.rpc('hub_logout', { p_token: token })
      if (error) setNotice(`Couldn't end the server session: ${error.message}`)
    }
    clearStoredSession()
    setUser(null)
    setToken('')
    setActive('Dashboard')
    setData(initialData)
  }

  async function loadData(sessionToken = token) {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.')
    const { data: result, error } = await supabase.rpc('hub_get_data', { p_token: sessionToken })
    if (error) throw new Error(error.message)
    const { data: studentNotes, error: studentNotesError } = await supabase.rpc('hub_mutate', {
      p_token: sessionToken,
      p_action: 'student_note_list',
      p_payload: {},
    })
    if (studentNotesError) throw new Error(studentNotesError.message)
    return normalizeRemoteData({
      ...result,
      shared_student_notes: Array.isArray(studentNotes) ? studentNotes : [],
    })
  }

  async function loadMoreDiary() {
    if (!supabase || diaryLoadingMore || !diaryHasMore) return
    const nextPage = diaryPage + 1
    setDiaryLoadingMore(true)
    setDiaryError('')
    try {
      const rows = await fetchPublicDiaryPage(nextPage * 10)
      setDiaryNotes((current) => mergeDiaryNotes(current, rows))
      setDiaryPage(nextPage)
      setDiaryHasMore(rows.length === 10)
    } catch (error) {
      console.error('Could not load more diary notes:', error)
      setDiaryError(error.message)
    } finally {
      setDiaryLoadingMore(false)
    }
  }

  async function createPublicDiaryNote({ content, mood }) {
    if (!user || !token || !supabase) throw new Error('Sign in before posting a diary note.')

    const temporaryId = `pending-${Date.now()}`
    const optimisticNote = {
      id: temporaryId,
      content,
      mood,
      created_at: new Date().toISOString(),
      user_name: user.name,
      user_avatar: null,
      user_id: user.id,
      user_role: role,
    }
    setDiaryNotes((current) => mergeDiaryNotes([optimisticNote], current))

    const { data: result, error } = await supabase.rpc('hub_diary_mutate', {
      p_token: token,
      p_action: 'create',
      p_payload: { content, mood },
    })
    if (error) {
      setDiaryNotes((current) => current.filter((note) => note.id !== temporaryId))
      throw new Error(diarySetupMessage(error, 'hub_diary_mutate'))
    }
    if (result?.ok !== true || !result.note) {
      setDiaryNotes((current) => current.filter((note) => note.id !== temporaryId))
      throw new Error(result?.message || 'The server did not confirm the diary post.')
    }

    setDiaryNotes((current) => mergeDiaryNotes(
      [{ ...result.note, user_role: role }],
      current.filter((note) => note.id !== temporaryId && note.id !== result.note.id),
    ))
    return true
  }

  async function deletePublicDiaryNote(note) {
    if (!supabase || !token || !user) {
      window.alert('Sign in before deleting a diary note.')
      return
    }
    if (!window.confirm('Delete for everyone? This will remove for all users.')) return

    const { data: result, error } = await supabase.rpc('hub_diary_mutate', {
      p_token: token,
      p_action: 'delete',
      p_payload: { id: note.id },
    })
    if (error) {
      window.alert(`Could not delete note: ${diarySetupMessage(error, 'hub_diary_mutate')}`)
      return
    }
    if (result?.ok !== true) {
      window.alert(result?.message || 'Could not delete note.')
      return
    }
    setDiaryNotes((current) => current.filter((entry) => entry.id !== note.id))
  }

  async function uploadStudentNote(values, file) {
    if (!isSupabaseConfigured || !supabase) {
      setNotice('Supabase must be configured to upload shared notes.')
      return false
    }

    const safeFileName = file.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    const storagePath = `${crypto.randomUUID()}-${safeFileName}`
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from('student-notes-pdfs')
      .upload(storagePath, file, { contentType: 'application/pdf', upsert: false })
    if (uploadError) {
      console.error('Student note PDF upload failed:', uploadError)
      setNotice(`Couldn't upload PDF: ${uploadError.message}`)
      return false
    }

    const { data: publicFile } = supabase.storage
      .from('student-notes-pdfs')
      .getPublicUrl(uploaded.path, { download: file.name })
    return perform('student_note_create', {
      ...values,
      file_name: file.name,
      file_url: publicFile.publicUrl,
    })
  }

  async function submitMutation(action, payload, assignmentFile, previousPdfUrl) {
    if (!['assignment_create', 'assignment_update'].includes(action) || !assignmentFile) {
      return perform(action, payload)
    }
    if (!isSupabaseConfigured || !supabase) {
      setNotice('Supabase must be configured to upload an assignment PDF.')
      return false
    }

    const originalName = assignmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').trim()
    const baseName = originalName.replace(/\.pdf$/i, '') || 'assignment'
    const storagePath = `assignments/${payload.id}/${Date.now()}-${baseName}.pdf`
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from('assignment-files')
      .upload(storagePath, assignmentFile, { contentType: 'application/pdf', upsert: false })
    if (uploadError) {
      console.error('Assignment PDF upload failed:', uploadError)
      setNotice(`Couldn't upload assignment PDF: ${uploadError.message}`)
      return false
    }

    const { data: publicFile } = supabase.storage
      .from('assignment-files')
      .getPublicUrl(uploaded.path)
    const ok = await perform(action, {
      ...payload,
      pdf_url: publicFile.publicUrl,
      pdf_name: assignmentFile.name,
    })
    if (!ok) {
      const cleanup = await removeAssignmentPdf(publicFile.publicUrl)
      if (cleanup.error) setNotice(`Couldn't save the assignment, and its uploaded PDF couldn't be removed: ${cleanup.error}`)
      return false
    }

    if (previousPdfUrl && previousPdfUrl !== publicFile.publicUrl) {
      const cleanup = await removeAssignmentPdf(previousPdfUrl)
      if (cleanup.error) setNotice(`Assignment saved, but the previous PDF couldn't be removed: ${cleanup.error}`)
    }
    return true
  }

  async function deleteAssignment(item) {
    const ok = await perform('assignment_delete', { id: item.id, type: item.type })
    if (!ok || !item.pdf_url) return ok

    const cleanup = await removeAssignmentPdf(item.pdf_url)
    if (cleanup.error) {
      setNotice(`Assignment deleted, but its PDF couldn't be removed: ${cleanup.error}`)
    }
    return true
  }

  async function removeAssignmentPdf(publicUrl) {
    const storagePath = assignmentStoragePath(publicUrl)
    if (!storagePath) return { error: 'The saved PDF URL is not a valid assignment-files URL.' }
    const { error } = await supabase.storage.from('assignment-files').remove([storagePath])
    if (error) {
      console.error('Assignment PDF cleanup failed:', error)
      return { error: error.message }
    }
    return { error: '' }
  }

  async function downloadLectureNote(item) {
    let fileData = item.file_data
    if (isSupabaseConfigured && !item.file_url) {
      const { data: result, error } = await supabase.rpc('hub_download_note', {
        p_token: token,
        p_note_id: item.id,
      })
      if (error) {
        setNotice(`Couldn't download lecture note: ${error.message}`)
        return
      }
      fileData = result
    }
    downloadNote({ ...item, file_data: fileData })
  }

  async function downloadAssignmentInformation(item) {
    let fileData = item.file_data
    if (isSupabaseConfigured) {
      const { data: result, error } = await supabase.rpc('hub_download_assignment_info_file', {
        p_token: token,
        p_information_id: item.id,
      })
      if (error) {
        setNotice(`Couldn't download assignment information file: ${error.message}`)
        return
      }
      fileData = result
    }
    if (!fileData) {
      setNotice("Couldn't download assignment information file: no file is attached.")
      return
    }
    downloadDataUrl(fileData, item.file_name || `${item.title || 'assignment-information'}`)
  }

  function downloadStudentNote(item) {
    const url = safeReferenceUrl(item.file_url)
    if (!url) {
      setNotice('This student note does not have a valid download link.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function perform(action, payload = {}) {
    if (!hasPermission(role, action)) {
      setNotice('Your role does not have permission for that action.')
      return false
    }

    if (isSupabaseConfigured) {
      const { data: mutationResult, error } = await supabase.rpc('hub_mutate', {
        p_token: token,
        p_action: action,
        p_payload: payload,
      })
      if (error) {
        console.error('hub_mutate RPC failed:', { action, error })
        setNotice(`Couldn't save changes: ${error.message}`)
        return false
      }
      if (mutationResult?.ok !== true) {
        const message = mutationResult?.message || 'The server did not confirm the save.'
        console.error('hub_mutate RPC returned an unsuccessful result:', { action, result: mutationResult })
        setNotice(`Couldn't save changes: ${message}`)
        return false
      }
      try {
        setData(await loadData())
      } catch (error) {
        console.error('Study hub refresh after save failed:', error)
        setNotice(`Changes were saved, but the list could not refresh: ${error.message}`)
        if (action.endsWith('_create')) setQuery('')
        return true
      }
    } else {
      setData((current) => applyDemoMutation(current, action, payload, user))
    }
    if (action.endsWith('_create')) setQuery('')
    setNotice(isSupabaseConfigured ? 'Changes saved and list refreshed.' : 'Changes saved.')
    return true
  }

  function navigate(label) {
    if (!navigation.includes(label)) return
    setActive(label)
    setSidebarOpen(false)
    setQuery('')
  }

  if (!user) return <Login onLogin={login} />

  const content = active === 'Dashboard' || active === 'Admin Dashboard'
    ? <Dashboard role={role} data={data} user={user} navigate={navigate} />
    : <Section
      active={active}
      role={role}
      currentUser={user}
      data={data}
      query={query}
      onDownload={downloadLectureNote}
      onDownloadStudentNote={downloadStudentNote}
      onUploadStudentNote={uploadStudentNote}
      onAdd={(kind, assignment) => setModal({ kind, assignment })}
      onEdit={(kind, item, assignment) => setModal({ kind, item, assignment })}
      onDelete={(action, value) => action === 'assignment_delete'
        ? deleteAssignment(value)
        : perform(action, action === 'user_delete'
          ? { id: typeof value === 'string' ? value : value.id }
          : { id: typeof value === 'string' ? value : value.id })}
      onDownloadInformation={downloadAssignmentInformation}
      onLogout={logout}
      onStartQuiz={(item) => setModal({ kind: 'quiz', item })}
      publicDiary={{
        notes: diaryNotes,
        loading: diaryLoading,
        loadingMore: diaryLoadingMore,
        hasMore: diaryHasMore,
        error: diaryError,
        onPost: createPublicDiaryNote,
        onDelete: deletePublicDiaryNote,
        onLoadMore: loadMoreDiary,
      }}
    />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="UCB construction logo" />
          <div className="brand-copy"><strong>University College of Batangala</strong><span>Department of Construction Technology</span><small>CONSTRUCTION STUDY HUB</small></div>
          <button className="icon-btn sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={19} /></button>
        </div>
        <div className="workspace-label">{isAdmin ? 'ADMINISTRATION' : 'LEARNING SPACE'}</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map((label) => {
            const Icon = iconFor(label)
            return <button key={label} className={`nav-link ${active === label ? 'active' : ''}`} onClick={() => navigate(label)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><ShieldCheck size={18} /></div><strong>{roleLabel(role)} access</strong><p>{isAdmin ? 'Manage users and shared learning content.' : isLecturer ? 'Manage course content and support your students.' : 'Your notes and personal diary stay private; Public Diary is shared.'}</p></div>
          <button className="user-mini" onClick={logout}>
            <Avatar name={user.name} /><span><b>{user.name}</b><small className={`role-badge role-${role}`}>{roleLabel(role)}</small></span><LogOut size={15} />
          </button>
        </div>
      </aside>
      {sidebarOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <div className="topbar-institution">
            <img src="/logo.png" alt="" />
            <span><strong>University College of Batangala</strong><small>Department of Construction Technology</small></span>
          </div>
          <div className="topbar-actions">
            <div className="search-wrap"><Search size={16} /><input aria-label="Search current section" placeholder="Search..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <span className={`role-badge top-role role-${role}`}>{roleLabel(role)}</span>
            <button className="top-avatar" aria-label="Sign out" onClick={logout}><Avatar name={user.name} /></button>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow">{isAdmin ? 'ROLE-BASED CONTROL CENTER' : 'YOUR WORKSPACE'}</div><h1>{pageTitle}</h1><p>{isAdmin ? 'Manage accounts, course content, deadlines, and announcements.' : 'Your construction learning space, organised around your role.'}</p></div>
            {active === 'Announcements' && isAdmin && <button className="primary-btn" onClick={() => setModal({ kind: 'Announcement' })}><Plus size={17} /> New announcement</button>}
          </div>
          {loading && <div className="loading-banner"><span className="spinner" /> Syncing your study hub…</div>}
          {content}
        </div>
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 5).map((label) => {
          const Icon = iconFor(label)
          return <button key={label} className={active === label ? 'selected' : ''} onClick={() => navigate(label)}><Icon size={19} /><span>{mobileLabel(label)}</span></button>
        })}
        {navigation.length > 5 && <button onClick={() => setSidebarOpen(true)}><Menu size={19} /><span>More</span></button>}
      </nav>
      {modal && <RecordModal
        key={`${modal.kind}-${modal.item?.id || 'new'}`}
        modal={modal}
        role={role}
        user={user}
        onClose={() => setModal(null)}
        onSubmit={async (action, payload, assignmentFile, previousPdfUrl) => {
          const ok = await submitMutation(action, payload, assignmentFile, previousPdfUrl)
          if (ok) setModal(null)
          return ok
        }}
        onNotice={setNotice}
      />}
      {notice && <div className={`toast ${notice.startsWith("Couldn't") ? 'toast-error' : ''}`}><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  )
}

function normalizeRemoteData(value = {}) {
  const publicUsers = (value.users || initialData.users || []).map(({ id, role, name }) => ({ id, role, name }))
  const publicStudents = (value.students || []).map(({ id, role, name }) => ({ id, role, name }))
  return {
    ...initialData,
    ...value,
    users: publicUsers,
    students: publicStudents,
    lecture_notes: (value.lecture_notes || []).map(normalizeListItem),
    assignments: (value.assignments || []).map(normalizeAssignment),
    assignment_information: value.assignment_information || [],
    quizzes: (value.quizzes || []).map(normalizeAssignment),
    zoom_meetings: (value.zoom_meetings || []).map(normalizeListItem),
    deadlines: (value.deadlines || []).map(normalizeListItem),
    student_notes: value.student_notes || [],
    shared_student_notes: value.shared_student_notes || [],
    diary: value.diary || [],
    announcements: value.announcements || [],
  }
}

async function fetchPublicDiaryPage(offset) {
  const { data: rows, error } = await supabase
    .from('diary_notes')
    .select('id, content, mood, created_at, user_name, user_avatar, user_id')
    .order('created_at', { ascending: false })
    .range(offset, offset + 9)
  if (error) throw new Error(error.message)
  return enrichPublicDiaryNotes(rows || [])
}

async function enrichPublicDiaryNotes(notes) {
  const userIds = [...new Set(notes.map((note) => note.user_id).filter(Boolean))]
  const { data, error } = await supabase.rpc('hub_diary_author_roles', { p_user_ids: userIds })
  if (error) throw new Error(diarySetupMessage(error, 'hub_diary_author_roles'))
  const roles = data || {}
  return notes.map((note) => ({
    ...note,
    user_name: note.user_name || 'Study Hub member',
    user_role: String(roles[note.user_id] || 'student').trim().toLowerCase(),
  }))
}

function diarySetupMessage(error, functionName) {
  const message = error?.message || 'Unknown Supabase error.'
  if (message.includes(`public.${functionName}`) && message.toLowerCase().includes('schema cache')) {
    return `Public diary setup is missing in Supabase. Run supabase/schema.sql in the Supabase SQL Editor, then refresh the app. (${message})`
  }
  return message
}

function mergeDiaryNotes(first = [], second = []) {
  const byId = new Map()
  ;[...first, ...second].forEach((note) => byId.set(note.id, note))
  return [...byId.values()].sort((left, right) => (
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  ))
}

function normalizeListItem(item) {
  return {
    ...item,
    title: item.title || item.name || 'Untitled',
    description: item.description || item.info_text || item.content || '',
    due_date: item.due_date || item.deadline || item.date || '',
  }
}

function normalizeAssignment(item) {
  return {
    ...normalizeListItem(item),
    subject: item.subject || item.course || '',
  }
}

function hasPermission(role, action) {
  if (role === 'admin') return true
  if (role === 'lecturer') return [
    'note_create', 'note_delete', 'student_note_create', 'assignment_create', 'assignment_update',
    'assignment_delete', 'assignment_info_create', 'assignment_info_update',
    'assignment_info_delete', 'zoom_create', 'zoom_delete', 'deadline_create',
    'deadline_update', 'deadline_delete',
  ].includes(action)
  return ['student_note_create', 'diary_create', 'diary_delete'].includes(action)
}

function applyDemoMutation(current, action, payload, user) {
  const table = action === 'assignment_create' && payload.type === 'quiz'
    ? 'quizzes'
    : action === 'assignment_update' && payload.type === 'quiz'
      ? 'quizzes'
      : actionToTable[action]
  if (!table) return current

  if (action === 'user_delete') {
    return { ...current, users: (current.users || []).filter((row) => row.id !== payload.id) }
  }
  if (action === 'user_update') {
    return { ...current, users: (current.users || []).map((row) => row.id === payload.old_id ? { ...row, ...payload, name: payload.name || row.name } : row) }
  }
  if (action === 'assignment_delete') {
    const key = payload.type === 'quiz' ? 'quizzes' : 'assignments'
    return {
      ...current,
      [key]: (current[key] || []).filter((row) => row.id !== payload.id),
      assignment_information: payload.type === 'quiz' ? current.assignment_information : (current.assignment_information || []).filter((row) => row.assignment_id !== payload.id),
      deadlines: (current.deadlines || []).filter((row) => row.assignment_id !== payload.id && row.quiz_id !== payload.id),
    }
  }
  if (action === 'deadline_delete') {
    const deadline = (current.deadlines || []).find((row) => row.id === payload.id)
    return {
      ...current,
      deadlines: (current.deadlines || []).filter((row) => row.id !== payload.id),
      assignments: (current.assignments || []).filter((row) => row.id !== deadline?.assignment_id),
      assignment_information: (current.assignment_information || []).filter((row) => row.assignment_id !== deadline?.assignment_id),
      quizzes: (current.quizzes || []).filter((row) => row.id !== (deadline?.quiz_id || deadline?.assignment_id)),
    }
  }
  if (action.endsWith('_delete')) {
    return { ...current, [table]: (current[table] || []).filter((row) => row.id !== payload.id) }
  }
  if (action.endsWith('_update')) {
    const next = {
      ...current,
      [table]: (current[table] || []).map((row) => {
        if (row.id !== payload.id) return row
        const updated = { ...row, ...payload }
        if (action === 'assignment_info_update') {
          if (payload.file_data) {
            updated.file_data = payload.file_data
            updated.file_name = payload.file_name
            updated.file_type = payload.file_type
          } else if (payload.remove_file) {
            updated.file_data = ''
            updated.file_name = ''
            updated.file_type = ''
          }
          delete updated.remove_file
        }
        return updated
      }),
    }
    if (action === 'assignment_update') {
      next.deadlines = (current.deadlines || []).map((deadline) => (deadline.assignment_id === payload.id || deadline.quiz_id === payload.id)
        ? { ...deadline, title: payload.title, course: payload.subject, due_date: payload.due_date }
        : deadline)
    }
    if (action === 'deadline_update') {
      const deadline = (current.deadlines || []).find((row) => row.id === payload.id)
      next.assignments = (current.assignments || []).map((row) => row.id === deadline?.assignment_id
        ? { ...row, title: payload.title, subject: payload.course, due_date: payload.due_date }
        : row)
      next.quizzes = (current.quizzes || []).map((row) => row.id === deadline?.quiz_id
        ? { ...row, title: payload.title, subject: payload.course, due_date: payload.due_date }
        : row)
    }
    return next
  }
  const row = {
    ...payload,
    subject: payload.subject || payload.course || '',
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    uploaded_by: user?.name || user?.id,
    owner_id: ['diary', 'student_notes'].includes(table) ? user?.id : undefined,
    created_at: new Date().toISOString(),
    uploaded_at: new Date().toISOString(),
  }
  const next = { ...current, [table]: [row, ...(current[table] || [])] }
  if (action === 'deadline_create') {
    const assignment = { ...row, id: `demo-assignment-${Date.now()}`, type: 'assignment' }
    next.assignments = [assignment, ...(current.assignments || [])]
    next.deadlines = [{ ...row, assignment_id: assignment.id, course: payload.course }, ...(current.deadlines || [])]
  }
  if (action === 'assignment_create') {
    const assignment = { ...row, type: payload.type || 'assignment' }
    const tableName = payload.type === 'quiz' ? 'quizzes' : 'assignments'
    next[tableName] = [assignment, ...(current[tableName] || [])]
    if (payload.due_date) next.deadlines = [{ ...row, id: `demo-deadline-${Date.now()}`, assignment_id: payload.type === 'quiz' ? null : assignment.id, quiz_id: payload.type === 'quiz' ? assignment.id : null, course: payload.subject || '' }, ...(current.deadlines || [])]
  }
  if (action === 'user_create') next.users = [row, ...(current.users || [])]
  return next
}

function roleLabel(role) {
  return role === 'admin' ? 'ADMIN' : role === 'lecturer' ? 'LECTURER' : 'STUDENT'
}

function iconFor(label) {
  if (label.includes('Dashboard')) return LayoutDashboard
  if (label === 'Upload Your Notes') return Upload
  if (label.includes('Notes') || label.includes('Diary')) return NotebookPen
  if (label.includes('Zoom')) return Video
  if (label.includes('Deadline')) return CalendarDays
  if (label.includes('Assignment')) return FileText
  if (label.includes('User') || label.includes('Student') || label.includes('Lecturer')) return Users
  if (label.includes('Announcement')) return Megaphone
  return BookOpen
}

function mobileLabel(label) {
  return label === 'Admin Dashboard' ? 'Admin' : label === 'Assignments' ? 'Tasks' : label.split(' ')[0]
}

function Avatar({ name = 'Student', size = '' }) {
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return <span className={`avatar ${size}`}>{initials}</span>
}

function Login({ onLogin }) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState('student')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try { await onLogin(userId, password, selectedRole) } catch (reason) { setError(reason.message || 'Unable to sign in.') }
    finally { setBusy(false) }
  }
  return <div className="login-page">
    <div className="login-overlay" aria-hidden="true" />
    <section className="login-card">
      <img className="login-logo" src="/logo.png" alt="University College of Batangala construction logo" />
      <div className="login-branding">
        <h1>University College of Batangala</h1>
        <p className="login-department">Department of Construction Technology</p>
        <p className="login-portal">Construction Study Hub <span>·</span> Student Portal</p>
      </div>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="user-id">User ID</label>
        <input id="user-id" className="field" placeholder="Enter your user ID" autoComplete="username" value={userId} onChange={(event) => setUserId(event.target.value)} required />
        <label htmlFor="password">Password</label>
        <input id="password" className="field" type="password" placeholder="Enter your password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <label htmlFor="role">Role</label>
        <select id="role" className="field" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} required>
          <option value="student">Student</option>
          <option value="lecturer">Lecturer</option>
          <option value="admin">Admin</option>
        </select>
        {error && <div className="form-error">{error}</div>}
        <button className="submit-btn login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></button>
      </form>
      {isSupabaseConfigured
        ? <div className="demo-hint"><b>Supabase mode</b><span> · Use an account in the configured database. New setup? Run supabase/schema.sql.</span></div>
        : <div className="demo-hint"><b>Demo mode</b><span> · STU001 / student123 · LEC001 / lecturer123 · ADMIN001 / admin123</span></div>}
      <footer className="login-copyright">© 2026 University College of Batangala</footer>
    </section>
  </div>
}

function Dashboard({ role, data, user, navigate }) {
  const admin = role === 'admin'
  const student = role === 'student'
  const deadlines = upcomingDeadlines(data.deadlines).slice(0, 4)
  if (admin) return <div className="admin-dashboard">
    <section className="welcome-banner"><div className="welcome-text"><span className="pill-dark">{roleLabel(role)} · UCB CONSTRUCTION STUDY HUB</span><h2>Welcome, {user.name} - {roleLabel(role)}</h2><p>Manage your learning community and shared course materials from one place.</p><button className="banner-btn" onClick={() => navigate('Users')}>Manage users <ArrowRight size={15} /></button></div><div className="banner-illustration"><div className="sun-shape" /><div className="building"><div className="building-floor f1" /><div className="building-floor f2" /><div className="building-floor f3" /></div></div></section>
    <div className="admin-stat-grid">{[['Users', data.users?.length || 0, Users], ['Lecture Notes', data.lecture_notes.length, BookOpen], ['Assignments', data.assignments.length + data.quizzes.length, FileText], ['Announcements', data.announcements.length, Megaphone]].map(([label, count, Icon]) => <button key={label} className="stat-card" onClick={() => navigate(label)}><span className="stat-icon orange"><Icon size={18} /></span><span className="stat-label">{label}</span><b>{count}</b><ArrowRight size={15} className="stat-arrow" /></button>)}</div>
    <div className="admin-actions-grid">{navigationLinks(navigate)}</div>
    <section className="panel"><PanelHeading title="Recent announcements" subtitle="Visible to the learning community" action="Manage" onAction={() => navigate('Announcements')} /><AnnouncementList items={data.announcements.slice(0, 3)} /></section>
  </div>
  return <div className="dashboard-grid">
    <section className="welcome-banner"><div className="welcome-text"><span className="pill-dark">{roleLabel(role)} · UCB CONSTRUCTION STUDY HUB</span><h2>Welcome, {user.name} - {roleLabel(role)}</h2><p>{student ? 'Your lessons, assignments, Zoom classes, and personal learning space.' : 'Keep course materials and upcoming due dates clear for your students.'}</p>{student ? <button className="banner-btn" onClick={() => navigate('Lecture Notes')}>Explore lecture notes <ArrowRight size={15} /></button> : <button className="banner-btn" onClick={() => navigate('Assignments')}>Manage assignments <ArrowRight size={15} /></button>}</div><div className="banner-illustration"><div className="sun-shape" /><div className="building"><div className="building-floor f1" /><div className="building-floor f2" /><div className="building-floor f3" /></div></div><div className="banner-grid" /></section>
    <div className="stats-row"><StatCard icon={BookOpen} label="Lecture notes" value={String(data.lecture_notes.length).padStart(2, '0')} onClick={() => navigate('Lecture Notes')} /><StatCard icon={FileText} label="Assignments" value={data.assignments.length + data.quizzes.length} onClick={() => navigate('Assignments')} /><StatCard icon={Video} label="Zoom classes" value={String(data.zoom_meetings.length).padStart(2, '0')} onClick={() => navigate('Zoom Links')} /></div>
    {student
      ? <StudentAssignments items={[...data.assignments, ...data.quizzes.map((item) => ({ ...item, type: 'quiz' }))].slice(0, 4)} navigate={navigate} />
      : <section className="panel deadlines-panel"><PanelHeading title="Upcoming deadlines" subtitle="Due dates approaching" action="Manage deadlines" onAction={() => navigate('Deadlines')} /><DeadlineList items={deadlines} /></section>}
    {student
      ? <section className="panel"><PanelHeading title="My private space" subtitle="Only you can see your notes and personal diary" /><div className="private-actions"><button className="secondary-btn" onClick={() => navigate('My Notes')}><NotebookPen size={17} /> Open my notes</button><button className="secondary-btn" onClick={() => navigate('My Diary')}><CalendarDays size={17} /> Open my diary</button></div></section>
      : <section className="panel"><PanelHeading title="Teaching tools" subtitle="Quick access" /><div className="private-actions"><button className="secondary-btn" onClick={() => navigate('Lecture Notes')}><BookOpen size={17} /> Lecture notes</button><button className="secondary-btn" onClick={() => navigate('Students')}><Users size={17} /> View students</button><button className="secondary-btn" onClick={() => navigate('Deadlines')}><CalendarDays size={17} /> Manage deadlines</button></div></section>}
  </div>
}

function navigationLinks(navigate) {
  return ['Users', 'Lecture Notes', 'Assignments', 'Zoom Links', 'Deadlines', 'Announcements'].map((label) => {
    const Icon = iconFor(label)
    return <button key={label} className="admin-action-card" onClick={() => navigate(label)}><span className="stat-icon orange"><Icon size={18} /></span><b>{label}</b><ArrowRight size={15} /></button>
  })
}

function StatCard({ icon: Icon, label, value, onClick }) {
  return <button className="stat-card" onClick={onClick}><span className="stat-icon orange"><Icon size={18} /></span><span><span className="stat-label">{label}</span><b>{value}</b></span><ArrowRight size={15} className="stat-arrow" /></button>
}

function PanelHeading({ title, subtitle, action, onAction }) {
  return <div className="panel-heading"><div><h3>{title}</h3><p>{subtitle}</p></div>{action && <button className="plain-link" onClick={onAction}>{action}<ArrowRight size={14} /></button>}</div>
}

function Section({ active, role, currentUser, data, query, onDownload, onDownloadStudentNote, onUploadStudentNote, onDownloadInformation, onAdd, onEdit, onDelete, onStartQuiz, publicDiary }) {
  const canManage = role === 'admin' || role === 'lecturer'
  const admin = role === 'admin'
  const listFor = (key) => filterRows(data[key] || [], query)
  if (active === 'Lecture Notes') return <NotesSection items={listFor('lecture_notes')} studentNotes={listFor('shared_student_notes')} role={role} onDownload={onDownload} onDownloadStudentNote={onDownloadStudentNote} onAdd={() => onAdd('Lecture Note')} onEdit={(item) => onEdit('Lecture Note', item)} onDelete={(id) => onDelete('note_delete', id)} />
  if (active === 'Upload Your Notes') return <UploadYourNotesSection onSubmit={onUploadStudentNote} />
  if (active === 'Assignments') return <AssignmentsSection items={filterRows([...data.assignments, ...data.quizzes.map((item) => ({ ...item, type: 'quiz' }))], query)} information={data.assignment_information || []} role={role} onAdd={() => onAdd('Assignment')} onEdit={(item) => onEdit('Assignment', item)} onDelete={(item) => onDelete('assignment_delete', item)} onStartQuiz={onStartQuiz} onAddInformation={(assignment) => onAdd('Assignment Information', assignment)} onEditInformation={(item, assignment) => onEdit('Assignment Information', item, assignment)} onDeleteInformation={(id) => onDelete('assignment_info_delete', id)} onDownloadInformation={onDownloadInformation} />
  if (active === 'Zoom Links') return <ZoomSection items={listFor('zoom_meetings')} role={role} onAdd={() => onAdd('Zoom Link')} onEdit={(item) => onEdit('Zoom Link', item)} onDelete={(id) => onDelete('zoom_delete', id)} />
  if (active === 'Deadlines') return <DeadlinesSection items={listFor('deadlines')} role={role} onAdd={() => onAdd('Deadline')} onEdit={(item) => onEdit('Deadline', item)} onDelete={(id) => onDelete('deadline_delete', id)} />
  if (active === 'Users') return <UsersSection items={listFor('users')} currentId={currentUser.id} onAdd={() => onAdd('User')} onEdit={(item) => onEdit('User', item)} onDelete={(item) => onDelete('user_delete', item.id)} />
  if (active === 'Lecturers' && admin) return <LecturersSection items={listFor('users').filter((item) => item.role === 'lecturer')} onAdd={() => onAdd('Lecturer')} onDelete={(item) => onDelete('user_delete', item.id)} />
  if (active === 'Students') return <StudentsSection items={listFor('students')} />
  if (active === 'Announcements') return <AnnouncementsSection items={listFor('announcements')} role={role} onAdd={() => onAdd('Announcement')} onEdit={(item) => onEdit('Announcement', item)} onDelete={(id) => onDelete('announcement_delete', id)} />
  if (active === 'My Notes') return <StudentNotesSection items={listFor('student_notes')} onAdd={() => onAdd('Student Note')} />
  if (active === 'My Diary') return <StudentDiarySection
    items={listFor('diary')}
    currentUser={currentUser}
    userRole={role}
    publicDiary={publicDiary}
    onAdd={() => onAdd('Diary Entry')}
    onDelete={(id) => onDelete('diary_delete', id)}
  />
  if (active === 'Diary') return <DiaryFeed {...publicDiary} currentUser={currentUser} userRole={role} />
  if (canManage) return null
  return null
}

function filterRows(items, query) {
  if (!query.trim()) return items
  const term = query.toLowerCase()
  return items.filter((item) => Object.entries(item).some(([key, value]) =>
    !['file_data', 'photo_data', 'options'].includes(key)
      && typeof value !== 'object'
      && String(value ?? '').toLowerCase().includes(term),
  ))
}

function NotesSection({ items, studentNotes, role, onDownload, onDownloadStudentNote, onAdd, onEdit, onDelete }) {
  const [subject, setSubject] = useState('Foundation Period')
  const [semester, setSemester] = useState('Semester 1')
  const [activeTab, setActiveTab] = useState('Lecture Notes')
  const filtered = items.filter((item) => item.subject === subject && item.semester === semester)
  const canAdd = role === 'admin' || role === 'lecturer'
  const canEdit = role === 'admin'
  const canDelete = canAdd
  return <div className="notes-workspace">
    <div className="notes-page-tabs" role="tablist" aria-label="Notes categories">
      {['Lecture Notes', 'Student Notes'].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'chosen' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
    </div>
    {activeTab === 'Student Notes'
      ? <SharedStudentNotesSection items={studentNotes} onDownload={onDownloadStudentNote} />
      : <>
    <div className="subject-tabs">{subjects.map((name) => <button key={name} className={subject === name ? 'chosen' : ''} onClick={() => setSubject(name)}>{name}</button>)}</div>
    <div className="semester-switch">{semesters.map((name) => <button key={name} className={semester === name ? 'chosen' : ''} onClick={() => setSemester(name)}>{name}</button>)}{canAdd && <button className="primary-btn semester-add" onClick={onAdd}><Plus size={15} /> Upload note</button>}</div>
    <div className="section-caption"><div><span className="eyebrow">{subject.toUpperCase()}</span><h2>{semester} notes</h2><p>{filtered.length} lecture notes</p></div>{canAdd && <span className="role-hint">Only lecturers and admins can upload</span>}</div>
    <div className="notes-grid">{filtered.map((item, index) => <article className="note-card" key={item.id}>
      <div className={`note-art art-${index % 3}`}><div className="paper-illustration"><span /><span /><span /><span /></div><span className="note-art-stamp"><FileText size={22} /></span></div>
      <div className="note-info"><span className="eyebrow">{item.subject} · {item.semester}</span><h3>{item.title}</h3><p>{item.description || 'Lecture note PDF'}</p><div className="note-meta"><span>Uploaded {dateLabel(item.uploaded_at || item.created_at)}</span><span>By {item.uploaded_by || 'Lecturer'}</span></div>
        <div className="note-card-foot"><button className="download-btn" onClick={() => onDownload(item)}><ArrowDownToLine size={15} /> Download PDF</button><div className="row-actions">{canEdit && <button className="icon-btn" aria-label={`Edit ${item.title}`} onClick={() => onEdit(item)}><Pencil size={15} /></button>}{canDelete && <button className="icon-btn danger-icon" aria-label={`Delete ${item.title}`} onClick={() => onDelete(item.id)}><Trash2 size={15} /></button>}</div></div>
      </div>
    </article>)}</div>{!filtered.length && <EmptyState text={`No notes in ${subject}, ${semester} yet.`} />}
    </>
    }
  </div>
}

function SharedStudentNotesSection({ items, onDownload }) {
  const newestFirst = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return <>
    <div className="section-caption"><div><span className="eyebrow">SHARED STUDY MATERIAL</span><h2>Student Notes</h2><p>{items.length} uploaded notes, newest first</p></div></div>
    <div className="notes-grid">{newestFirst.map((item, index) => <article className="note-card" key={item.id}>
      <div className={`note-art art-${index % 3}`}><div className="paper-illustration"><span /><span /><span /><span /></div><span className="note-art-stamp"><FileText size={22} /></span></div>
      <div className="note-info"><span className="eyebrow">{item.subject || 'Student notes'}</span><h3>{item.title}</h3><p>{item.description || 'Student-uploaded study notes.'}</p><div className="note-meta"><span>Uploaded {dateLabel(item.created_at)}</span><span>By {item.uploaded_by_name || 'Student'}</span><span>{item.file_name}</span></div>
        <div className="note-card-foot"><button className="download-btn" onClick={() => onDownload(item)}><ArrowDownToLine size={15} /> Download PDF</button></div>
      </div>
    </article>)}</div>
    {!newestFirst.length && <EmptyState text="No student notes have been uploaded yet." />}
  </>
}

function downloadNote(item) {
  if (item.file_data) {
    const link = document.createElement('a')
    link.href = item.file_data
    link.download = `${item.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`
    link.click()
    return
  }
  if (item.file_url) {
    window.open(item.file_url, '_blank', 'noopener,noreferrer')
    return
  }
  const content = [
    item.title,
    `${item.subject} · ${item.semester}`,
    `Uploaded ${dateLabel(item.uploaded_at || item.created_at)} by ${item.uploaded_by || 'UCB Construction Study Hub'}`,
    item.description || 'University College of Batangala Construction Study Hub lecture note.',
  ]
  const url = URL.createObjectURL(new Blob([createPdf(content)], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${item.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
  link.click()
}

function createPdf(lines) {
  const escapePdf = (value) => String(value).normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/([\\()])/g, '\\$1')
  const content = ['BT', '/F1 16 Tf', '54 770 Td', `(${escapePdf(lines[0])}) Tj`, '/F1 10 Tf']
  lines.slice(1).forEach((line) => content.push('0 -24 Td', `(${escapePdf(line)}) Tj`))
  content.push('ET')
  const stream = content.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let documentText = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(documentText.length)
    documentText += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = documentText.length
  documentText += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => {
    documentText += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  documentText += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return documentText
}

function AssignmentsSection({ items, information, role, onAdd, onEdit, onDelete, onStartQuiz, onAddInformation, onEditInformation, onDeleteInformation, onDownloadInformation }) {
  const canManage = role === 'admin' || role === 'lecturer'
  const [selectedId, setSelectedId] = useState('')
  const normalizedItems = items.map(normalizeAssignment)
  const selected = normalizedItems.find((item) => item.id === selectedId && item.type !== 'quiz')
  if (selected) {
    return <AssignmentDetails
      assignment={selected}
      information={information.filter((item) => item.assignment_id === selected.id)}
      role={role}
      onBack={() => setSelectedId('')}
      onAddInformation={() => onAddInformation(selected)}
      onEditInformation={(item) => onEditInformation(item, selected)}
      onDeleteInformation={onDeleteInformation}
      onDownloadInformation={onDownloadInformation}
    />
  }
  return <div className="section-stack">
    {canManage && <div className="action-strip"><div><b>Coursework manager</b><span>Saving an assignment also adds it to the deadline tracker.</span></div><button className="primary-btn" onClick={onAdd}><Plus size={16} /> Add assignment</button></div>}
    <div className="assignment-list">{normalizedItems.map((item) => {
      const due = deadlineState(item.due_date)
      const infoCount = item.type === 'quiz' ? 0 : information.filter((entry) => entry.assignment_id === item.id).length
      return <article className={`assignment-card ${due.urgent ? 'urgent-card' : ''}`} key={`${item.type}-${item.id}`}>
        <div className={`assignment-icon ${item.type === 'quiz' ? 'assignment-quiz' : ''}`}>{item.type === 'quiz' ? <Clock3 size={20} /> : <FileText size={20} />}</div>
        <div className="assignment-info"><span className="eyebrow">{item.subject || item.course || 'Course work'} · {item.type || 'assignment'}</span><h3>{item.title}</h3><p>{item.type === 'quiz' ? `${item.duration_minutes || 15} minute timed quiz` : item.description || 'Course assignment and due date.'}</p><span className="assignment-due"><CalendarDays size={14} /> Due {dateLabel(item.due_date)} · {due.label}</span>
          {item.type !== 'quiz' && <AssignmentPdf item={item} />}
          {item.type !== 'quiz' && <div className="assignment-information-actions">{infoCount > 0 && <span className="info-badge"><Info size={13} /> Info</span>}<button className="small-secondary" onClick={() => setSelectedId(item.id)}>View details</button></div>}
        </div>
        <div className="assignment-actions">{due.urgent && <span className="urgent-badge">URGENT</span>}{canManage && <div className="row-actions"><button className="icon-btn" aria-label={`Edit ${item.title}`} onClick={() => onEdit(item)}><Pencil size={15} /></button><button className="icon-btn danger-icon" aria-label={`Delete ${item.title}`} onClick={() => onDelete(item)}><Trash2 size={15} /></button></div>}{item.type === 'quiz' && role === 'student' && <button className="small-primary" onClick={() => onStartQuiz(item)}>Start quiz <ArrowRight size={14} /></button>}</div>
      </article>
    })}</div>{!items.length && <EmptyState text="No assignments to show." />}
  </div>
}

function AssignmentDetails({ assignment, information, role, onBack, onAddInformation, onEditInformation, onDeleteInformation, onDownloadInformation }) {
  const canManage = role === 'admin' || role === 'lecturer'
  const due = deadlineState(assignment.due_date)
  return <div className="section-stack">
    <button className="small-secondary assignment-back" onClick={onBack}>Back to assignments</button>
    <section className={`assignment-detail-heading ${due.urgent ? 'urgent-card' : ''}`}>
      <div className="assignment-detail-title"><span className="eyebrow">{assignment.subject} · ASSIGNMENT</span><h2>{assignment.title}</h2><span className="assignment-due"><CalendarDays size={14} /> Due {dateLabel(assignment.due_date)} · {due.label}</span></div>
      {due.urgent && <span className="urgent-badge">URGENT</span>}
    </section>
    <AssignmentPdf item={assignment} />
    <section className="assignment-information-section">
      <div className="assignment-information-header"><div><span className="eyebrow">ASSIGNMENT SUPPORT</span><h2>Assignment Information</h2><p>Guidelines, important points, and references for this assignment.</p></div>{canManage && <button className="primary-btn" onClick={onAddInformation}><Plus size={16} /> Add Information</button>}</div>
      <div className="assignment-information-list">{information.map((item) => (
        <article className="assignment-information-card" key={item.id}>
          <div className="assignment-information-card-header"><div><h3>{item.title}</h3><span className="eyebrow">Added {dateLabel(item.created_at)}</span></div>{canManage && <div className="row-actions"><button className="icon-btn" aria-label={`Edit information: ${item.title}`} onClick={() => onEditInformation(item)}><Pencil size={15} /></button><button className="icon-btn danger-icon" aria-label={`Delete information: ${item.title}`} onClick={() => onDeleteInformation(item.id)}><Trash2 size={15} /></button></div>}</div>
          {item.details && <p className="assignment-information-details">{item.details}</p>}
          {Array.isArray(item.important_points) && item.important_points.length > 0 && <div className="assignment-information-block"><b>Important points</b><ul>{item.important_points.map((point, index) => <li key={`${item.id}-point-${index}`}>{point}</li>)}</ul></div>}
          {Array.isArray(item.reference_links) && item.reference_links.length > 0 && <div className="assignment-information-block"><b>Reference links</b><ul className="assignment-reference-list">{item.reference_links.map((reference, index) => {
            const href = safeReferenceUrl(reference)
            return <li key={`${item.id}-reference-${index}`}>{href ? <a href={href} target="_blank" rel="noreferrer">{reference}</a> : reference}</li>
          })}</ul></div>}
          {item.file_name && <button className="download-btn assignment-file-download" onClick={() => onDownloadInformation(item)}><ArrowDownToLine size={15} /> Download {item.file_name}</button>}
        </article>
      ))}</div>
      {!information.length && <EmptyState text={canManage ? 'No information has been added to this assignment yet.' : 'No information has been posted for this assignment yet.'} />}
    </section>
  </div>
}

function AssignmentPdf({ item }) {
  const url = safeReferenceUrl(item.pdf_url)
  return <div className="assignment-pdf">
    {url
      ? <a href={url} target="_blank" rel="noreferrer"><FileText size={17} /><span><b>View Assignment PDF</b><small>{item.pdf_name || 'Assignment PDF'}</small></span><ArrowRight size={15} /></a>
      : <span className="assignment-pdf-empty"><FileText size={16} /> No PDF attached</span>}
  </div>
}

function ZoomSection({ items, role, onAdd, onEdit, onDelete }) {
  const admin = role === 'admin'
  const canManage = admin || role === 'lecturer'
  return <div className="section-stack">
    {canManage && <div className="action-strip"><div><b>Zoom classes</b><span>Add class links, date, and start time for your students.</span></div><button className="primary-btn" onClick={onAdd}><Plus size={16} /> Add Zoom link</button></div>}
    <div className="meeting-list">{items.map((item, index) => <article className="meeting-card" key={item.id}><div className={`meeting-date meeting-date-${index % 2}`}><CalendarDays size={18} /><span>{dateLabel(item.meeting_date)}</span></div><div className="meeting-info">    <span className="eyebrow">{formatSriLankaTime(item.meeting_date)}</span><h3>{item.title}</h3><p>Join your lecturer and classmates in the virtual classroom.</p></div><a className="join-btn" href={safeZoomUrl(item.join_url)} target="_blank" rel="noreferrer"><Video size={16} /> Join class</a>{canManage && <div className="row-actions">{admin && <button className="icon-btn" aria-label="Edit Zoom link" onClick={() => onEdit(item)}><Pencil size={15} /></button>}<button className="icon-btn danger-icon" aria-label="Delete Zoom link" onClick={() => onDelete(item.id)}><Trash2 size={15} /></button></div>}</article>)}</div>{!items.length && <EmptyState text="No Zoom classes scheduled." />}
  </div>
}

function DeadlinesSection({ items, role, onAdd, onEdit, onDelete }) {
  const canManage = role === 'admin' || role === 'lecturer'
  const ordered = upcomingDeadlines(items)
  return <div className="section-stack">
    {canManage && <div className="action-strip"><div><b>Set a deadline</b><span>A matching assignment is generated automatically for students.</span></div><button className="primary-btn" onClick={onAdd}><Plus size={16} /> Create deadline</button></div>}
    <div className="panel table-panel"><div className="table-header"><div><b>Assignment deadlines</b><span>{items.length} scheduled</span></div><div className="table-legend"><i className="urgent-legend" /> Due soon</div></div>
      <div className="deadline-table">{ordered.map((item) => {
        const due = deadlineState(item.due_date)
        return <div className={`deadline-table-row ${due.urgent ? 'deadline-urgent' : ''}`} key={item.id}><span className={`check-circle ${due.urgent ? 'urgent-circle' : ''}`}><CalendarDays size={12} /></span>        <div className="table-deadline-name"><b>{item.title}</b><span>{item.course || 'Course work'}{item.assignment_id || item.quiz_id ? ' · assignment created' : ''}</span></div><span className="table-date">{dateLabel(item.due_date)}</span><span className={`countdown-tag ${due.urgent ? 'urgent-badge' : ''}`}>{due.urgent ? 'URGENT · ' : ''}{due.label}</span>{canManage && <div className="row-actions">{<button className="icon-btn" aria-label={`Edit ${item.title} deadline`} onClick={() => onEdit(item)}><Pencil size={15} /></button>}<button className="icon-btn danger-icon" aria-label={`Delete ${item.title} deadline`} onClick={() => onDelete(item.id)}><Trash2 size={15} /></button></div>}</div>
      })}</div>{!items.length && <EmptyState text="No deadlines scheduled." />}
    </div>
  </div>
}

function deadlineState(value) {
  if (!value) return { days: null, urgent: false, label: 'No due date' }
  const dueDate = String(value).slice(0, 10)
  const todayDate = getSriLankaDateInputValue()
  const dueTime = Date.parse(`${dueDate}T00:00:00Z`)
  const todayTime = Date.parse(`${todayDate}T00:00:00Z`)
  if (Number.isNaN(dueTime) || Number.isNaN(todayTime)) return { days: null, urgent: false, label: 'No due date' }
  const days = Math.round((dueTime - todayTime) / 86400000)
  return {
    days,
    urgent: days >= 0 && days <= 3,
    label: days < 0 ? 'Overdue' : days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} left`,
  }
}

function upcomingDeadlines(items) {
  return [...items].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
}

function DeadlineList({ items }) {
  return <div className="deadline-list">{items.length ? items.map((item) => <div className={`deadline-row ${deadlineState(item.due_date).urgent ? 'deadline-row-urgent' : ''}`} key={item.id}><div className="date-chip"><b>{dateLabel(item.due_date, { day: '2-digit' })}</b><span>{dateLabel(item.due_date, { month: 'short' }).toUpperCase()}</span></div><div className="deadline-copy"><b>{item.title}</b><span>{deadlineState(item.due_date).label}</span></div>{deadlineState(item.due_date).urgent && <span className="urgent-badge">URGENT</span>}</div>) : <EmptyState text="No upcoming deadlines." />}</div>
}

function UsersSection({ items, currentId, onAdd, onEdit, onDelete }) {
  const adminCount = items.filter((item) => item.role === 'admin').length
  return <div className="section-stack"><div className="action-strip"><div><b>Account management</b><span>Admin-only. The active and last admin account cannot be deleted.</span></div><button className="primary-btn" onClick={onAdd}><Plus size={16} /> Add user</button></div><div className="panel table-panel"><div className="table-header"><div><b>Learning community</b><span>{items.length} accounts</span></div></div><div className="deadline-table">{items.map((item) => <div className="deadline-table-row user-table-row" key={item.id}><Avatar name={item.name || item.id} /><div className="table-deadline-name"><b>{item.name || item.id}</b><span>{item.id}</span></div><span className={`role-badge role-${item.role}`}>{roleLabel(item.role)}</span><div className="row-actions"><button className="icon-btn" aria-label={`Edit ${item.id}`} onClick={() => onEdit(item)}><Pencil size={15} /></button><button className="icon-btn danger-icon" aria-label={`Delete ${item.id}`} title={item.id === currentId || (item.role === 'admin' && adminCount === 1) ? 'The active and last admin account cannot be deleted.' : 'Delete user'} disabled={item.id === currentId || (item.role === 'admin' && adminCount === 1)} onClick={() => onDelete(item)}><Trash2 size={15} /></button></div></div>)}</div></div></div>
}

function LecturersSection({ items, onAdd, onDelete }) {
  const newestFirst = [...items].sort((left, right) => (
    new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
  ))
  return <div className="section-stack">
    <div className="action-strip"><div><b>Lecturer accounts</b><span>Create and manage lecturer accounts using the Study Hub user system.</span></div><button className="primary-btn" onClick={onAdd}><Plus size={16} /> Add lecturer</button></div>
    <div className="panel table-panel"><div className="table-header"><div><b>Lecturers</b><span>{items.length} accounts</span></div></div>
      <div className="deadline-table">{newestFirst.map((item) => <div className="deadline-table-row user-table-row" key={item.id}>
        <Avatar name={item.name || item.id} />
        <div className="table-deadline-name"><b>{item.name || item.id}</b><span>{item.id}</span></div>
        <span className="lecturer-status">Registered · LECTURER</span>
        <button className="icon-btn danger-icon lecturer-delete" aria-label={`Delete lecturer ${item.name || item.id}`} onClick={() => {
          if (window.confirm(`Delete lecturer account ${item.name || item.id}?`)) onDelete(item)
        }}><Trash2 size={16} /></button>
      </div>)}</div>
      {!newestFirst.length && <EmptyState text="No lecturer accounts yet." />}
    </div>
  </div>
}

function StudentsSection({ items }) {
  return <div className="panel table-panel"><div className="table-header"><div><b>Students</b><span>Read-only student directory</span></div></div><div className="deadline-table">{items.map((item) => <div className="deadline-table-row user-table-row" key={item.id}><Avatar name={item.name || item.id} /><div className="table-deadline-name"><b>{item.name || item.id}</b><span>{item.id}</span></div><span className="role-badge role-student">STUDENT</span></div>)}</div>{!items.length && <EmptyState text="No student accounts found." />}</div>
}

function AnnouncementsSection({ items, role, onAdd, onEdit, onDelete }) {
  const admin = role === 'admin'
  return <div className="section-stack">{admin && <div className="action-strip"><div><b>Community announcements</b><span>Post updates visible to the learning community.</span></div><button className="primary-btn" onClick={onAdd}><Plus size={16} /> New announcement</button></div>}<AnnouncementList items={items} admin={admin} onEdit={onEdit} onDelete={onDelete} /></div>
}

function AnnouncementList({ items, admin, onEdit, onDelete }) {
  return <div className="announcement-list">{items.map((item) => <article className="announcement-card" key={item.id}><div className="announcement-icon"><Megaphone size={18} /></div><div className="announcement-copy"><span className="eyebrow">{dateLabel(item.created_at)} · {item.created_by || 'UCB Administration'}</span><h3>{item.title}</h3><p>{item.content}</p></div>{admin && <div className="row-actions"><button className="icon-btn" aria-label="Edit announcement" onClick={() => onEdit(item)}><Pencil size={15} /></button><button className="icon-btn danger-icon" aria-label="Delete announcement" onClick={() => onDelete(item.id)}><Trash2 size={15} /></button></div>}</article>)}{!items.length && <EmptyState text="No announcements yet." />}</div>
}

function StudentNotesSection({ items, onAdd }) {
  return <div className="section-stack"><div className="action-strip private-strip"><div><b>Your private study notes</b><span>Only you can see these notes.</span></div><button className="primary-btn" onClick={onAdd}><Plus size={16} /> New note</button></div><div className="personal-notes">{items.map((item) => <article className="personal-note" key={item.id}><span className="eyebrow">{dateLabel(item.created_at)}</span><h3>{item.title}</h3><p>{item.content}</p></article>)}</div>{!items.length && <EmptyState text="Your notebook is ready for its first idea." />}</div>
}

function UploadYourNotesSection({ onSubmit }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!file) {
      setError('Choose a PDF file to upload.')
      return
    }

    setBusy(true)
    setError('')
    const values = Object.fromEntries(new FormData(form).entries())
    delete values.note_file
    try {
      const saved = await onSubmit(values, file)
      if (saved) {
        form.reset()
        setFile(null)
      }
    } catch (submitError) {
      console.error('Student note submission failed:', submitError)
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }

  function selectFile(event) {
    const selected = event.target.files?.[0]
    setError('')
    if (!selected) {
      setFile(null)
      return
    }
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF file.')
      event.target.value = ''
      setFile(null)
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('PDF must be 10 MB or smaller.')
      event.target.value = ''
      setFile(null)
      return
    }
    setFile(selected)
  }

  return <div className="section-stack">
    <div className="action-strip"><div><b>Share study material</b><span>Upload a PDF for everyone in the Study Hub to read.</span></div></div>
    <form className="panel modal-form upload-notes-form" onSubmit={handleSubmit}>
      <Field label="Title" name="title" required placeholder="Give your notes a clear title" />
      <SelectField label="Subject" name="subject" defaultValue={subjects[0]} options={subjects} />
      <Field label="Description" name="description" as="textarea" placeholder="What do these notes cover?" />
      <label className="upload-field"><Upload size={17} /><span>{file?.name || 'Choose a PDF file · Max 10 MB'}</span><input name="note_file" type="file" accept="application/pdf,.pdf" onChange={selectFile} required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="primary-btn" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload notes'}<ArrowRight size={15} /></button></div>
    </form>
  </div>
}

function StudentDiarySection({ items, currentUser, userRole, publicDiary, onAdd, onDelete }) {
  return <div className="student-diary-workspace">
    <DiarySection items={items} onAdd={onAdd} onDelete={onDelete} />
    <DiaryFeed {...publicDiary} currentUser={currentUser} userRole={userRole} />
  </div>
}

function DiarySection({ items, onAdd, onDelete }) {
  const [sortNewest, setSortNewest] = useState(true)
  const ordered = [...items].sort((a, b) => (sortNewest ? b.entry_date : a.entry_date).localeCompare(sortNewest ? a.entry_date : b.entry_date))
  return <div className="section-stack"><div className="diary-intro"><div className="diary-icon"><NotebookPen size={21} /></div><div><span className="eyebrow">YOUR PRIVATE DIARY</span><h3>Memories, moments, and milestones.</h3><p>Only you can see and delete your diary entries.</p></div><button className="primary-btn" onClick={onAdd}><Plus size={16} /> Add entry</button></div><div className="diary-toolbar"><span>{items.length} {items.length === 1 ? 'memory' : 'memories'}</span><button className="small-secondary" onClick={() => setSortNewest((value) => !value)}>View {sortNewest ? 'oldest first' : 'newest first'}</button></div><div className="memory-grid">{ordered.map((item) => <article className="memory-card" key={item.id}>{item.photo_data ? <img className="memory-photo" src={item.photo_data} alt={`Memory: ${item.title}`} /> : <div className="memory-placeholder"><NotebookPen size={22} /></div>}<div className="memory-copy"><span className="eyebrow">{dateLabel(item.entry_date)}</span><h3>{item.title}</h3><p>{item.content}</p>{item.quote && <blockquote><Quote size={14} />{item.quote}</blockquote>}<button className="delete-memory" onClick={() => onDelete(item.id)}><Trash2 size={14} /> Delete my memory</button></div></article>)}</div>{!items.length && <EmptyState text="No memories yet. Save your first moment." />}</div>
}

function StudentAssignments({ items, navigate }) {
  return <section className="panel student-assignment-panel"><PanelHeading title="Assignments & quizzes" subtitle="Read-only course work" action="View all" onAction={() => navigate('Assignments')} /><div className="task-list">{items.map((item) => <div className="task-row" key={`${item.type}-${item.id}`}><span className="task-type"><FileText size={16} /></span><span className="task-copy"><b>{item.title}</b><small>{item.subject} · due {dateLabel(item.due_date)}</small></span>{deadlineState(item.due_date).urgent && <span className="urgent-badge">URGENT</span>}</div>)}</div></section>
}

function RecordModal({ modal, role, user, onClose, onSubmit, onNotice }) {
  const [busy, setBusy] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const item = modal.item || {}
  const isQuiz = modal.kind === 'quiz'
  const isDiary = modal.kind === 'Diary Entry'
  const isAssignmentInformation = modal.kind === 'Assignment Information'
  const [assignmentType, setAssignmentType] = useState(item.type || 'assignment')
  const title = isQuiz ? item.title : item.id ? `Edit ${modal.kind.toLowerCase()}` : modal.kind === 'User' ? 'Add user' : `Add ${modal.kind.toLowerCase()}`

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    setBusy(true)
    try {
      let action
      let payload
      if (modal.kind === 'Lecture Note') {
        action = item.id ? 'note_update' : 'note_create'
        payload = { ...values, id: item.id }
        if (file) payload.file_data = await fileAsDataUrl(file)
      } else if (modal.kind === 'Assignment') {
        action = item.id ? 'assignment_update' : 'assignment_create'
        payload = { ...values, id: item.id || crypto.randomUUID(), type: item.type || values.type, duration_minutes: Number(values.duration_minutes || 15), options: String(values.options || '').split('\n').map((option) => option.trim()).filter(Boolean) }
      } else if (isAssignmentInformation) {
        action = item.id ? 'assignment_info_update' : 'assignment_info_create'
        payload = {
          ...values,
          id: item.id,
          assignment_id: modal.assignment?.id || item.assignment_id,
          important_points: String(values.important_points || '').split('\n').map((point) => point.trim()).filter(Boolean),
          reference_links: String(values.reference_links || '').split('\n').map((reference) => reference.trim()).filter(Boolean),
        }
        if (file) {
          payload.file_data = await fileAsDataUrl(file)
          payload.file_name = file.name
          payload.file_type = file.type
        }
      } else if (modal.kind === 'Zoom Link') {
        action = item.id ? 'zoom_update' : 'zoom_create'
        payload = { ...values, meeting_date: sriLankaDateTimeLocalToISOString(values.meeting_date), id: item.id }
      } else if (modal.kind === 'Deadline') {
        action = item.id ? 'deadline_update' : 'deadline_create'
        payload = { ...values, id: item.id }
      } else if (modal.kind === 'Announcement') {
        action = item.id ? 'announcement_update' : 'announcement_create'
        payload = { ...values, id: item.id }
      } else if (modal.kind === 'User') {
        action = item.id ? 'user_update' : 'user_create'
        payload = { ...values, old_id: item.id, id: (values.id || item.id || '').trim().toUpperCase() }
        if (!values.password) delete payload.password
      } else if (modal.kind === 'Lecturer') {
        action = 'user_create'
        payload = { ...values, id: String(values.id || '').trim().toUpperCase(), role: 'lecturer' }
      } else if (modal.kind === 'Student Note') {
        action = 'student_note_create'
        payload = values
      } else if (isDiary) {
        action = 'diary_create'
        payload = { ...values, photo_data: file ? await fileAsDataUrl(file) : null }
      } else if (isQuiz) {
        onNotice('Quiz timer complete. Ask your lecturer about your submission.')
        onClose()
        return
      }
      const assignmentPdf = modal.kind === 'Assignment' && payload.type !== 'quiz' ? file : null
      setUploadingPdf(Boolean(assignmentPdf))
      await onSubmit(action, payload, assignmentPdf, item.pdf_url)
    } catch (error) {
      setFileError(error.message)
    } finally {
      setUploadingPdf(false)
      setBusy(false)
    }
  }

  function selectFile(event) {
    const selected = event.target.files?.[0]
    setFileError('')
    if (!selected) return
    if (modal.kind === 'Lecture Note' && selected.type !== 'application/pdf') {
      setFileError('Choose a PDF file for lecture notes.')
      event.target.value = ''
      return
    }
    if (modal.kind === 'Assignment'
      && (!selected.name.toLowerCase().endsWith('.pdf')
        || (selected.type && selected.type !== 'application/pdf'))) {
      setFileError('Please upload only PDF file')
      setFile(null)
      event.target.value = ''
      return
    }
    if (isAssignmentInformation && selected.type !== 'application/pdf' && !selected.type.startsWith('image/')) {
      setFileError('Choose a PDF or image file.')
      event.target.value = ''
      return
    }
    const maxSize = modal.kind === 'Assignment'
      ? 10 * 1024 * 1024
      : modal.kind === 'Lecture Note' || isAssignmentInformation
        ? 5 * 1024 * 1024
        : 4 * 1024 * 1024
    if (selected.size > maxSize) {
      setFileError(modal.kind === 'Assignment' ? 'Assignment PDF must be 10 MB or smaller.' : `File must be smaller than ${maxSize / 1024 / 1024} MB.`)
      setFile(null)
      event.target.value = ''
      return
    }
    setFile(selected)
  }

  const initialTime = item.meeting_date ? formatSriLankaDateTimeLocal(item.meeting_date) : ''
  return <div className="modal-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose() }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div className="modal-head"><div><span className="eyebrow">{isQuiz ? 'TIMED ASSESSMENT' : roleLabel(role)}</span><h2 id="modal-title">{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close" disabled={busy}><X size={19} /></button></div>
    {isQuiz ? <QuizContent item={item} onClose={onClose} onNotice={onNotice} /> :
      <form onSubmit={handleSubmit} className="modal-form">
        {modal.kind === 'Lecture Note' && <>
          <Field label="Note title" name="title" defaultValue={item.title} required />
          <SelectField label="Subject" name="subject" defaultValue={item.subject || subjects[0]} options={subjects} />
          <SelectField label="Semester" name="semester" defaultValue={item.semester || semesters[0]} options={semesters} />
          <Field label="Short description" name="description" defaultValue={item.description} />
          <label className="upload-field"><Upload size={17} /><span>{file?.name || (item.file_data ? 'Replace attached PDF (optional)' : 'Choose PDF file')}</span><input type="file" accept="application/pdf,.pdf" onChange={selectFile} required={!item.id} /></label>
        </>}
        {modal.kind === 'Assignment' && <>
          <Field label="Assignment title" name="title" defaultValue={item.title} required />
          <Field label="Subject / course" name="subject" defaultValue={item.subject} required />
          <SelectField label="Type" name="type" defaultValue={item.type || 'assignment'} options={['assignment', 'quiz']} disabled={Boolean(item.id)} onChange={setAssignmentType} />
          <Field label="Due date" name="due_date" type="date" defaultValue={String(item.due_date || '').slice(0, 10)} required />
          {assignmentType !== 'quiz' && <>
            <label className="upload-field assignment-pdf-upload"><Upload size={17} /><span>{file?.name || (item.pdf_name ? `Replace: ${item.pdf_name} · Optional · Max 10 MB` : 'Assignment Details PDF (Optional) · Max 10 MB')}<input type="file" accept=".pdf,application/pdf" onChange={selectFile} /></span></label>
            {uploadingPdf && <div className="assignment-upload-progress" role="status"><span />Uploading PDF and saving assignment…</div>}
          </>}
          {assignmentType === 'quiz' && <><Field label="Duration in minutes" name="duration_minutes" type="number" defaultValue={item.duration_minutes || 15} min="1" required /><Field label="Question" name="question" defaultValue={item.question} required /><Field label="Options (one per line)" name="options" as="textarea" defaultValue={Array.isArray(item.options) ? item.options.join('\n') : ''} required /></>}
          <p className="form-hint">The due date is automatically added to Deadlines.</p>
        </>}
        {isAssignmentInformation && <>
          <div className="assignment-information-form-parent"><span className="eyebrow">FOR ASSIGNMENT</span><b>{modal.assignment?.title || item.assignment_title}</b></div>
          <Field label="Information title" name="title" defaultValue={item.title} placeholder="e.g. Submission Guidelines" required />
          <Field label="Details / description" name="details" as="textarea" defaultValue={item.details} placeholder="Add the full instructions or context for students." required />
          <Field label="Important points (one per line)" name="important_points" as="textarea" defaultValue={Array.isArray(item.important_points) ? item.important_points.join('\n') : ''} placeholder="Each line becomes a bullet point." />
          <Field label="Reference links (one URL per line)" name="reference_links" as="textarea" defaultValue={Array.isArray(item.reference_links) ? item.reference_links.join('\n') : ''} placeholder="https://example.com/reference" />
          <label className="upload-field"><Upload size={17} /><span>{file?.name || (item.file_name ? `Current file: ${item.file_name}` : 'Attach PDF or image (optional)')} · Max 5 MB<input type="file" accept="application/pdf,image/*,.pdf" onChange={selectFile} /></span></label>
          {item.file_name && <label className="remove-attachment-field"><input type="checkbox" name="remove_file" /> Remove current attachment</label>}
          <p className="form-hint">Date Added is recorded automatically when you save.</p>
        </>}
        {modal.kind === 'Zoom Link' && <>
          <Field label="Class title" name="title" defaultValue={item.title} required />
          <Field label="Zoom URL" name="join_url" type="url" defaultValue={item.join_url} required />
          <Field label="Date and time" name="meeting_date" type="datetime-local" defaultValue={initialTime} required />
        </>}
        {modal.kind === 'Deadline' && <>
          <Field label="Assignment title" name="title" defaultValue={item.title} required />
          <Field label="Subject / course" name="course" defaultValue={item.course} required />
          <Field label="Due date" name="due_date" type="date" defaultValue={String(item.due_date || '').slice(0, 10)} required />
          <p className="form-hint">Creating this deadline also generates an assignment for students.</p>
        </>}
        {modal.kind === 'Announcement' && <>
          <Field label="Announcement title" name="title" defaultValue={item.title} required />
          <Field label="Message" name="content" as="textarea" defaultValue={item.content} required />
        </>}
        {modal.kind === 'User' && <>
          <Field label="User ID" name="id" defaultValue={item.id} required disabled={Boolean(item.id)} />
          <Field label="Name" name="name" defaultValue={item.name} required />
          <SelectField label="Role" name="role" defaultValue={item.role || 'student'} options={['student', 'lecturer', 'admin']} />
          <Field label={item.id ? 'New password (leave blank to keep current)' : 'Password'} name="password" type="password" required={!item.id} autoComplete="new-password" />
        </>}
        {modal.kind === 'Lecturer' && <>
          <Field label="Lecturer ID" name="id" required placeholder="e.g. LEC002" />
          <Field label="Full name" name="name" required />
          <Field label="Temporary password" name="password" type="password" required autoComplete="new-password" />
          <p className="form-hint">This creates a lecturer account in the existing Study Hub users table.</p>
        </>}
        {modal.kind === 'Student Note' && <>
          <Field label="Title" name="title" required />
          <Field label="Your private note" name="content" as="textarea" required />
        </>}
        {isDiary && <>
          <Field label="Memory title" name="title" required />
          <Field label="Date" name="entry_date" type="date" defaultValue={getSriLankaDateInputValue()} required />
          <Field label="Diary entry" name="content" as="textarea" placeholder="What would you like to remember?" />
          <Field label="Quote or memory (optional)" name="quote" placeholder="A quote, thought, or special memory" />
          <label className="upload-field photo-upload"><Camera size={17} /><span>{file?.name || 'Add photo from gallery or camera'}</span><input type="file" accept="image/*" capture="environment" onChange={selectFile} /></label>
        </>}
        {fileError && <p className="form-error">{fileError}</p>}
        <div className="modal-actions"><button type="button" className="small-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-btn" disabled={busy}>{uploadingPdf ? 'Uploading PDF…' : busy ? 'Saving…' : 'Save'}<ArrowRight size={15} /></button></div>
      </form>}
  </section></div>
}

function Field({ label, name, defaultValue, type = 'text', required = false, min, placeholder, as = 'input', disabled = false, autoComplete }) {
  const Component = as
  return <label className="form-field"><span>{label}</span><Component className={`field ${as === 'textarea' ? 'textarea' : ''}`} name={name} type={as === 'input' ? type : undefined} defaultValue={defaultValue} required={required} min={min} placeholder={placeholder} disabled={disabled} autoComplete={autoComplete} rows={as === 'textarea' ? 4 : undefined} /></label>
}

function SelectField({ label, name, defaultValue, options, disabled = false, onChange }) {
  return <label className="form-field"><span>{label}</span><select className="field" name={name} defaultValue={defaultValue} disabled={disabled} onChange={(event) => onChange?.(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function QuizContent({ item, onClose, onNotice }) {
  const [seconds, setSeconds] = useState((item.duration_minutes || 15) * 60)
  const [answer, setAnswer] = useState('')
  useEffect(() => {
    if (seconds <= 0) {
      onNotice('Time is up. Contact your lecturer about quiz submission.')
      onClose()
      return
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds, onClose, onNotice])
  const submit = () => {
    onNotice(answer ? 'Quiz submitted. Great work!' : 'Quiz closed without an answer.')
    onClose()
  }
  const options = item.options || []
  return <div className="quiz-content"><div className={`quiz-timer ${seconds < 60 ? 'timer-low' : ''}`}><Clock3 size={16} />{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</div><span className="eyebrow">QUESTION</span><h3>{item.question || 'Review your course materials and answer the question.'}</h3><div className="quiz-options">{options.map((option) => <button type="button" key={option} className={answer === option ? 'answer-selected' : ''} onClick={() => setAnswer(option)}><span className="option-radio">{answer === option && <i />}</span>{option}</button>)}</div><button className="submit-btn" onClick={submit}>Submit quiz <ArrowRight size={16} /></button></div>
}

function dateLabel(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return formatSriLankaDate(value, options)
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

function safeZoomUrl(value) {
  return /^https?:\/\//i.test(value || '') ? value : '#'
}

function safeReferenceUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function assignmentStoragePath(publicUrl) {
  try {
    const url = new URL(publicUrl)
    const marker = '/storage/v1/object/public/assignment-files/'
    const markerIndex = url.pathname.indexOf(marker)
    return markerIndex < 0 ? null : decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
  } catch {
    return null
  }
}

function EmptyState({ text }) {
  return <div className="empty-state"><div><BookOpen size={20} /></div><p>{text}</p></div>
}

export default App
