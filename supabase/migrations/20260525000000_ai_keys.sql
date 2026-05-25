-- user_ai_keys
-- Armazena as chaves de API de IA server-side para que nunca cheguem ao browser.
-- Apenas a Edge Function ai-generate (service role key) pode LER esta tabela.
-- O browser chama a Edge Function para salvar/deletar — nunca acessa a tabela diretamente.
--
-- Padrão idêntico ao google_tokens (ver 20260521000000_google_tokens.sql).

create table if not exists public.user_ai_keys (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  gemini_key text,
  openai_key text,
  custom_key text,
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.user_ai_keys enable row level security;

-- Nega TODO acesso direto do browser (anon key + JWT de usuário).
-- A Edge Function usa a service role key, que ignora RLS completamente.
-- Isso garante que as chaves de API JAMAIS sejam legíveis pelo browser.
create policy "deny_all_direct_client_access"
  on public.user_ai_keys
  as restrictive
  for all
  using (false);
