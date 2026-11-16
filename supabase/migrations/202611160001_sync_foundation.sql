-- Fundação opt-in. Não lê nem migra o armazenamento local do navegador.
begin;

create table public.study_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  collection text not null check (collection in ('materials', 'suggestions', 'tasks', 'history')),
  record_id text not null check (record_id ~ '^[A-Za-z0-9_-]{1,120}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2000000),
  revision bigint not null default 1 check (revision > 0),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, collection, record_id),
  check (payload ? 'id' and jsonb_typeof(payload->'id') = 'string' and payload->>'id' = record_id)
);
comment on table public.study_records is 'Registros individuais v2; isolamento por usuário e revisões otimistas. Não contém senhas nem PDFs.';
create index study_records_sync_idx on public.study_records(owner_id, updated_at);
alter table public.study_records enable row level security;
alter table public.study_records force row level security;
revoke all on public.study_records from anon, authenticated;
grant select on public.study_records to authenticated;
create policy own_records_read on public.study_records for select to authenticated
  using ((select auth.uid()) = owner_id);

-- Escrita somente por esta função: proprietário vem da sessão, nunca do cliente.
-- Um conflito NÃO sobrescreve o registro: o cliente deve pedir revisão humana.
create function public.save_study_record(
  p_collection text, p_record_id text, p_payload jsonb,
  p_expected_revision bigint, p_deleted boolean default false
) returns public.study_records
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved public.study_records;
  current_revision bigint;
begin
  if actor is null then raise exception 'authentication_required' using errcode = '28000'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid_revision' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.study_records(owner_id, collection, record_id, payload, deleted)
      values (actor, p_collection, p_record_id, p_payload, p_deleted)
      on conflict do nothing returning * into saved;
    if found then return saved; end if;
    raise exception 'revision_conflict' using errcode = '40001';
  end if;
  select revision into current_revision from public.study_records
    where owner_id = actor and collection = p_collection and record_id = p_record_id for update;
  if not found or current_revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;
  update public.study_records set payload = p_payload, deleted = p_deleted,
    revision = revision + 1, updated_at = clock_timestamp()
    where owner_id = actor and collection = p_collection and record_id = p_record_id
    returning * into saved;
  return saved;
end;
$$;
revoke all on function public.save_study_record(text,text,jsonb,bigint,boolean) from public, anon;
grant execute on function public.save_study_record(text,text,jsonb,bigint,boolean) to authenticated;

-- PDFs não são públicos. Caminho: UID/ID_OPACO.pdf, sem nome pessoal no caminho.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('study-pdfs', 'study-pdfs', false, 10485760, array['application/pdf']);
create policy own_pdf_read on storage.objects for select to authenticated
  using (bucket_id = 'study-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy own_pdf_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'study-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Não concedemos update/delete de arquivos nesta etapa; anexos novos usam novos IDs.
-- Limpeza de versões exige fluxo de recuperação/consentimento próprio.
commit;
