begin;
do $test$
declare patient uuid; professional uuid; actor uuid; meal uuid; snapshot jsonb; denied boolean;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'Se requiere paciente vinculado'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  execute 'set local role authenticated';
  meal := public.assign_branded_product(patient,date '2199-01-01',time '00:19','Prueba temporal','Marca','12345678',150,'g',200,10,null,5,null);
  select nutrition_snapshot into snapshot from public.patient_meals where id=meal;
  if (snapshot->>'kcal')::numeric <> 300 or (snapshot->>'protein')::numeric <> 15
    or snapshot->>'carbs' is not null or (snapshot->>'fat')::numeric <> 7.5 or snapshot->>'unit' <> 'g' then
    raise exception 'Los nutrientes o la unidad no se conservaron correctamente';
  end if;
  denied:=false;
  begin perform public.assign_branded_product(patient,date '2199-01-01',time '00:20','Prueba','','12345678',100,'g',-1,null,null,null,null);
  exception when invalid_parameter_value then denied:=true; end;
  if not denied then raise exception 'Se aceptó energía negativa'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  denied:=false;
  begin perform public.assign_branded_product(patient,date '2199-01-01',time '00:21','Prueba','','12345678',100,'g',1,null,null,null,null);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'El paciente pudo asignar la comida'; end if;
end $test$;
rollback;
