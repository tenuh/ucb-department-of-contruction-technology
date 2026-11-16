# University College of Batangala Construction Study Hub

A responsive construction-learning dashboard built with JavaScript, React, Vite, Tailwind CSS, and Supabase.

## Run locally

1. Install Node.js 18+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and either `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Run `npm run dev`.

PowerShell users can invoke the Windows shim as `npm.cmd` if the execution policy blocks `npm.ps1`.

Without Supabase credentials the app uses an in-memory demo. Changes in demo mode are not persistent:

| Login ID | Password | Role |
| --- | --- | --- |
| `STU001` | `student123` | Student |
| `LEC001` | `lecturer123` | Lecturer |
| `ADMIN001` | `admin123` | Admin |

## Supabase setup

Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. It uses the existing `public.users.id` text primary key and `public.users.name` display name, creates/migrates the hub tables, seeds the three accounts, creates the public `student-notes-pdfs` and `assignment-files` Storage buckets, and installs the Login ID + Password RPCs. Assignment PDFs are optional, limited to 10 MB, and stored with public URLs and file names on assignments. Most hub record IDs and foreign keys use text to preserve existing UUID or numeric IDs; uploaded student-note IDs use UUIDs. Existing plaintext seed passwords are upgraded to hashes at first successful login. The browser only needs the Supabase URL and publishable key.

When both Supabase environment variables are set, login uses accounts in that Supabase project's `public.users` table; the in-memory demo accounts are not a fallback. For a fresh project, run the schema before signing in. The seeded student login is `STU001` / `student123`; other student IDs such as `mond` must be created as accounts by an administrator.

The app uses short-lived, opaque server-validated sessions (12-hour expiry) stored in tab-scoped `sessionStorage` so a refresh keeps the current tab signed in; signing out revokes the token and clears the stored session. Session tokens and private diary data are not stored in `localStorage`. Database mutations go through role-checking security-definer RPCs. Row-level security is enabled and direct table grants are revoked except for public read access to `diary_notes`. The existing `diary` table remains private and unchanged; `diary_notes` is a separate public feed.

## Roles

- **Admin:** separate admin dashboard; manage student/lecturer/admin accounts and lecturer accounts, lecture notes, assignments/quizzes and assignment information, Zoom classes, deadlines, announcements, and public diary notes. The Lecturers page uses the existing `public.users` account model (Study Hub ID, name, and password), not email whitelisting or Supabase Auth profiles. The last admin and the currently signed-in admin cannot be deleted.
- **Lecturer:** add/delete lecture notes and Zoom classes, add/edit/delete assignments, deadlines, and assignment information, view the read-only student directory, upload shared student notes, and delete public diary notes for everyone.
- **Student:** view/download shared lecture and student notes, upload student notes, view assignment details and information, assignments/quizzes and Zoom links, and create private notes and diary entries. Students can delete only their own private or public diary entries.

Lecture notes are grouped by Foundation Period, English, Maths, and Physics, each with Semester 1 and Semester 2. Lecture-note PDF uploads are limited to 5 MB. All roles can upload shared student-note PDFs up to 10 MB with a title, subject, and description; they appear newest-first on the Student Notes tab. The community diary is available in the signed-in workspace, not on the login screen. It appears beneath personal entries on students' **My Diary** page; admins and lecturers use **Diary**. It loads 10 notes at a time and receives realtime inserts/deletes. Signed-in users can post; admins and lecturers can delete any public note, while other users can delete only their own. Personal diary entries continue to support a date, text, quote/memory, and a private photo upload (up to 4 MB).

All displayed dates, times, and dashboard greetings use the `Asia/Colombo` timezone. Assignment PDFs can be optionally attached on create or edit and are opened from their public Storage URL.

Creating an assignment creates its deadline entry. Creating a deadline creates a matching assignment. Due items within three days are highlighted and marked **URGENT** with a day countdown.

Each assignment has a details view with lecturer/admin-managed information cards, important points, reference links, optional PDF/image attachments, and an automatically recorded date added. Students can view the cards and download attachments but cannot manage them.

## Commands

- `npm run dev` — start the development server.
- `npm run build` — create a production build in `dist`.
- `npm run preview` — preview the production build.
