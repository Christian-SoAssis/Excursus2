-- ============================================================
-- 1. delete_user() — RPC para que o usuário exclua a própria conta
-- ============================================================
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove tokens do Google Calendar antes de excluir o usuário
  delete from public.google_tokens where user_id = auth.uid();
  -- Remove o registro principal (cascade apaga tudo ligado ao usuário)
  delete from auth.users where id = auth.uid();
end;
$$;

-- Apenas usuários autenticados podem chamar esta função
revoke execute on function public.delete_user() from public, anon;
grant  execute on function public.delete_user() to authenticated;


-- ============================================================
-- 2. Storage bucket "avatars" — fotos de perfil dos usuários
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Usuários autenticados podem fazer upload apenas na própria pasta
create policy "Usuários fazem upload do próprio avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Avatares são acessíveis publicamente (URLs públicas)
create policy "Avatares são públicos"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Usuários podem substituir o próprio avatar
create policy "Usuários atualizam o próprio avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuários podem apagar o próprio avatar (e.g., ao excluir conta)
create policy "Usuários apagam o próprio avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
