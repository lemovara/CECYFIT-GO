begin;
do $test$
declare patient uuid; professional uuid; actor uuid; other uuid := gen_random_uuid(); habit uuid; replacement uuid;
  today date := (now() at time zone 'America/Mexico_City')::date; n integer; denied boolean;
  schedule smallint[] := array[extract(isodow from today)::smallint];
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',professional::text,true); execute 'set local role authenticated';
  insert into public.patient_habits(patient_id,title,weekdays) values(patient,'Hábito anterior',schedule) returning id into habit;
  perform set_config('request.jwt.claim.sub',actor::text,true); perform public.record_habit(habit,today,true);
  denied:=false;
  begin perform public.revise_patient_habit(patient,habit,'Ajeno','','',schedule); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Patient can edit habit'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  denied:=false;
  begin perform public.revise_patient_habit(patient,habit,'Ajeno','','',schedule); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Another account can edit habit'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  denied:=false;
  begin perform public.revise_patient_habit(patient,habit,'','','',schedule); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Invalid edit accepted'; end if;
  select count(*) into n from public.patient_habits where id=habit and active;
  if n<>1 then raise exception 'Invalid edit deactivated original'; end if;
  replacement:=public.revise_patient_habit(patient,habit,'Hábito actualizado','Instrucciones','Meta',schedule);
  select count(*) into n from public.patient_habits where id=habit and not active;
  if n<>1 then raise exception 'Original not deactivated'; end if;
  select count(*) into n from public.patient_habits where id=replacement and active and title='Hábito actualizado';
  if n<>1 then raise exception 'Replacement missing'; end if;
  select count(*) into n from public.habit_logs where habit_id=habit and completed;
  if n<>1 then raise exception 'Prior log not preserved'; end if;
  denied:=false;
  begin perform public.revise_patient_habit(patient,habit,'Duplicado','','',schedule); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Stale revision allowed'; end if;
end $test$;
rollback;
