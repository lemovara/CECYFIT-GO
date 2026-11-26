begin;
do $test$
declare actor uuid; n integer; denied boolean;
begin
  select p.patient_user_id into actor from public.patients p where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if actor is null then raise exception 'A linked patient is needed'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true); execute 'set local role authenticated';
  select count(*) into n from public.search_catalog_ingredients(array['platano']) where name ilike '%plátano%';
  if n=0 then raise exception 'Accent-insensitive search failed'; end if;
  select count(*) into n from public.search_catalog_ingredients(array['bananas']) where name ilike '%plátano%';
  if n=0 then raise exception 'Original name search failed'; end if;
  select count(*) into n from public.search_catalog_recipes(array['brocoli']) where title ilike '%brócoli%' and jsonb_array_length(ingredients)>0;
  if n=0 then raise exception 'Recipe search or ingredient details failed'; end if;
  select count(*) into n from public.search_catalog_ingredients(array['enchilada']) where id like 'usda-fndds-%';
  if n=0 then raise exception 'Imported prepared foods not found'; end if;
  select count(*) into n from public.search_catalog_ingredients(array['%_']);
  if n<>0 then raise exception 'Wildcard search was not treated literally'; end if;
  denied:=false;
  begin perform * from public.search_catalog_recipes(array['']); exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Invalid term allowed'; end if;
  execute 'reset role'; execute 'set local role anon';
  denied:=false;
  begin perform * from public.search_catalog_ingredients(array['avena']); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous search allowed'; end if;
end $test$;
rollback;
