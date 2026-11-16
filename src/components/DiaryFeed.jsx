import { useState } from 'react'
import { ArrowDown, Send } from 'lucide-react'
import DiaryNoteCard from './DiaryNoteCard'

const moods = ['Grateful', 'Focused', 'Hopeful', 'Motivated', 'Reflective']

function DiaryFeed({
  notes = [],
  currentUser = null,
  userRole = 'student',
  loading = false,
  loadingMore = false,
  hasMore = false,
  error = '',
  onPost,
  onDelete,
  onLoadMore,
  onLogin,
}) {
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!content.trim()) {
      setPostError('Write a note before posting.')
      return
    }

    setPosting(true)
    setPostError('')
    try {
      const saved = await onPost({ content: content.trim(), mood })
      if (saved) {
        setContent('')
        setMood('')
      }
    } catch (submitError) {
      setPostError(submitError.message || 'Could not post your note.')
    } finally {
      setPosting(false)
    }
  }

  return <section className="public-diary-feed" aria-label="Public diary feed">
    <header className="diary-feed-heading">
      <div><span className="eyebrow">STUDY HUB COMMUNITY</span><h2>Public Diary</h2><p>Notes and moments shared by the learning community.</p></div>
    </header>

    {currentUser
      ? <form className="diary-post-form" onSubmit={submit}>
        <label className="diary-post-label" htmlFor="diary-content">Share a note</label>
        <textarea id="diary-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={4000} placeholder="What would you like to share?" required />
        <div className="diary-post-footer">
          <select aria-label="Mood" value={mood} onChange={(event) => setMood(event.target.value)}>
            <option value="">Mood (optional)</option>
            {moods.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <button type="submit" className="diary-post-button" disabled={posting || !content.trim()}>
            <Send size={16} />{posting ? 'Posting…' : 'Post note'}
          </button>
        </div>
        {postError && <p className="diary-error" role="alert">{postError}</p>}
      </form>
      : <div className="diary-login-prompt"><span>Want to share a note?</span><button type="button" onClick={onLogin}>Login to post</button></div>}

    {error && <p className="diary-error" role="alert">{error}</p>}
    {loading && notes.length === 0
      ? <div className="diary-note-list" aria-label="Loading notes">
        {Array.from({ length: 3 }, (_, index) => <div className="diary-skeleton animate-pulse" key={index}><span /><div><i /><i /></div><b /><i /></div>)}
      </div>
      : notes.length
        ? <div className="diary-note-list">{notes.map((note) => <DiaryNoteCard key={note.id} note={note} currentUser={currentUser} userRole={userRole} onDelete={onDelete} />)}</div>
        : !error && <div className="diary-empty">No notes yet</div>}

    {hasMore && <button type="button" className="diary-load-more" onClick={onLoadMore} disabled={loadingMore}>
      <ArrowDown size={16} />{loadingMore ? 'Loading…' : 'Load More'}
    </button>}
  </section>
}

export default DiaryFeed
