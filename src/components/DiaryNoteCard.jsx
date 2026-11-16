import { memo, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { formatSriLankaDateTime } from '../lib/time.ts'

function DiaryNoteCard({ note, currentUser, userRole, onDelete }) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const authorRole = String(note.user_role || 'student').toLowerCase()
  const canDelete = userRole === 'admin'
    || userRole === 'lecturer'
    || note.user_id === currentUser?.id
  const initial = String(note.user_name || 'U').trim().charAt(0).toUpperCase() || 'U'
  const dateText = formatSriLankaDateTime(note.created_at)

  useEffect(() => setAvatarFailed(false), [note.user_avatar])

  return <article className="diary-note-card fade-in">
    <header className="diary-note-header">
      <div className="diary-note-author">
        <span className="diary-note-avatar">
          {note.user_avatar && !avatarFailed
            ? <img src={note.user_avatar} alt="" onError={() => setAvatarFailed(true)} />
            : initial}
        </span>
        <span className="diary-note-author-copy">
          <strong>{note.user_name || 'Study Hub member'}</strong>
          <span>{dateText}</span>
        </span>
      </div>
      <span className={`diary-role-badge diary-role-${authorRole}`}>{authorRole}</span>
    </header>
    {note.mood && <span className="diary-mood">{note.mood}</span>}
    <p className="diary-note-content">{note.content}</p>
    {canDelete && <footer className="diary-note-actions">
      <button type="button" className="diary-delete-button" onClick={() => onDelete(note)}>
        <Trash2 size={16} /> Delete
      </button>
    </footer>}
  </article>
}

export default memo(DiaryNoteCard)
