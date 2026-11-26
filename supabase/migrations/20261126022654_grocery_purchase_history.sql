create table public.grocery_purchases (
  id uuid not null,
  account_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  purchased_on date not null check (isfinite(purchased_on) and purchased_on >= date '2000-01-01'),
  store text not null check (store in ('Soriana','Walmart','Chedraui','Bodega Aurrera','Sam’s Club')),
  branch text not null check (char_length(btrim(branch)) between 1 and 120),
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  created_at timestamptz not null default now(),
  primary key (account_id,id)
);
create index grocery_purchases_patient_month_idx on public.grocery_purchases(account_id,patient_id,purchased_on desc,created_at desc);
alter table public.grocery_purchases enable row level security;
revoke all on public.grocery_purchases from public,anon,authenticated;
grant select,delete on public.grocery_purchases to authenticated;
grant insert(id,patient_id,purchased_on,store,branch,amount_cents) on public.grocery_purchases to authenticated;
create policy grocery_purchases_own_read on public.grocery_purchases for select to authenticated
  using (account_id=(select auth.uid()) and exists (
    select 1 from public.patients p where p.id=grocery_purchases.patient_id and p.patient_user_id=(select auth.uid()) and p.status='ACTIVE'
  ));
create policy grocery_purchases_own_insert on public.grocery_purchases for insert to authenticated
  with check (account_id=(select auth.uid()) and purchased_on <= (now() at time zone 'America/Mexico_City')::date and exists (
    select 1 from public.patients p where p.id=grocery_purchases.patient_id and p.patient_user_id=(select auth.uid()) and p.status='ACTIVE'
  ));
create policy grocery_purchases_own_delete on public.grocery_purchases for delete to authenticated
  using (account_id=(select auth.uid()) and exists (
    select 1 from public.patients p where p.id=grocery_purchases.patient_id and p.patient_user_id=(select auth.uid()) and p.status='ACTIVE'
  ));

create function public.record_grocery_purchase(p_request_id uuid,p_patient_id uuid,p_day date,p_store text,p_branch text,p_amount_cents integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare saved uuid;
begin
  if p_request_id is null or p_patient_id is null or p_day is null or not isfinite(p_day)
    or p_day < date '2000-01-01' or p_day > (now() at time zone 'America/Mexico_City')::date
    or p_store is null or p_store not in ('Soriana','Walmart','Chedraui','Bodega Aurrera','Sam’s Club')
    or char_length(btrim(coalesce(p_branch,''))) not between 1 and 120
    or p_amount_cents is null or p_amount_cents not between 1 and 100000000 then
    raise exception using errcode='22023',message='Datos de compra inválidos';
  end if;
  insert into public.grocery_purchases(id,patient_id,purchased_on,store,branch,amount_cents)
    values(p_request_id,p_patient_id,p_day,p_store,btrim(p_branch),p_amount_cents)
    on conflict (account_id,id) do nothing returning id into saved;
  if saved is null then
    select id into saved from public.grocery_purchases where account_id=auth.uid() and id=p_request_id
      and patient_id=p_patient_id and purchased_on=p_day and store=p_store and branch=btrim(p_branch) and amount_cents=p_amount_cents;
    if saved is null then raise exception using errcode='23505',message='Identificador de compra ya utilizado'; end if;
  end if;
  return saved;
end;
$$;
revoke all on function public.record_grocery_purchase(uuid,uuid,date,text,text,integer) from public,anon,authenticated;
grant execute on function public.record_grocery_purchase(uuid,uuid,date,text,text,integer) to authenticated;
