-- google_tokens table
-- Stores Google OAuth refresh tokens server-side so they are never
-- exposed to the browser (security Fix 1 + Fix 3).
-- Only the google-oauth Edge Function (service role key) may access this table.

create table if not exists public.google_tokens (
  user_id       uuid        not null references auth.users (id) on delete cascade,
  refresh_token text        not null,
  updated_at    timestamptz not null default now(),
  primary key (user_id)
);

-- Enable Row Level Security
alter table public.google_tokens enable row level security;

-- Deny ALL direct client access — this is intentional.
-- The Edge Function uses the service role key, which bypasses RLS entirely.
create policy "deny_all_direct_client_access"
  on public.google_tokens
  as restrictive
  for all
  using (false);
