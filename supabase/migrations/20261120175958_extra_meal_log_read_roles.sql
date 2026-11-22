alter policy extra_meal_logs_select_linked on public.extra_meal_logs
  using (exists (
    select 1 from public.patients p join public.profiles viewer on viewer.id = (select auth.uid())
    where p.id = extra_meal_logs.patient_id and (
      (viewer.role = 'PROFESIONAL' and p.professional_id = viewer.id) or (
        viewer.role = 'PACIENTE' and p.patient_user_id = viewer.id and p.status = 'ACTIVE'
        and extra_meal_logs.patient_user_id = viewer.id
      )
    )
  ));
