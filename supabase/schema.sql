drop function if exists public.hub_mutate(text, jsonb, text);
drop function if exists public.hub_mutate(text, text, jsonb);
drop function if exists public.hub_mutate(text, text);

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.users (
  id text primary key,
  password text not null,
  role text not null default 'student',
  name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.users add column if not exists name text not null default '';
alter table public.users add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'login_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'id'
  ) then
    alter table public.users rename column login_id to id;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'display_name'
  ) then
    execute $sql$update public.users set name = display_name where coalesce(name, '') = ''$sql$;
  end if;
end
$$;
alter table public.users add column if not exists id text;
alter table public.users add column if not exists password text not null default '';
alter table public.users add column if not exists role text not null default 'student';
alter table public.users add column if not exists name text not null default '';
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('student', 'lecturer', 'admin'));

create table if not exists public.hub_sessions (
  token_hash text primary key,
  id text not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.hub_sessions add column if not exists token_hash text;
alter table public.hub_sessions add column if not exists expires_at timestamptz;
alter table public.hub_sessions add column if not exists created_at timestamptz not null default now();
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hub_sessions' and column_name = 'login_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hub_sessions' and column_name = 'id'
  ) then
    alter table public.hub_sessions rename column login_id to id;
  end if;
end
$$;
alter table public.hub_sessions add column if not exists id text;

create table if not exists public.lecture_notes (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subject text not null default 'Foundation Period',
  semester text not null default 'Semester 1',
  file_data text not null default '',
  description text not null default '',
  uploaded_at timestamptz not null default now(),
  uploaded_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.lecture_notes add column if not exists id text default gen_random_uuid()::text;
alter table public.lecture_notes add column if not exists title text not null default '';
alter table public.lecture_notes add column if not exists subject text not null default 'Foundation Period';
alter table public.lecture_notes add column if not exists semester text not null default 'Semester 1';
alter table public.lecture_notes add column if not exists file_data text not null default '';
alter table public.lecture_notes add column if not exists description text not null default '';
alter table public.lecture_notes add column if not exists uploaded_at timestamptz not null default now();
alter table public.lecture_notes add column if not exists uploaded_by text references public.users(id) on delete set null;
alter table public.lecture_notes add column if not exists created_at timestamptz not null default now();
update public.lecture_notes set subject = 'Foundation Period'
where subject not in ('Foundation Period', 'English', 'Maths', 'Physics');

create table if not exists public.assignments (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subject text not null default '',
  due_date date not null,
  status text not null default 'Not started',
  type text not null default 'assignment',
  duration_minutes integer,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.assignments add column if not exists id text default gen_random_uuid()::text;
alter table public.assignments add column if not exists title text not null default '';
alter table public.assignments add column if not exists subject text not null default '';
alter table public.assignments add column if not exists due_date date not null default current_date;
alter table public.assignments add column if not exists status text not null default 'Not started';
alter table public.assignments add column if not exists type text not null default 'assignment';
alter table public.assignments add column if not exists duration_minutes integer;
alter table public.assignments add column if not exists created_by text references public.users(id) on delete set null;
alter table public.assignments add column if not exists created_at timestamptz not null default now();
alter table public.assignments add column if not exists pdf_url text;
alter table public.assignments add column if not exists pdf_name text;

create table if not exists public.assignment_information (
  id text primary key default gen_random_uuid()::text,
  assignment_id text not null,
  title text not null,
  details text not null default '',
  important_points jsonb not null default '[]'::jsonb,
  reference_links jsonb not null default '[]'::jsonb,
  file_data text not null default '',
  file_name text not null default '',
  file_type text not null default '',
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.assignment_information add column if not exists id text default gen_random_uuid()::text;
alter table public.assignment_information add column if not exists assignment_id text;
alter table public.assignment_information add column if not exists title text not null default '';
alter table public.assignment_information add column if not exists details text not null default '';
alter table public.assignment_information add column if not exists important_points jsonb not null default '[]'::jsonb;
alter table public.assignment_information add column if not exists reference_links jsonb not null default '[]'::jsonb;
alter table public.assignment_information add column if not exists file_data text not null default '';
alter table public.assignment_information add column if not exists file_name text not null default '';
alter table public.assignment_information add column if not exists file_type text not null default '';
alter table public.assignment_information add column if not exists created_by text references public.users(id) on delete set null;
alter table public.assignment_information add column if not exists created_at timestamptz not null default now();
create index if not exists assignment_information_assignment_created_idx
  on public.assignment_information (assignment_id, created_at desc);

create table if not exists public.quizzes (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subject text not null default '',
  due_date date not null,
  status text not null default 'Not started',
  duration_minutes integer not null default 15,
  question text not null default '',
  options jsonb not null default '[]'::jsonb,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.quizzes add column if not exists id text default gen_random_uuid()::text;
alter table public.quizzes add column if not exists title text not null default '';
alter table public.quizzes add column if not exists subject text not null default '';
alter table public.quizzes add column if not exists due_date date not null default current_date;
alter table public.quizzes add column if not exists status text not null default 'Not started';
alter table public.quizzes add column if not exists duration_minutes integer not null default 15;
alter table public.quizzes add column if not exists question text not null default '';
alter table public.quizzes add column if not exists options jsonb not null default '[]'::jsonb;
alter table public.quizzes add column if not exists created_by text references public.users(id) on delete set null;
alter table public.quizzes add column if not exists created_at timestamptz not null default now();

create table if not exists public.deadlines (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  due_date date not null,
  course text not null default '',
  assignment_id text,
  quiz_id text,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.deadlines add column if not exists id text default gen_random_uuid()::text;
alter table public.deadlines add column if not exists title text not null default '';
alter table public.deadlines add column if not exists due_date date not null default current_date;
alter table public.deadlines add column if not exists course text not null default '';
alter table public.deadlines add column if not exists assignment_id text;
alter table public.deadlines add column if not exists quiz_id text;
alter table public.deadlines add column if not exists created_by text references public.users(id) on delete set null;
alter table public.deadlines add column if not exists created_at timestamptz not null default now();

create table if not exists public.zoom_meetings (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  meeting_date timestamptz not null,
  join_url text not null default '',
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.zoom_meetings add column if not exists id text default gen_random_uuid()::text;
alter table public.zoom_meetings add column if not exists title text not null default '';
alter table public.zoom_meetings add column if not exists meeting_date timestamptz not null default now();
alter table public.zoom_meetings add column if not exists join_url text not null default '';
alter table public.zoom_meetings add column if not exists created_by text references public.users(id) on delete set null;
alter table public.zoom_meetings add column if not exists created_at timestamptz not null default now();
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'zoom_meetings'
      and column_name = 'meeting_date' and data_type <> 'timestamp with time zone'
  ) then
    alter table public.zoom_meetings alter column meeting_date drop default;
    alter table public.zoom_meetings alter column meeting_date type timestamptz
      using coalesce(nullif(btrim(meeting_date::text), '')::timestamptz, now());
    alter table public.zoom_meetings alter column meeting_date set default now();
  end if;
end
$$;

create table if not exists public.announcements (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  content text not null default '',
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements add column if not exists id text default gen_random_uuid()::text;
alter table public.announcements add column if not exists title text not null default '';
alter table public.announcements add column if not exists content text not null default '';
alter table public.announcements add column if not exists created_by text references public.users(id) on delete set null;
alter table public.announcements add column if not exists created_at timestamptz not null default now();

create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id text references public.users(id) on delete cascade,
  title text not null,
  content text not null default '',
  subject text not null default '',
  description text not null default '',
  file_name text not null default '',
  file_url text,
  uploaded_by text references public.users(id) on delete set null,
  uploaded_by_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.student_notes add column if not exists id uuid default gen_random_uuid();
alter table public.student_notes add column if not exists owner_id text references public.users(id) on delete cascade;
alter table public.student_notes add column if not exists title text not null default '';
alter table public.student_notes add column if not exists content text not null default '';
alter table public.student_notes add column if not exists subject text not null default '';
alter table public.student_notes add column if not exists description text not null default '';
alter table public.student_notes add column if not exists file_name text not null default '';
alter table public.student_notes add column if not exists file_url text;
alter table public.student_notes add column if not exists uploaded_by text references public.users(id) on delete set null;
alter table public.student_notes add column if not exists uploaded_by_name text not null default '';
alter table public.student_notes add column if not exists created_at timestamptz not null default now();
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_notes'
      and column_name = 'id' and data_type <> 'uuid'
  ) then
    alter table public.student_notes alter column id drop default;
    alter table public.student_notes alter column id type uuid using
      case
        when id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then id::text::uuid
        else gen_random_uuid()
      end;
  end if;
  alter table public.student_notes alter column id set default gen_random_uuid();
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_notes' and column_name = 'owner_login_id'
  ) then
    execute 'update public.student_notes n set owner_id = u.id from public.users u where n.owner_id is null and n.owner_login_id = u.id';
  end if;
end
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-notes-pdfs', 'student-notes-pdfs', true, 10485760, array['application/pdf'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "student notes pdf public read" on storage.objects;
create policy "student notes pdf public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'student-notes-pdfs');
drop policy if exists "student notes pdf upload" on storage.objects;
create policy "student notes pdf upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'student-notes-pdfs');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assignment-files', 'assignment-files', true, 10485760, array['application/pdf'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "assignment files public read" on storage.objects;
create policy "assignment files public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'assignment-files');

drop policy if exists "assignment files upload" on storage.objects;
create policy "assignment files upload" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'assignment-files'
    and (storage.foldername(name))[1] = 'assignments'
    and (storage.foldername(name))[2] <> ''
    and lower(name) like 'assignments/%/%.pdf'
  );

create or replace function public.assignment_storage_object_is_unreferenced(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (storage.foldername(p_name))[1] = 'assignments'
    and (storage.foldername(p_name))[2] <> ''
    and not exists (
      select 1
      from public.assignments a
      where a.id = (storage.foldername(p_name))[2]
        and position('/object/public/assignment-files/' || p_name in coalesce(a.pdf_url, '')) > 0
    ),
    false
  );
$$;

drop policy if exists "assignment files delete unreferenced" on storage.objects;
create policy "assignment files delete unreferenced" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'assignment-files' and public.assignment_storage_object_is_unreferenced(name));

create table if not exists public.diary (
  id text primary key default gen_random_uuid()::text,
  owner_id text references public.users(id) on delete cascade,
  title text not null,
  content text not null default '',
  entry_date date not null default current_date,
  photo_data text,
  quote text not null default '',
  created_at timestamptz not null default now()
);
alter table public.diary add column if not exists id text default gen_random_uuid()::text;
alter table public.diary add column if not exists owner_id text references public.users(id) on delete cascade;
alter table public.diary add column if not exists title text not null default '';
alter table public.diary add column if not exists content text not null default '';
alter table public.diary add column if not exists entry_date date not null default current_date;
alter table public.diary add column if not exists photo_data text;
alter table public.diary add column if not exists quote text not null default '';
alter table public.diary add column if not exists created_at timestamptz not null default now();
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'diary' and column_name = 'owner_login_id'
  ) then
    execute 'update public.diary d set owner_id = u.id from public.users u where d.owner_id is null and d.owner_login_id = u.id';
  end if;
end
$$;

create table if not exists public.diary_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  content text not null,
  mood text,
  created_at timestamptz not null default now(),
  user_name text not null,
  user_avatar text,
  user_id text references public.users(id) on delete set null
);
alter table public.diary_notes add column if not exists id uuid default extensions.gen_random_uuid();
alter table public.diary_notes add column if not exists content text not null default '';
alter table public.diary_notes add column if not exists mood text;
alter table public.diary_notes add column if not exists created_at timestamptz not null default now();
alter table public.diary_notes add column if not exists user_name text not null default '';
alter table public.diary_notes add column if not exists user_avatar text;
alter table public.diary_notes add column if not exists user_id text references public.users(id) on delete set null;
create index if not exists diary_notes_created_at_idx on public.diary_notes (created_at desc);
alter table public.diary_notes enable row level security;
drop policy if exists diary_notes_public_read on public.diary_notes;
create policy diary_notes_public_read on public.diary_notes
  for select to anon, authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'diary_notes'
     ) then
    alter publication supabase_realtime add table public.diary_notes;
  end if;
end
$$;

drop function if exists public.hub_diary_author_roles(text[]);
create function public.hub_diary_author_roles(p_user_ids text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(u.id, u.role), '{}'::jsonb)
  from public.users u
  where u.id = any(coalesce(p_user_ids, array[]::text[]))
    and exists (select 1 from public.diary_notes n where n.user_id::text = u.id::text);
$$;

create table if not exists public.events (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  event_date timestamptz not null,
  location text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.badges (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text not null default '',
  icon text not null default '',
  earned boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
declare
  table_name text;
  constraint_row record;
begin
  for constraint_row in
    select c.conname from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.assignment_information'::regclass
      and c.contype = 'f' and a.attname = 'assignment_id'
  loop
    execute format('alter table public.assignment_information drop constraint %I', constraint_row.conname);
  end loop;
  for constraint_row in
    select c.conname from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.deadlines'::regclass
      and c.contype = 'f' and a.attname in ('assignment_id', 'quiz_id')
  loop
    execute format('alter table public.deadlines drop constraint %I', constraint_row.conname);
  end loop;

  foreach table_name in array array[
    'lecture_notes', 'assignments', 'assignment_information', 'quizzes',
    'deadlines', 'zoom_meetings', 'announcements', 'diary', 'events', 'badges'
  ]
  loop
    if exists (
      select 1 from pg_attribute
      where attrelid = format('public.%I', table_name)::regclass
        and attname = 'id' and not attisdropped
        and format_type(atttypid, atttypmod) <> 'text'
    ) then
      execute format('alter table public.%I alter column id drop identity if exists', table_name);
      execute format('alter table public.%I alter column id drop default', table_name);
      execute format('alter table public.%I alter column id type text using id::text', table_name);
      execute format('alter table public.%I alter column id set default gen_random_uuid()::text', table_name);
    end if;
  end loop;
  alter table public.assignment_information alter column assignment_id type text using assignment_id::text;
  alter table public.deadlines alter column assignment_id type text using assignment_id::text;
  alter table public.deadlines alter column quiz_id type text using quiz_id::text;
  alter table public.assignment_information
    add constraint assignment_information_assignment_id_fkey
    foreign key (assignment_id) references public.assignments(id) on delete cascade not valid;
  alter table public.deadlines
    add constraint deadlines_assignment_id_fkey
    foreign key (assignment_id) references public.assignments(id) on delete cascade not valid;
  alter table public.deadlines
    add constraint deadlines_quiz_id_fkey
    foreign key (quiz_id) references public.quizzes(id) on delete cascade not valid;
end
$$;

insert into public.users (id, password, role, name) values
  ('STU001', extensions.crypt('student123', extensions.gen_salt('bf')), 'student', 'Sam Taylor'),
  ('LEC001', extensions.crypt('lecturer123', extensions.gen_salt('bf')), 'lecturer', 'Alex Morgan'),
  ('ADMIN001', extensions.crypt('admin123', extensions.gen_salt('bf')), 'admin', 'Jordan Lee')
on conflict (id) do update set role = excluded.role, name = excluded.name;

insert into public.lecture_notes (title, subject, semester, description, uploaded_by)
select seed.title, seed.subject, seed.semester, seed.description, 'LEC001'
from (values
  ('Foundations & Site Preparation', 'Foundation Period', 'Semester 1', 'Site investigation, soil types, and setting out.'),
  ('Technical Reading Basics', 'English', 'Semester 1', 'Reading technical briefs, reports, and construction vocabulary.'),
  ('Measurement & Scale', 'Maths', 'Semester 1', 'Units, conversions, ratios, and working with scale drawings.'),
  ('Forces in Structures', 'Physics', 'Semester 1', 'An introduction to forces, loads, and equilibrium.'),
  ('Building Science Review', 'Foundation Period', 'Semester 2', 'Review notes for the second semester foundation period.')
) as seed(title, subject, semester, description)
where not exists (
  select 1 from public.lecture_notes n
  where n.title = seed.title and n.subject = seed.subject and n.semester = seed.semester
);

insert into public.assignments (title, subject, due_date, status, type)
select seed.title, seed.subject, seed.due_date, 'Not started', 'assignment'
from (values
  ('Site analysis report', 'Foundation Period', '2026-11-22'::date),
  ('Technical vocabulary worksheet', 'English', '2026-11-25'::date)
) as seed(title, subject, due_date)
where not exists (
  select 1 from public.assignments a where a.title = seed.title and a.subject = seed.subject
);

insert into public.quizzes (title, subject, due_date, duration_minutes, question, options)
select 'Materials knowledge check', 'Physics', '2026-11-25'::date, 15,
  'Which material is most commonly used to reinforce concrete?',
  '["Timber", "Steel rebar", "Clay brick", "Gypsum board"]'::jsonb
where not exists (
  select 1 from public.quizzes where title = 'Materials knowledge check' and subject = 'Physics'
);

update public.deadlines d set assignment_id = a.id
from public.assignments a
where d.assignment_id is null and d.title = a.title;
update public.deadlines d set quiz_id = q.id
from public.quizzes q
where d.quiz_id is null and d.assignment_id is null and d.title = q.title;
insert into public.deadlines (title, due_date, course, assignment_id)
select a.title, a.due_date, a.subject, a.id from public.assignments a
where not exists (select 1 from public.deadlines d where d.assignment_id = a.id or d.title = a.title);
insert into public.deadlines (title, due_date, course, quiz_id)
select q.title, q.due_date, q.subject, q.id from public.quizzes q
where not exists (select 1 from public.deadlines d where d.quiz_id = q.id or d.title = q.title);

insert into public.zoom_meetings (title, meeting_date, join_url)
select seed.title, seed.meeting_date, 'https://zoom.us/'
from (values
  ('Foundation Period — Q&A', '2026-11-18 10:00:00+00'::timestamptz),
  ('Maths support class', '2026-11-20 14:30:00+00'::timestamptz)
) as seed(title, meeting_date)
where not exists (
  select 1 from public.zoom_meetings z
  where z.title = seed.title and z.meeting_date::timestamptz = seed.meeting_date::timestamptz
);

drop function if exists public.hub_session_user(text);
create function public.hub_session_user(p_token text)
returns table (id text, role text, name text)
language sql
security definer
set search_path = ''
as $$
  select u.id, u.role, u.name
  from public.hub_sessions s
  join public.users u on u.id = s.id
  where s.token_hash = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.expires_at > now()
  limit 1;
$$;

drop function if exists public.login_user(text, text);
create function public.login_user(p_id text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users%rowtype;
  v_token text;
begin
  select * into v_user from public.users
  where lower(trim(id)) = lower(trim(p_id))
    and case when password like '$2%' then password = extensions.crypt(p_password, password)
             else password = p_password end
  limit 1;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Login ID or password not recognized.');
  end if;
  if v_user.password = p_password then
    update public.users set password = extensions.crypt(p_password, extensions.gen_salt('bf'))
    where id = v_user.id;
  end if;

  delete from public.hub_sessions where expires_at <= now();
  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.hub_sessions (token_hash, id, expires_at)
  values (pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user.id, now() + interval '12 hours');
  return jsonb_build_object(
    'success', true, 'id', v_user.id, 'name', v_user.name, 'role', v_user.role,
    'session_token', v_token,
    'user', jsonb_build_object('id', v_user.id, 'role', v_user.role, 'name', v_user.name)
  );
end;
$$;

create or replace function public.hub_logout(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  delete from public.hub_sessions
  where token_hash = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex');
  select true;
$$;

create or replace function public.hub_get_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text;
  v_role text;
  v_name text;
  v_data jsonb;
begin
  select s.id, s.role, s.name into v_user_id, v_role, v_name
  from public.hub_session_user(p_token) s;
  if not found then raise exception 'Session expired. Sign in again.'; end if;
  select jsonb_build_object(
    'lecture_notes', coalesce((select jsonb_agg((to_jsonb(n) - 'file_data') || jsonb_build_object('uploaded_by', coalesce(u.name, n.uploaded_by)) order by n.subject, n.semester, n.title) from public.lecture_notes n left join public.users u on u.id = n.uploaded_by), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(to_jsonb(a) order by a.due_date) from public.assignments a), '[]'::jsonb),
    'assignment_information', coalesce((select jsonb_agg((to_jsonb(i) - 'file_data') || jsonb_build_object('created_by', coalesce(u.name, i.created_by)) order by i.created_at desc) from public.assignment_information i left join public.users u on u.id = i.created_by), '[]'::jsonb),
    'quizzes', coalesce((select jsonb_agg(to_jsonb(q) order by q.due_date) from public.quizzes q), '[]'::jsonb),
    'deadlines', case when v_role in ('admin', 'lecturer') then coalesce((select jsonb_agg(to_jsonb(d) order by d.due_date) from public.deadlines d), '[]'::jsonb) else '[]'::jsonb end,
    'zoom_meetings', coalesce((select jsonb_agg(to_jsonb(z) order by z.meeting_date) from public.zoom_meetings z), '[]'::jsonb),
    'announcements', case when v_role = 'admin' then coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'content', a.content, 'created_at', a.created_at, 'created_by', coalesce(u.name, a.created_by)) order by a.created_at desc) from public.announcements a left join public.users u on u.id = a.created_by), '[]'::jsonb) else '[]'::jsonb end,
    'student_notes', case when v_role = 'student' then coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.student_notes n where n.owner_id = v_user_id), '[]'::jsonb) else '[]'::jsonb end,
    'diary', case when v_role = 'student' then coalesce((select jsonb_agg(to_jsonb(d) order by d.entry_date desc, d.created_at desc) from public.diary d where d.owner_id = v_user_id), '[]'::jsonb) else '[]'::jsonb end,
    'users', case when v_role = 'admin' then coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'role', u.role, 'name', u.name, 'created_at', u.created_at) order by u.created_at) from public.users u), '[]'::jsonb) else '[]'::jsonb end,
    'students', case when v_role in ('admin', 'lecturer') then coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'role', u.role, 'name', u.name) order by u.name) from public.users u where u.role = 'student'), '[]'::jsonb) else '[]'::jsonb end
  ) into v_data;
  return v_data;
end;
$$;

drop function if exists public.hub_download_note(text, uuid);
drop function if exists public.hub_download_note(text, text);
create function public.hub_download_note(p_token text, p_note_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file_data text;
begin
  perform 1 from public.hub_session_user(p_token);
  if not found then raise exception 'Session expired. Sign in again.'; end if;
  select n.file_data into v_file_data from public.lecture_notes n where n.id::text = p_note_id;
  if not found then raise exception 'Lecture note was not found.'; end if;
  return coalesce(v_file_data, '');
end;
$$;

drop function if exists public.hub_download_assignment_info_file(text, uuid);
drop function if exists public.hub_download_assignment_info_file(text, text);
create function public.hub_download_assignment_info_file(p_token text, p_information_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file_data text;
begin
  perform 1 from public.hub_session_user(p_token);
  if not found then raise exception 'Session expired. Sign in again.'; end if;
  select i.file_data into v_file_data from public.assignment_information i where i.id::text = p_information_id;
  if not found then raise exception 'Assignment information was not found.'; end if;
  if coalesce(v_file_data, '') = '' then raise exception 'This information has no attached file.'; end if;
  return v_file_data;
end;
$$;

create or replace function public.hub_mutate(p_token text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text;
  v_role text;
  v_name text;
  v_id text;
  v_type text;
  v_password text;
  v_assignment_id text;
  v_quiz_id text;
  v_old_title text;
begin
  select s.id, s.role, s.name into v_user_id, v_role, v_name
  from public.hub_session_user(p_token) s;
  if not found then raise exception 'Session expired. Sign in again.'; end if;

  if p_action like 'user_%' or p_action like 'announcement_%' then
    if v_role <> 'admin' then raise exception 'Only administrators can manage users and announcements.'; end if;
  elsif p_action like 'note_%' or p_action like 'assignment_%'
     or p_action like 'zoom_%' or p_action like 'deadline_%' then
    if v_role not in ('admin', 'lecturer') then
      raise exception 'Only lecturers and administrators can manage course content.';
    end if;
    if v_role = 'lecturer' and p_action in ('note_update', 'zoom_update') then
      raise exception 'Lecturers may add or remove notes and Zoom links but cannot edit them.';
    end if;
  elsif p_action in ('student_note_list', 'student_note_create', 'student_note_delete') then
    null;
  elsif p_action in ('diary_create', 'diary_delete') then
    if v_role <> 'student' then raise exception 'Only students can manage their private notes and diary.'; end if;
  else
    raise exception 'Unsupported action: %', p_action;
  end if;

  if p_action = 'student_note_list' then
    return coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', n.id,
          'title', n.title,
          'subject', n.subject,
          'description', n.description,
          'file_name', n.file_name,
          'file_url', n.file_url,
          'uploaded_by', n.uploaded_by,
          'uploaded_by_name', n.uploaded_by_name,
          'created_at', n.created_at
        ) order by n.created_at desc)
        from public.student_notes n
        where nullif(n.file_url, '') is not null
      ),
      '[]'::jsonb
    );
  elsif p_action = 'user_create' then
    v_password := p_payload->>'password';
    if length(coalesce(v_password, '')) < 6 then raise exception 'Password must be at least 6 characters.'; end if;
    if coalesce(p_payload->>'role', '') not in ('student', 'lecturer', 'admin') then raise exception 'Invalid user role.'; end if;
    insert into public.users (id, password, role, name)
    values (upper(trim(p_payload->>'id')), extensions.crypt(v_password, extensions.gen_salt('bf')), p_payload->>'role', p_payload->>'name');
  elsif p_action = 'user_update' then
    if coalesce(p_payload->>'role', '') not in ('student', 'lecturer', 'admin') then raise exception 'Invalid user role.'; end if;
    if nullif(p_payload->>'password', '') is not null then
      if length(p_payload->>'password') < 6 then raise exception 'Password must be at least 6 characters.'; end if;
      update public.users set role = p_payload->>'role', name = p_payload->>'name',
        password = extensions.crypt(p_payload->>'password', extensions.gen_salt('bf'))
      where id = coalesce(p_payload->>'old_id', p_payload->>'id');
    else
      update public.users set role = p_payload->>'role', name = p_payload->>'name'
      where id = coalesce(p_payload->>'old_id', p_payload->>'id');
    end if;
    if not found then raise exception 'User was not found.'; end if;
  elsif p_action = 'user_delete' then
    if p_payload->>'id' = v_user_id then raise exception 'You cannot delete the account you are currently using.'; end if;
    if exists (select 1 from public.users where id = p_payload->>'id' and role = 'admin')
       and (select count(*) from public.users where role = 'admin') <= 1 then
      raise exception 'The last administrator account cannot be deleted.';
    end if;
    delete from public.users where id = p_payload->>'id';
  elsif p_action = 'note_create' then
    if p_payload->>'subject' not in ('Foundation Period', 'English', 'Maths', 'Physics') then raise exception 'Choose a valid lecture-note subject.'; end if;
    if p_payload->>'semester' not in ('Semester 1', 'Semester 2') then raise exception 'Choose a valid semester.'; end if;
    if length(coalesce(p_payload->>'file_data', '')) > 7200000 then raise exception 'PDF exceeds the upload size limit.'; end if;
    if coalesce(p_payload->>'file_data', '') not like 'data:application/pdf;base64,%' then raise exception 'Attach a PDF file to this lecture note.'; end if;
    insert into public.lecture_notes (title, subject, semester, description, file_data, uploaded_by)
    values (p_payload->>'title', p_payload->>'subject', p_payload->>'semester', coalesce(p_payload->>'description', ''), p_payload->>'file_data', v_user_id);
  elsif p_action = 'note_update' then
    if p_payload->>'subject' not in ('Foundation Period', 'English', 'Maths', 'Physics') then raise exception 'Choose a valid lecture-note subject.'; end if;
    if p_payload->>'semester' not in ('Semester 1', 'Semester 2') then raise exception 'Choose a valid semester.'; end if;
    if length(coalesce(p_payload->>'file_data', '')) > 7200000 then raise exception 'PDF exceeds the upload size limit.'; end if;
    if p_payload ? 'file_data' and p_payload->>'file_data' not like 'data:application/pdf;base64,%' then raise exception 'Attach a valid PDF file.'; end if;
    update public.lecture_notes set title = p_payload->>'title', subject = p_payload->>'subject',
      semester = p_payload->>'semester', description = coalesce(p_payload->>'description', ''),
      file_data = coalesce(p_payload->>'file_data', file_data),
      uploaded_at = case when p_payload ? 'file_data' then now() else uploaded_at end,
      uploaded_by = case when p_payload ? 'file_data' then v_user_id else uploaded_by end
    where id::text = p_payload->>'id';
    if not found then raise exception 'Lecture note was not found.'; end if;
  elsif p_action = 'note_delete' then
    delete from public.lecture_notes where id::text = p_payload->>'id';
    if not found then raise exception 'Lecture note was not found.'; end if;
  elsif p_action = 'assignment_info_create' then
    if length(trim(coalesce(p_payload->>'title', ''))) = 0 or length(trim(coalesce(p_payload->>'details', ''))) = 0 then
      raise exception 'Information title and details are required.';
    end if;
    if jsonb_typeof(coalesce(p_payload->'important_points', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(p_payload->'reference_links', '[]'::jsonb)) <> 'array' then
      raise exception 'Important points and reference links must be lists.';
    end if;
    if length(coalesce(p_payload->>'file_data', '')) > 7200000 then raise exception 'Attachment exceeds the 5 MB limit.'; end if;
    if coalesce(p_payload->>'file_data', '') <> ''
       and coalesce(p_payload->>'file_data', '') not like 'data:application/pdf;base64,%'
       and coalesce(p_payload->>'file_data', '') !~ '^data:image/[a-zA-Z0-9.+-]+;base64,' then
      raise exception 'Attach a PDF or image file.';
    end if;
    insert into public.assignment_information (assignment_id, title, details, important_points, reference_links, file_data, file_name, file_type, created_by)
    select a.id, trim(p_payload->>'title'), p_payload->>'details',
      coalesce(p_payload->'important_points', '[]'::jsonb), coalesce(p_payload->'reference_links', '[]'::jsonb),
      coalesce(p_payload->>'file_data', ''), coalesce(p_payload->>'file_name', ''), coalesce(p_payload->>'file_type', ''), v_user_id
    from public.assignments a where a.id::text = p_payload->>'assignment_id';
    if not found then raise exception 'Assignment was not found.'; end if;
  elsif p_action = 'assignment_info_update' then
    if length(trim(coalesce(p_payload->>'title', ''))) = 0 or length(trim(coalesce(p_payload->>'details', ''))) = 0 then
      raise exception 'Information title and details are required.';
    end if;
    update public.assignment_information set title = trim(p_payload->>'title'), details = p_payload->>'details',
      important_points = coalesce(p_payload->'important_points', '[]'::jsonb),
      reference_links = coalesce(p_payload->'reference_links', '[]'::jsonb),
      file_data = case when p_payload ? 'file_data' then p_payload->>'file_data' when p_payload ? 'remove_file' then '' else file_data end,
      file_name = case when p_payload ? 'file_data' then coalesce(p_payload->>'file_name', '') when p_payload ? 'remove_file' then '' else file_name end,
      file_type = case when p_payload ? 'file_data' then coalesce(p_payload->>'file_type', '') when p_payload ? 'remove_file' then '' else file_type end
    where id::text = p_payload->>'id';
    if not found then raise exception 'Assignment information was not found.'; end if;
  elsif p_action = 'assignment_info_delete' then
    delete from public.assignment_information where id::text = p_payload->>'id';
    if not found then raise exception 'Assignment information was not found.'; end if;
  elsif p_action = 'assignment_create' then
    v_type := coalesce(p_payload->>'type', 'assignment');
    if v_type = 'quiz' then
      if length(coalesce(p_payload->>'question', '')) = 0 or jsonb_array_length(coalesce(p_payload->'options', '[]'::jsonb)) < 2 then
        raise exception 'A quiz needs a question and at least two answer options.';
      end if;
      insert into public.quizzes (title, subject, due_date, duration_minutes, question, options, created_by)
      values (p_payload->>'title', coalesce(p_payload->>'subject', ''), (p_payload->>'due_date')::date,
        coalesce((p_payload->>'duration_minutes')::integer, 15), p_payload->>'question', p_payload->'options', v_user_id)
      returning id into v_id;
      insert into public.deadlines (title, due_date, course, quiz_id, created_by)
      values (p_payload->>'title', (p_payload->>'due_date')::date, coalesce(p_payload->>'subject', ''), v_id, v_user_id);
    else
      insert into public.assignments (
        id, title, subject, due_date, type, created_by, pdf_url, pdf_name
      )
      values (
        coalesce(nullif(p_payload->>'id', ''), extensions.gen_random_uuid()::text),
        p_payload->>'title',
        coalesce(p_payload->>'subject', ''),
        (p_payload->>'due_date')::date,
        'assignment',
        v_user_id,
        nullif(p_payload->>'pdf_url', ''),
        nullif(p_payload->>'pdf_name', '')
      )
      returning id into v_id;
      insert into public.deadlines (title, due_date, course, assignment_id, created_by)
      values (p_payload->>'title', (p_payload->>'due_date')::date, coalesce(p_payload->>'subject', ''), v_id, v_user_id);
    end if;
  elsif p_action = 'assignment_update' then
    v_id := p_payload->>'id';
    if exists (select 1 from public.quizzes where id = v_id) then
      if length(coalesce(p_payload->>'question', '')) = 0 or jsonb_array_length(coalesce(p_payload->'options', '[]'::jsonb)) < 2 then
        raise exception 'A quiz needs a question and at least two answer options.';
      end if;
      select title into v_old_title from public.quizzes where id = v_id;
      update public.quizzes set title = p_payload->>'title', subject = p_payload->>'subject',
        due_date = (p_payload->>'due_date')::date,
        duration_minutes = coalesce((p_payload->>'duration_minutes')::integer, duration_minutes),
        question = p_payload->>'question', options = p_payload->'options'
      where id = v_id;
      update public.deadlines set title = p_payload->>'title', course = p_payload->>'subject',
        due_date = (p_payload->>'due_date')::date where quiz_id = v_id;
    else
      update public.assignments set title = p_payload->>'title', subject = p_payload->>'subject',
        due_date = (p_payload->>'due_date')::date,
        pdf_url = case when p_payload ? 'pdf_url' then nullif(p_payload->>'pdf_url', '') else pdf_url end,
        pdf_name = case when p_payload ? 'pdf_name' then nullif(p_payload->>'pdf_name', '') else pdf_name end
      where id = v_id;
      update public.deadlines set title = p_payload->>'title', course = p_payload->>'subject',
        due_date = (p_payload->>'due_date')::date where assignment_id = v_id;
    end if;
  elsif p_action = 'assignment_delete' then
    v_id := p_payload->>'id';
    if p_payload->>'type' = 'quiz' then
      select title into v_old_title from public.quizzes where id = v_id;
      delete from public.deadlines where quiz_id = v_id or (quiz_id is null and title = v_old_title);
      delete from public.quizzes where id = v_id;
    else
      delete from public.assignments where id = v_id;
    end if;
  elsif p_action = 'deadline_create' then
    insert into public.assignments (title, subject, due_date, type, created_by)
    values (p_payload->>'title', coalesce(p_payload->>'course', ''), (p_payload->>'due_date')::date, 'assignment', v_user_id)
    returning id into v_id;
    insert into public.deadlines (title, due_date, course, assignment_id, created_by)
    values (p_payload->>'title', (p_payload->>'due_date')::date, coalesce(p_payload->>'course', ''), v_id, v_user_id);
  elsif p_action = 'deadline_update' then
    v_id := p_payload->>'id';
    update public.deadlines set title = p_payload->>'title', course = p_payload->>'course',
      due_date = (p_payload->>'due_date')::date
    where id = v_id returning assignment_id, quiz_id into v_assignment_id, v_quiz_id;
    if not found then raise exception 'Deadline was not found.'; end if;
    if v_assignment_id is not null then
      update public.assignments set title = p_payload->>'title', subject = p_payload->>'course',
        due_date = (p_payload->>'due_date')::date where id = v_assignment_id;
    elsif v_quiz_id is not null then
      update public.quizzes set title = p_payload->>'title', subject = p_payload->>'course',
        due_date = (p_payload->>'due_date')::date where id = v_quiz_id;
    end if;
  elsif p_action = 'deadline_delete' then
    v_id := p_payload->>'id';
    select assignment_id, quiz_id into v_assignment_id, v_quiz_id from public.deadlines where id = v_id;
    if not found then raise exception 'Deadline was not found.'; end if;
    if v_assignment_id is not null then delete from public.assignments where id = v_assignment_id;
    elsif v_quiz_id is not null then delete from public.quizzes where id = v_quiz_id;
    else delete from public.deadlines where id = v_id;
    end if;
  elsif p_action = 'zoom_create' then
    if p_payload->>'join_url' !~* '^https?://' then raise exception 'Use a valid HTTPS or HTTP Zoom link.'; end if;
    insert into public.zoom_meetings (title, join_url, meeting_date, created_by)
    values (p_payload->>'title', p_payload->>'join_url', (p_payload->>'meeting_date')::timestamptz, v_user_id);
  elsif p_action = 'zoom_update' then
    if p_payload->>'join_url' !~* '^https?://' then raise exception 'Use a valid HTTPS or HTTP Zoom link.'; end if;
    update public.zoom_meetings set title = p_payload->>'title', join_url = p_payload->>'join_url',
      meeting_date = (p_payload->>'meeting_date')::timestamptz where id = p_payload->>'id';
    if not found then raise exception 'Zoom meeting was not found.'; end if;
  elsif p_action = 'zoom_delete' then
    delete from public.zoom_meetings where id = p_payload->>'id';
    if not found then raise exception 'Zoom meeting was not found.'; end if;
  elsif p_action = 'announcement_create' then
    insert into public.announcements (title, content, created_by)
    values (p_payload->>'title', p_payload->>'content', v_user_id);
  elsif p_action = 'announcement_update' then
    update public.announcements set title = p_payload->>'title', content = p_payload->>'content'
    where id = p_payload->>'id';
    if not found then raise exception 'Announcement was not found.'; end if;
  elsif p_action = 'announcement_delete' then
    delete from public.announcements where id = p_payload->>'id';
    if not found then raise exception 'Announcement was not found.'; end if;
  elsif p_action = 'student_note_create' then
    if p_payload ? 'file_url' then
      if length(trim(coalesce(p_payload->>'title', ''))) = 0 then raise exception 'Note title is required.'; end if;
      if p_payload->>'subject' not in ('Foundation Period', 'English', 'Maths', 'Physics') then
        raise exception 'Choose a valid note subject.';
      end if;
      if coalesce(p_payload->>'file_url', '') !~* '^https://' then raise exception 'The uploaded PDF URL is invalid.'; end if;
      if length(coalesce(p_payload->>'file_name', '')) = 0 then raise exception 'PDF file name is required.'; end if;
      insert into public.student_notes (
        owner_id, title, content, subject, description, file_name, file_url, uploaded_by, uploaded_by_name
      )
      values (
        null, trim(p_payload->>'title'), '', p_payload->>'subject',
        coalesce(p_payload->>'description', ''), p_payload->>'file_name',
        p_payload->>'file_url', v_user_id, v_name
      );
    else
      if v_role <> 'student' then raise exception 'Only students can create private notes.'; end if;
      insert into public.student_notes (owner_id, title, content)
      values (v_user_id, p_payload->>'title', coalesce(p_payload->>'content', ''));
    end if;
  elsif p_action = 'student_note_delete' then
    delete from public.student_notes
    where id::text = p_payload->>'id'
      and nullif(file_url, '') is not null
      and (uploaded_by = v_user_id or v_role = 'admin');
    if not found then raise exception 'Student note was not found or you cannot delete it.'; end if;
  elsif p_action = 'diary_create' then
    if length(coalesce(p_payload->>'photo_data', '')) > 6000000 then raise exception 'Photo exceeds the upload size limit.'; end if;
    if coalesce(p_payload->>'photo_data', '') <> ''
       and p_payload->>'photo_data' !~ '^data:image/[a-zA-Z0-9.+-]+;base64,' then
      raise exception 'Attach a supported image file.';
    end if;
    insert into public.diary (owner_id, title, content, entry_date, photo_data, quote)
    values (v_user_id, p_payload->>'title', coalesce(p_payload->>'content', ''),
      coalesce((p_payload->>'entry_date')::date, current_date), nullif(p_payload->>'photo_data', ''), coalesce(p_payload->>'quote', ''));
  elsif p_action = 'diary_delete' then
    delete from public.diary where id = p_payload->>'id' and owner_id = v_user_id;
    if not found then raise exception 'Diary entry was not found.'; end if;
  else
    raise exception 'Unsupported action: %', p_action;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

drop function if exists public.hub_diary_mutate(text, text, jsonb);
create function public.hub_diary_mutate(
  p_token text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text;
  v_role text;
  v_name text;
  v_note public.diary_notes%rowtype;
begin
  select s.id, s.role, s.name into v_user_id, v_role, v_name
  from public.hub_session_user(p_token) s;
  if not found then raise exception 'Session expired. Sign in again.'; end if;

  if p_action = 'create' then
    if length(trim(coalesce(p_payload->>'content', ''))) = 0 then
      raise exception 'Write a note before posting.';
    end if;
    if length(p_payload->>'content') > 4000 then
      raise exception 'Diary notes must be 4000 characters or fewer.';
    end if;
    if length(coalesce(p_payload->>'mood', '')) > 40 then
      raise exception 'Mood must be 40 characters or fewer.';
    end if;
    insert into public.diary_notes (content, mood, user_name, user_id)
    values (
      trim(p_payload->>'content'),
      nullif(trim(p_payload->>'mood'), ''),
      v_name,
      v_user_id
    )
    returning * into v_note;
    return jsonb_build_object('ok', true, 'note', to_jsonb(v_note));
  elsif p_action = 'delete' then
    delete from public.diary_notes
    where id::text = p_payload->>'id'
      and (v_role in ('admin', 'lecturer') or user_id::text = v_user_id::text)
    returning * into v_note;
    if not found then raise exception 'Diary note was not found or you cannot delete it.'; end if;
    return jsonb_build_object('ok', true, 'id', v_note.id);
  else
    raise exception 'Unsupported diary action: %', p_action;
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'hub_sessions', 'lecture_notes', 'assignments', 'assignment_information',
    'quizzes', 'deadlines', 'zoom_meetings', 'announcements', 'student_notes',
    'diary', 'events', 'badges'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end
$$;

revoke all on table
  public.users, public.hub_sessions, public.lecture_notes, public.assignments,
  public.assignment_information, public.quizzes, public.deadlines, public.zoom_meetings,
  public.announcements, public.student_notes, public.diary, public.diary_notes,
  public.events, public.badges
from public, anon, authenticated;
revoke all on function public.hub_session_user(text) from public, anon, authenticated;
revoke all on function public.login_user(text, text) from public;
revoke all on function public.hub_logout(text) from public;
revoke all on function public.hub_get_data(text) from public;
revoke all on function public.hub_download_note(text, text) from public;
revoke all on function public.hub_download_assignment_info_file(text, text) from public;
revoke all on function public.hub_mutate(text, text, jsonb) from public;
revoke all on function public.hub_diary_mutate(text, text, jsonb) from public;
revoke all on function public.hub_diary_author_roles(text[]) from public;
revoke all on function public.assignment_storage_object_is_unreferenced(text) from public;
grant execute on function public.login_user(text, text) to anon, authenticated;
grant execute on function public.hub_logout(text) to anon, authenticated;
grant execute on function public.hub_get_data(text) to anon, authenticated;
grant execute on function public.hub_download_note(text, text) to anon, authenticated;
grant execute on function public.hub_download_assignment_info_file(text, text) to anon, authenticated;
grant execute on function public.hub_mutate(text, text, jsonb) to anon, authenticated;
grant execute on function public.hub_diary_mutate(text, text, jsonb) to anon, authenticated;
grant execute on function public.hub_diary_author_roles(text[]) to anon, authenticated;
grant execute on function public.assignment_storage_object_is_unreferenced(text) to anon, authenticated;
grant select on table public.diary_notes to anon, authenticated;

notify pgrst, 'reload schema';
