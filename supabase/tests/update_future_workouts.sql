begin;
do $test$
declare patient uuid; professional uuid; patient_actor uuid; future_workout uuid; past_workout uuid; affected integer; denied boolean;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,patient_actor
    from public.patients p join public.profiles pr on pr.id=p.professional_id
    where p.status='ACTIVE' and pr.role='PROFESIONAL' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'Se requiere un paciente vinculado'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  execute 'set local role authenticated';
  insert into public.patient_workouts(patient_id,activity_date,title,exercises) values
    (patient,(now() at time zone 'America/Mexico_City')::date+1,'Prueba futura','[{"name":"Sentadilla"}]') returning id into future_workout;
  insert into public.patient_workouts(patient_id,activity_date,title,exercises) values
    (patient,(now() at time zone 'America/Mexico_City')::date,'Prueba de hoy','[{"name":"Sentadilla"}]') returning id into past_workout;
  update public.patient_workouts set title='Actualizada' where id=future_workout;
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'Profesional no pudo editar rutina futura'; end if;
  update public.patient_workouts set title='No permitida' where id=past_workout;
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'Se permitió editar rutina del día'; end if;
  denied:=false;
  begin update public.patient_workouts set activity_date=(now() at time zone 'America/Mexico_City')::date+2 where id=future_workout;
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Se permitió cambiar la fecha'; end if;
  execute 'reset role';
  insert into public.workout_logs(workout_id,patient_user_id,status,exercise_index) values(future_workout,patient_actor,'PAUSED',0);
  execute 'set local role authenticated';
  update public.patient_workouts set title='No permitida' where id=future_workout;
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'Se permitió modificar una rutina con avance'; end if;
  perform set_config('request.jwt.claim.sub',patient_actor::text,true);
  update public.patient_workouts set title='No permitida' where id=future_workout;
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'Paciente pudo editar la rutina'; end if;
end $test$;
rollback;
