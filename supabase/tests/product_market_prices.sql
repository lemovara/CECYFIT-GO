begin;
do $test$
declare actor uuid; other uuid := gen_random_uuid(); amount numeric; denied boolean;
begin
  select p.patient_user_id into actor from public.patients p where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if actor is null then raise exception 'Se requiere paciente vinculado'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  perform public.save_market_product_price('Walmart',' Sucursal temporal ','off:12345678','g',500,30);
  perform public.save_market_product_price('Walmart','Sucursal temporal','off:12345678','g',750,40);
  select pack_amount into amount from public.market_product_prices where account_id=actor and store='Walmart' and branch='sucursal temporal' and product_id='off:12345678' and unit='g';
  if amount <> 750 then raise exception 'No se actualizó la presentación'; end if;
  denied:=false;
  begin perform public.save_market_product_price('Walmart','Sucursal temporal','off:12345678','kg',1,10);
  exception when check_violation then denied:=true; end;
  if not denied then raise exception 'Se aceptó unidad inválida'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  if exists(select 1 from public.market_product_prices where account_id=actor) then raise exception 'Precio visible a otra cuenta'; end if;
end $test$;
rollback;
