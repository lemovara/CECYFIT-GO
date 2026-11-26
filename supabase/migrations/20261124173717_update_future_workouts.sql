-- Future workouts have no patient progress yet: only their owner may edit content.
create function nutrition_internal.workout_has_progress(p_workout_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select not exists (select 1 from public.patient_workouts w join public.patients p on p.id=w.patient_id
    where w.id=p_workout_id and p.professional_id=(select auth.uid()) and p.status='ACTIVE')
    or exists (select 1 from public.workout_logs l where l.workout_id=p_workout_id);
$$;
revoke all on function nutrition_internal.workout_has_progress(uuid) from public,anon,authenticated;
grant execute on function nutrition_internal.workout_has_progress(uuid) to authenticated;
grant update (title, exercises) on public.patient_workouts to authenticated;
create policy workouts_update_future on public.patient_workouts for update to authenticated
  using (activity_date > (now() at time zone 'America/Mexico_City')::date and exists (
    select 1 from public.patients p join public.profiles viewer on viewer.id=p.professional_id
    where p.id=patient_workouts.patient_id and p.professional_id=(select auth.uid())
      and p.status='ACTIVE' and viewer.role='PROFESIONAL'
  ) and not nutrition_internal.workout_has_progress(patient_workouts.id))
  with check (activity_date > (now() at time zone 'America/Mexico_City')::date and exists (
    select 1 from public.patients p join public.profiles viewer on viewer.id=p.professional_id
    where p.id=patient_workouts.patient_id and p.professional_id=(select auth.uid())
      and p.status='ACTIVE' and viewer.role='PROFESIONAL'
  ) and not nutrition_internal.workout_has_progress(patient_workouts.id));
