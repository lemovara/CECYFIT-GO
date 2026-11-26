begin;
do $test$
declare patient uuid; professional uuid; actor uuid; other uuid:=gen_random_uuid(); first_id uuid; second_id uuid; n integer; chosen numeric; denied boolean;
  today date:=(now() at time zone 'America/Mexico_City')::date;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',professional::text,true); execute 'set local role authenticated';
  insert into public.patient_nutrition_goals(patient_id,effective_on,kcal,protein) values(patient,today,1800,100) returning id into first_id;
  insert into public.patient_nutrition_goals(patient_id,effective_on,kcal) values(patient,today+1,2000) returning id into second_id;
  select kcal into chosen from public.patient_nutrition_goals where id in (first_id,second_id) and effective_on<=today order by effective_on desc,created_at desc,id desc limit 1;
  if chosen<>1800 then raise exception 'Future goal used too early'; end if;
  denied:=false;
  begin insert into public.patient_nutrition_goals(patient_id,effective_on) values(patient,today); exception when check_violation then denied:=true; end;
  if not denied then raise exception 'Empty goal accepted'; end if;
  denied:=false;
  begin insert into public.patient_nutrition_goals(patient_id,effective_on,kcal) values(patient,today-1,1800); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Backdated goal accepted'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select count(*) into n from public.patient_nutrition_goals where id in (first_id,second_id);
  if n<>2 then raise exception 'Patient cannot read goals'; end if;
  denied:=false;
  begin insert into public.patient_nutrition_goals(patient_id,effective_on,kcal) values(patient,today,900); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Patient could change goals'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  select count(*) into n from public.patient_nutrition_goals where id in (first_id,second_id);
  if n<>0 then raise exception 'Unrelated user read goals'; end if;
end $test$;
rollback;
