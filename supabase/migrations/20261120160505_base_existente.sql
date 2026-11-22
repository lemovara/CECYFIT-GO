-- Materializa las tablas y políticas que ya tenía el proyecto alojado.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'PACIENTE' check (role in ('PROFESIONAL', 'PACIENTE')),
  created_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  patient_user_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  birth_date date,
  sex text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patients_professional on public.patients (professional_id);
create index if not exists idx_patients_name on public.patients (full_name);

alter table public.profiles enable row level security;
alter table public.patients enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists patients_select_access on public.patients;
create policy patients_select_access on public.patients for select to authenticated
  using (
    (professional_id = (select auth.uid()) and exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'PROFESIONAL'
    )) or
    (patient_user_id = (select auth.uid()) and status = 'ACTIVE' and exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'PACIENTE'
    ))
  );

drop policy if exists patients_insert_professional on public.patients;
create policy patients_insert_professional on public.patients for insert to authenticated
  with check (
    professional_id = (select auth.uid()) and patient_user_id is null and exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'PROFESIONAL'
    )
  );

drop policy if exists patients_update_professional on public.patients;
create policy patients_update_professional on public.patients for update to authenticated
  using (
    professional_id = (select auth.uid()) and exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'PROFESIONAL'
    )
  )
  with check (
    professional_id = (select auth.uid()) and exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'PROFESIONAL'
    )
  );

revoke all on public.profiles, public.patients from public, anon, authenticated;
grant select on public.profiles, public.patients to authenticated;
grant insert (professional_id, full_name, email, phone, birth_date, sex, status)
  on public.patients to authenticated;
grant update (full_name, email, phone, birth_date, sex, status, updated_at)
  on public.patients to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'PACIENTE')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
