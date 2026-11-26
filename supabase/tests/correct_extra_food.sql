begin;
do $test$
declare patient uuid; professional uuid; actor uuid; other uuid:=gen_random_uuid(); item uuid:=gen_random_uuid(); n integer; denied boolean; snap jsonb;
  today date:=(now() at time zone 'America/Mexico_City')::date;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',actor::text,true); execute 'set local role authenticated';
  perform public.record_extra_food(item,patient,today,'Prueba temporal','100 g',100,'{"kind":"product","allergens":["Leche"],"protein":10}'::jsonb);
  n:=public.correct_extra_food(patient,item,0,'Prueba corregida','50 g',50);
  if n<>1 then raise exception 'Revision not incremented'; end if;
  select nutrition_snapshot into snap from public.extra_meal_logs where id=item and patient_user_id=actor;
  if snap is not null then raise exception 'Stale nutrition snapshot retained'; end if;
  denied:=false;
  begin perform public.correct_extra_food(patient,item,0,'Intento obsoleto','20 g',20); exception when serialization_failure then denied:=true; end;
  if not denied then raise exception 'Stale correction accepted'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  denied:=false;
  begin perform public.correct_extra_food(patient,item,1,'Ajeno','10 g',10); exception when serialization_failure then denied:=true; end;
  if not denied then raise exception 'Professional corrected patient intake'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  denied:=false;
  begin perform public.correct_extra_food(patient,item,1,'Ajeno','10 g',10); exception when serialization_failure then denied:=true; end;
  if not denied then raise exception 'Another user corrected intake'; end if;
end $test$;
rollback;
