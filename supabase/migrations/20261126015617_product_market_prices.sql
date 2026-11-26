create table public.market_product_prices (
  account_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  store text not null check (store in ('Soriana','Walmart','Chedraui','Bodega Aurrera','Sam’s Club')),
  branch text not null check (char_length(btrim(branch)) between 1 and 120 and branch=lower(btrim(branch))),
  product_id text not null check (product_id ~ '^off:[0-9]{4,24}$'),
  unit text not null check (unit in ('g','ml')),
  pack_amount numeric(10,2) not null check (pack_amount between 0.01 and 100000),
  pack_price numeric(10,2) not null check (pack_price between 0.01 and 100000),
  observed_on date not null default ((now() at time zone 'America/Mexico_City')::date),
  primary key (account_id,store,branch,product_id,unit)
);
alter table public.market_product_prices enable row level security;
revoke all on public.market_product_prices from public,anon,authenticated;
grant select on public.market_product_prices to authenticated;
grant insert(store,branch,product_id,unit,pack_amount,pack_price),update(pack_amount,pack_price,observed_on) on public.market_product_prices to authenticated;
create policy product_prices_own on public.market_product_prices for all to authenticated
  using (account_id=(select auth.uid())) with check (account_id=(select auth.uid()));

create function public.save_market_product_price(p_store text,p_branch text,p_product_id text,p_unit text,p_amount numeric,p_price numeric)
returns void language sql security invoker set search_path='' as $$
  insert into public.market_product_prices(store,branch,product_id,unit,pack_amount,pack_price)
    values(p_store,lower(btrim(p_branch)),p_product_id,p_unit,p_amount,p_price)
  on conflict(account_id,store,branch,product_id,unit) do update
    set pack_amount=excluded.pack_amount,pack_price=excluded.pack_price,observed_on=now() at time zone 'America/Mexico_City';
$$;
revoke all on function public.save_market_product_price(text,text,text,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.save_market_product_price(text,text,text,text,numeric,numeric) to authenticated;
