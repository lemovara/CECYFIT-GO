begin;
do $test$
declare patient uuid; professional uuid; actor uuid; other uuid:=gen_random_uuid(); item uuid:=gen_random_uuid(); n integer;
  today date:=(now() at time zone 'America/Mexico_City')::date;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',actor::text,true); execute 'set local role authenticated';
  perform public.record_extra_meal(item,patient,today,'Prueba temporal','100 g',100);
  perform set_config('request.jwt.claim.sub',other::text,true);
  delete from public.extra_meal_logs where id=item; get diagnostics n=row_count;
  if n<>0 then raise exception 'Another user deleted intake'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  delete from public.extra_meal_logs where id=item; get diagnostics n=row_count;
  if n<>0 then raise exception 'Professional deleted patient intake'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  delete from public.extra_meal_logs where id=item and patient_id=patient and meal_date=today; get diagnostics n=row_count;
  if n<>1 then raise exception 'Patient could not remove own intake'; end if;
end $test$;
rollback;
