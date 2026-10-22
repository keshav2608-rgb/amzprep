-- Prep Hub schema: per-user DSA progress and notepads, protected by Row Level Security.
-- Apply in the Supabase dashboard (SQL Editor) or with `supabase db push`.

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DSA progress: one row per (user, problem) that has any state.
-- ---------------------------------------------------------------------------
create table public.problem_progress (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  problem_id integer not null check (problem_id between 1 and 10000),
  status     text check (status in ('in_progress', 'completed')),
  starred    boolean not null default false,
  note       text check (char_length(note) <= 10000),
  confidence smallint check (confidence between 1 and 4),
  solved_at  timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, problem_id),
  -- A solve date exists exactly when the problem is solved (drives the streak)
  constraint solved_at_matches_status check ((status = 'completed') = (solved_at is not null))
);

-- ---------------------------------------------------------------------------
-- Notepads: one per (user, section).
-- ---------------------------------------------------------------------------
create table public.notepads (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  section    text not null check (section in ('dsa', 'leadership', 'sysdesign', 'backend', 'internships')),
  body       text not null default '' check (char_length(body) <= 100000),
  sketch     text check (sketch is null or (char_length(sketch) <= 2000000 and sketch like 'data:image/png;base64,%')),
  links      jsonb not null default '[]'::jsonb
             check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 200 and pg_column_size(links) <= 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, section)
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger problem_progress_touch before update on public.problem_progress
  for each row execute function public.touch_updated_at();
create trigger notepads_touch before update on public.notepads
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Create a profile when a user signs up
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Self-service account deletion (right to erasure). Cascades to all user data.
-- ---------------------------------------------------------------------------
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Least privilege: anon gets nothing; authenticated users only their own rows.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.problem_progress, public.notepads from anon, authenticated;
grant select, update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.problem_progress, public.notepads to authenticated;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

alter table public.profiles         enable row level security;
alter table public.problem_progress enable row level security;
alter table public.notepads         enable row level security;

create policy "own profile: read"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own progress" on public.problem_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own notepads" on public.notepads for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
