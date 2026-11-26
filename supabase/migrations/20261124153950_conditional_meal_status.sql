-- Durable request identifiers allow safe retry after an acknowledgement is lost.
create table nutrition_internal.meal_status_operations (
  patient_user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  meal_id uuid not null references public.patient_meals(id) on delete cascade,
  desired_status text not null check (desired_status in ('CONSUMED','SKIPPED')),
  expected_revision integer not null,
  expected_logged_at timestamptz,
  accepted_logged_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (patient_user_id,request_id)
);
alter table nutrition_internal.meal_status_operations enable row level security;
revoke all on nutrition_internal.meal_status_operations from public,anon,authenticated;

create function nutrition_internal.record_meal_status_conditional(
  p_request_id uuid,p_meal_id uuid,p_status text,p_expected_revision integer,p_expected_logged_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); current_revision integer; current_status text; v_logged_at timestamptz;
  previous nutrition_internal.meal_status_operations%rowtype; inserted_time timestamptz;
begin
  if actor is null or p_request_id is null or p_meal_id is null or p_status is null
    or p_status not in ('CONSUMED','SKIPPED') or p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode='22023', message='Registro inválido';
  end if;
  -- The privileged function validates the active linkage, role and date before accessing records.
  select m.revision into current_revision from public.patient_meals m
    join public.patients p on p.id=m.patient_id
    join public.profiles pr on pr.id=p.patient_user_id and pr.role='PACIENTE'
    where m.id=p_meal_id and p.patient_user_id=actor and p.status='ACTIVE'
      and m.meal_date <= (now() at time zone 'America/Mexico_City')::date
    for share of m,p;
  if not found then raise exception using errcode='42501', message='Comida no disponible'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || p_meal_id::text,0));
  select * into previous from nutrition_internal.meal_status_operations where patient_user_id=actor and request_id=p_request_id;
  if found then
    if previous.meal_id<>p_meal_id or previous.desired_status<>p_status or previous.expected_revision<>p_expected_revision
      or previous.expected_logged_at is distinct from p_expected_logged_at then
      raise exception using errcode='23505', message='Identificador de solicitud ya utilizado';
    end if;
    select status,logged_at into current_status,v_logged_at from public.meal_logs where meal_id=p_meal_id and patient_user_id=actor;
    return jsonb_build_object('result','applied','replayed',true,'status',current_status,'logged_at',v_logged_at,'revision',current_revision);
  end if;
  select status,logged_at into current_status,v_logged_at from public.meal_logs where meal_id=p_meal_id and patient_user_id=actor for update;
  if current_revision<>p_expected_revision then
    return jsonb_build_object('result','conflict','reason','plan_changed','status',current_status,'logged_at',v_logged_at,'revision',current_revision);
  end if;
  if v_logged_at is distinct from p_expected_logged_at then
    return jsonb_build_object('result','conflict','reason','status_changed','status',current_status,'logged_at',v_logged_at,'revision',current_revision);
  end if;
  if v_logged_at is null then
    insert into public.meal_logs(meal_id,patient_user_id,status) values(p_meal_id,actor,p_status)
      on conflict (meal_id,patient_user_id) do nothing returning logged_at into inserted_time;
    if inserted_time is null then
      select status,logged_at into current_status,v_logged_at from public.meal_logs where meal_id=p_meal_id and patient_user_id=actor;
      return jsonb_build_object('result','conflict','reason','status_changed','status',current_status,'logged_at',v_logged_at,'revision',current_revision);
    end if;
  else
    update public.meal_logs set status=p_status where meal_id=p_meal_id and patient_user_id=actor returning logged_at into inserted_time;
  end if;
  insert into nutrition_internal.meal_status_operations(patient_user_id,request_id,meal_id,desired_status,expected_revision,expected_logged_at,accepted_logged_at)
    values(actor,p_request_id,p_meal_id,p_status,p_expected_revision,p_expected_logged_at,inserted_time);
  return jsonb_build_object('result','applied','replayed',false,'status',p_status,'logged_at',inserted_time,'revision',current_revision);
end;
$$;
revoke all on function nutrition_internal.record_meal_status_conditional(uuid,uuid,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function nutrition_internal.record_meal_status_conditional(uuid,uuid,text,integer,timestamptz) to authenticated;
create function public.record_meal_status_conditional(p_request_id uuid,p_meal_id uuid,p_status text,p_expected_revision integer,p_expected_logged_at timestamptz)
returns jsonb language sql security invoker set search_path = '' as $$
  select nutrition_internal.record_meal_status_conditional(p_request_id,p_meal_id,p_status,p_expected_revision,p_expected_logged_at);
$$;
revoke all on function public.record_meal_status_conditional(uuid,uuid,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.record_meal_status_conditional(uuid,uuid,text,integer,timestamptz) to authenticated;
