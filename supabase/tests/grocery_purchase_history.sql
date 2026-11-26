begin;
do $test$
declare patient uuid; actor uuid; other uuid := gen_random_uuid(); request uuid := gen_random_uuid(); denied boolean; n integer;
begin
  select p.id,p.patient_user_id into patient,actor from public.patients p
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'A linked patient is needed'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  perform public.record_grocery_purchase(request,patient,date '2020-01-01','Soriana','Prueba',12345);
  perform public.record_grocery_purchase(request,patient,date '2020-01-01','Soriana','Prueba',12345);
  select count(*) into n from public.grocery_purchases where id=request;
  if n<>1 then raise exception 'Retry created duplicate'; end if;
  denied:=false;
  begin perform public.record_grocery_purchase(request,patient,date '2020-01-01','Soriana','Prueba',12346);
  exception when unique_violation then denied:=true; end;
  if not denied then raise exception 'Conflicting retry was accepted'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  select count(*) into n from public.grocery_purchases where id=request;
  if n<>0 then raise exception 'Another account can read the purchase'; end if;
  denied:=false;
  begin perform public.record_grocery_purchase(gen_random_uuid(),patient,date '2020-01-01','Soriana','Prueba',12345);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Another account can create a purchase'; end if;
  delete from public.grocery_purchases where id=request;
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Another account deleted the purchase'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  delete from public.grocery_purchases where id=request;
  get diagnostics n = row_count;
  if n<>1 then raise exception 'Owner could not delete the purchase'; end if;
end $test$;
rollback;
