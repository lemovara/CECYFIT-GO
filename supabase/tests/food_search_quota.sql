begin;
do $test$
declare actor uuid; i integer; allowed boolean;
begin
  select id into actor from public.profiles limit 1;
  if actor is null then raise exception 'A test account is needed'; end if;
  delete from nutrition_internal.external_search_quota where provider='open_food_facts';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  for i in 1..8 loop
    allowed := public.claim_food_search();
    if not allowed then raise exception 'Request denied too early'; end if;
  end loop;
  if public.claim_food_search() then raise exception 'Quota not enforced'; end if;
end $test$;
rollback;
