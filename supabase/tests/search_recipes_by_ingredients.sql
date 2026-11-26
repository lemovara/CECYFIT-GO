begin;
do $test$
begin
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  execute 'set local role authenticated';
  if not exists (select 1 from public.search_catalog_recipes(array['arroz pollo']) where id='pollo-arroz') then
    raise exception 'Recipe search did not match words in different order';
  end if;
  if not exists (select 1 from public.search_catalog_recipes(array['brócoli pollo']) where id='pollo-verduras') then
    raise exception 'Recipe search did not match an ingredient';
  end if;
  if not exists (select 1 from public.search_catalog_ingredients(array['pollo pechuga']) where id='pollo') then
    raise exception 'Food search did not match words in different order';
  end if;
  if exists (select 1 from public.search_catalog_recipes(array['pollo inexistente'])) then
    raise exception 'Search matched without all words';
  end if;
  begin
    perform public.search_catalog_recipes(array['a']);
    raise exception 'Invalid short term accepted';
  exception when invalid_parameter_value then null; end;
end $test$;
rollback;
