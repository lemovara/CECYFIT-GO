-- Append-only goals preserve what was effective on previous dates.
create table public.patient_nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  effective_on date not null check (isfinite(effective_on)),
  kcal numeric check (kcal between 0 and 10000),
  protein numeric check (protein between 0 and 2000),
  carbs numeric check (carbs between 0 and 2000),
  fat numeric check (fat between 0 and 2000),
  fiber numeric check (fiber between 0 and 2000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(kcal,protein,carbs,fat,fiber)>0)
);
create index patient_nutrition_goals_date_idx on public.patient_nutrition_goals(patient_id,effective_on desc,created_at desc,id desc);
alter table public.patient_nutrition_goals enable row level security;
revoke all on public.patient_nutrition_goals from public,anon,authenticated;
grant select on public.patient_nutrition_goals to authenticated;
grant insert(patient_id,effective_on,kcal,protein,carbs,fat,fiber) on public.patient_nutrition_goals to authenticated;
create policy nutrition_goals_read on public.patient_nutrition_goals for select to authenticated
  using (exists (select 1 from public.patients p where p.id=patient_nutrition_goals.patient_id));
create policy nutrition_goals_create on public.patient_nutrition_goals for insert to authenticated
  with check (effective_on >= (now() at time zone 'America/Mexico_City')::date and exists (
    select 1 from public.patients p join public.profiles v on v.id=p.professional_id
    where p.id=patient_nutrition_goals.patient_id and p.professional_id=(select auth.uid())
      and p.status='ACTIVE' and v.role='PROFESIONAL'
  ));
