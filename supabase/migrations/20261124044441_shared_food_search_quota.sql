-- One sliding window across web and Edge Function instances; stores no search terms or user data.
create table nutrition_internal.external_search_quota (
  provider text primary key,
  hits timestamptz[] not null default '{}'
);
alter table nutrition_internal.external_search_quota enable row level security;
revoke all on nutrition_internal.external_search_quota from public, anon, authenticated;

create function nutrition_internal.claim_food_search() returns boolean
language plpgsql security definer set search_path = '' as $$
declare previous timestamptz[]; recent timestamptz[]; instant timestamptz;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='Se requiere sesión'; end if;
  insert into nutrition_internal.external_search_quota(provider) values('open_food_facts') on conflict do nothing;
  select hits into previous from nutrition_internal.external_search_quota where provider='open_food_facts' for update;
  instant := clock_timestamp();
  select coalesce(array_agg(hit order by hit), '{}'::timestamptz[]) into recent
    from unnest(previous) as hit where hit > instant - interval '60 seconds';
  if cardinality(recent) >= 8 then return false; end if;
  update nutrition_internal.external_search_quota set hits=array_append(recent,instant) where provider='open_food_facts';
  return true;
end;
$$;
revoke all on function nutrition_internal.claim_food_search() from public,anon,authenticated;
grant execute on function nutrition_internal.claim_food_search() to authenticated;
create function public.claim_food_search() returns boolean language sql security invoker set search_path = '' as $$
  select nutrition_internal.claim_food_search();
$$;
revoke all on function public.claim_food_search() from public,anon,authenticated;
grant execute on function public.claim_food_search() to authenticated;
