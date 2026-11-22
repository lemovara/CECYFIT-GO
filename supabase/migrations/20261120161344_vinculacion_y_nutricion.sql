create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.patient_invitations (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  token_digest bytea not null unique,
  expires_at timestamptz not null
);

alter table private.patient_invitations enable row level security;
revoke all on private.patient_invitations from public, anon, authenticated;

create function private.create_patient_invitation(target_patient_id uuid)
returns table (token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token uuid := gen_random_uuid();
  expiry timestamptz := clock_timestamp() + interval '15 minutes';
begin
  perform 1 from public.patients p
    join public.profiles pr on pr.id = p.professional_id and pr.role = 'PROFESIONAL'
    where p.id = target_patient_id and p.professional_id = auth.uid()
      and p.status = 'ACTIVE' and p.patient_user_id is null
    for update of p;
  if not found then
    raise exception 'Invitación no disponible';
  end if;

  insert into private.patient_invitations as i (patient_id, token_digest, expires_at)
    values (target_patient_id, sha256(convert_to(new_token::text, 'UTF8')), expiry)
    on conflict (patient_id) do update
      set token_digest = excluded.token_digest, expires_at = excluded.expires_at;

  return query select new_token, expiry;
end;
$$;

create function private.redeem_patient_invitation(invitation_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  account_email text;
  target_id uuid;
  expected_email text;
  digest bytea := sha256(convert_to(invitation_token::text, 'UTF8'));
begin
  select u.email into account_email
    from auth.users u join public.profiles pr on pr.id = u.id and pr.role = 'PACIENTE'
    where u.id = account_id and u.email_confirmed_at is not null;
  if not found then
    raise exception 'Invitación no disponible';
  end if;

  select i.patient_id into target_id
    from private.patient_invitations i where i.token_digest = digest;
  select p.email into expected_email from public.patients p
    where p.id = target_id and p.status = 'ACTIVE' and p.patient_user_id is null
    for update;
  if not found or (nullif(btrim(expected_email), '') is not null
      and lower(btrim(expected_email)) is distinct from lower(btrim(account_email))) then
    raise exception 'Invitación no disponible';
  end if;

  delete from private.patient_invitations i
    where i.patient_id = target_id and i.token_digest = digest and i.expires_at > clock_timestamp();
  if not found then
    raise exception 'Invitación no disponible';
  end if;

  update public.patients set patient_user_id = account_id, updated_at = clock_timestamp()
    where id = target_id;
  return target_id;
exception when unique_violation then
  raise exception 'Invitación no disponible';
end;
$$;

create function public.create_patient_invitation(target_patient_id uuid)
returns table (token uuid, expires_at timestamptz)
language sql
security invoker
set search_path = ''
as $$ select * from private.create_patient_invitation(target_patient_id); $$;

create function public.redeem_patient_invitation(invitation_token uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.redeem_patient_invitation(invitation_token); $$;

revoke all on function private.create_patient_invitation(uuid), private.redeem_patient_invitation(uuid),
  public.create_patient_invitation(uuid), public.redeem_patient_invitation(uuid) from public, anon, authenticated;
grant execute on function private.create_patient_invitation(uuid), private.redeem_patient_invitation(uuid),
  public.create_patient_invitation(uuid), public.redeem_patient_invitation(uuid) to authenticated;

create table public.patient_meals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  meal_date date not null,
  scheduled_time time not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  ingredients text not null default '' check (char_length(ingredients) <= 3000),
  notes text not null default '' check (char_length(notes) <= 3000),
  kcal integer check (kcal between 0 and 10000),
  created_at timestamptz not null default now(),
  unique (patient_id, meal_date, scheduled_time)
);

create table public.meal_logs (
  meal_id uuid not null references public.patient_meals(id) on delete cascade,
  patient_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  status text not null check (status in ('CONSUMED', 'SKIPPED')),
  logged_at timestamptz not null default now(),
  primary key (meal_id, patient_user_id)
);

alter table public.patient_meals enable row level security;
alter table public.meal_logs enable row level security;

revoke all on public.patient_meals, public.meal_logs from public, anon, authenticated;
grant select on public.patient_meals, public.meal_logs to authenticated;
grant insert (patient_id, meal_date, scheduled_time, name, ingredients, notes, kcal)
  on public.patient_meals to authenticated;
grant insert (meal_id, status), update (status) on public.meal_logs to authenticated;

create policy patient_meals_select_access on public.patient_meals for select to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id));

create policy patient_meals_insert_professional on public.patient_meals for insert to authenticated
  with check (exists (
    select 1 from public.patients p join public.profiles pr
      on pr.id = p.professional_id and pr.role = 'PROFESIONAL'
    where p.id = patient_id and p.professional_id = (select auth.uid()) and p.status = 'ACTIVE'
  ));

create policy meal_logs_select_access on public.meal_logs for select to authenticated
  using (exists (
    select 1 from public.patient_meals m join public.patients p on p.id = m.patient_id
    where m.id = meal_id and (p.professional_id = (select auth.uid()) or meal_logs.patient_user_id = (select auth.uid()))
  ));

create policy meal_logs_insert_own on public.meal_logs for insert to authenticated
  with check (
    patient_user_id = (select auth.uid()) and exists (
      select 1 from public.patient_meals m join public.patients p on p.id = m.patient_id
      where m.id = meal_id and p.patient_user_id = (select auth.uid()) and p.status = 'ACTIVE'
        and m.meal_date <= (now() at time zone 'America/Mexico_City')::date
    )
  );

create policy meal_logs_update_own on public.meal_logs for update to authenticated
  using (
    patient_user_id = (select auth.uid()) and exists (
      select 1 from public.patient_meals m join public.patients p on p.id = m.patient_id
      where m.id = meal_id and p.patient_user_id = (select auth.uid()) and p.status = 'ACTIVE'
    )
  )
  with check (
    patient_user_id = (select auth.uid()) and exists (
      select 1 from public.patient_meals m join public.patients p on p.id = m.patient_id
      where m.id = meal_id and p.patient_user_id = (select auth.uid()) and p.status = 'ACTIVE'
        and m.meal_date <= (now() at time zone 'America/Mexico_City')::date
    )
  );

create function private.update_meal_log_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.logged_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function private.update_meal_log_timestamp() from public, anon, authenticated;
create trigger update_meal_log_timestamp before update on public.meal_logs
  for each row execute function private.update_meal_log_timestamp();

create function public.record_meal_status(target_meal_id uuid, meal_status text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.meal_logs (meal_id, status) values (target_meal_id, meal_status)
    on conflict (meal_id, patient_user_id) do update set status = excluded.status;
$$;

revoke all on function public.record_meal_status(uuid, text) from public, anon, authenticated;
grant execute on function public.record_meal_status(uuid, text) to authenticated;
