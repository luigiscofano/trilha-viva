-- Execute SOMENTE em projeto de teste descartável com a migração aplicada.
-- Tudo é revertido. Isto NÃO cria duas contas capazes de fazer login.
begin;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select public.save_study_record('materials','fixture','{"id":"fixture","title":"Material fictício"}',0,false);
do $$ begin
  if (select count(*) from public.study_records) <> 1 then raise exception 'A não vê seu registro'; end if;
  begin
    perform public.save_study_record('materials','null-id','{"id":null}',0,false);
    raise exception 'ID nulo aceito';
  exception when check_violation then null; end;
  begin
    perform public.save_study_record('materials','fixture','{"id":"fixture"}',0,false);
    raise exception 'Revisão duplicada aceita';
  exception when serialization_failure then null; end;
end $$;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$ begin
  if exists(select 1 from public.study_records) then raise exception 'B vê dados de A'; end if;
  begin
    perform public.save_study_record('materials','fixture','{"id":"fixture"}',1,false);
    raise exception 'B alterou registro de A';
  exception when serialization_failure then null; end;
end $$;
select public.save_study_record('materials','fixture','{"id":"fixture","title":"Outro dono"}',0,false);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select public.save_study_record('materials','fixture','{"id":"fixture","title":"Revisão A"}',1,false);
do $$ begin
  if (select revision from public.study_records where record_id='fixture') <> 2 then raise exception 'Revisão incorreta'; end if;
  begin
    perform public.save_study_record('materials','fixture','{"id":"fixture"}',1,false);
    raise exception 'Escrita antiga aceita';
  exception when serialization_failure then null; end;
end $$;
reset role;
rollback;
