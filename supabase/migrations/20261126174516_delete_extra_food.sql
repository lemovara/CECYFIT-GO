-- Only the linked patient can remove their own confirmed intake records.
grant delete on public.extra_meal_logs to authenticated;
create policy extra_meal_logs_delete_own on public.extra_meal_logs for delete to authenticated
  using (patient_user_id=(select auth.uid()) and exists (
    select 1 from public.patients p join public.profiles v on v.id=p.patient_user_id
    where p.id=extra_meal_logs.patient_id and p.patient_user_id=(select auth.uid())
      and p.status='ACTIVE' and v.role='PACIENTE'
  ));
