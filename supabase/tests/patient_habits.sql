begin;
do $test$
declare patient uuid; professional uuid; actor uuid; other uuid := gen_random_uuid(); habit uuid;
  today date := (now() at time zone 'America/Mexico_City')::date; n integer; denied boolean;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',professional::text,true);
  execute 'set local role authenticated';
  insert into public.patient_habits(patient_id,title,weekdays) values(patient,'Hábito temporal',array[extract(isodow from today)::smallint]) returning id into habit;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.record_habit(habit,today,true);
  perform public.record_habit(habit,today,false);
  select count(*) into n from public.habit_logs where habit_id=habit and not completed;
  if n<>1 then raise exception 'Habit update failed'; end if;
  denied:=false;
  begin perform public.record_habit(habit,today+1,true); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Future habit log allowed'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  select count(*) into n from public.patient_habits where id=habit;
  if n<>0 then raise exception 'Unrelated user can read habit'; end if;
  denied:=false;
  begin perform public.record_habit(habit,today,true); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Unrelated user can record habit'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  select count(*) into n from public.habit_logs where habit_id=habit;
  if n<>1 then raise exception 'Professional cannot view habit log'; end if;
  update public.patient_habits set active=false where id=habit;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  denied:=false;
  begin perform public.record_habit(habit,today,true); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Inactive habit accepted'; end if;
end $test$;
rollback;
