begin;
do $test$
declare patient uuid; professional uuid; actor uuid; other uuid := gen_random_uuid(); request uuid := gen_random_uuid(); reply uuid := gen_random_uuid(); denied boolean; n integer;
begin
  select p.id,p.professional_id,p.patient_user_id into patient,professional,actor from public.patients p
    join public.profiles pr on pr.id=p.professional_id and pr.role='PROFESIONAL'
    where p.status='ACTIVE' and p.patient_user_id is not null limit 1;
  if patient is null then raise exception 'Se requiere paciente vinculado'; end if;
  insert into auth.users(id) values(other);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  perform public.send_patient_message(request,patient,'Mensaje de prueba');
  perform public.send_patient_message(request,patient,'Mensaje de prueba');
  select count(*) into n from public.patient_messages where id=request;
  if n<>1 then raise exception 'El reintento duplicó el mensaje'; end if;
  denied:=false;
  begin perform public.send_patient_message(request,patient,'Mensaje diferente'); exception when unique_violation then denied:=true; end;
  if not denied then raise exception 'Se aceptó el mismo identificador con otro mensaje'; end if;
  perform set_config('request.jwt.claim.sub',professional::text,true);
  if not exists(select 1 from public.patient_messages where id=request) then raise exception 'El profesional no pudo leer'; end if;
  perform public.send_patient_message(reply,patient,'Respuesta temporal');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  if not exists(select 1 from public.patient_messages where id=reply) then raise exception 'El paciente no pudo leer'; end if;
  perform set_config('request.jwt.claim.sub',other::text,true);
  if exists(select 1 from public.patient_messages where id=request) then raise exception 'Mensaje visible a otra cuenta'; end if;
  denied:=false;
  begin perform public.send_patient_message(gen_random_uuid(),patient,'No autorizado'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Otro usuario pudo enviar'; end if;
end $test$;
rollback;
