-- 10_stage3_registrar_admin.sql
-- ADDITIVE ONLY. Never modifies ref.* data or reference-table RLS.
-- Apply only after migrations 06, 07, 08, 09 have been reviewed and successfully applied.
create sequence if not exists app.registration_ref_seq start 1;
revoke all on sequence app.registration_ref_seq from public, anon, authenticated;

create table if not exists public.registration_register (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.deed_applications(id) on delete restrict,
  registration_ref text not null unique,
  registered_by uuid not null references auth.users(id) on delete restrict,
  registered_at timestamptz not null default now(),
  mode text not null default 'DEMO' check (mode in ('DEMO')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.registration_register enable row level security;
revoke all on public.registration_register from anon, authenticated;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null,
  action text not null,
  application_id uuid references public.deed_applications(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;

-- Enable only the previously documented Stage 3 transitions. No new status vocabulary.
update public.application_status_rules set active=true
where stage=3 and actor_role='sub_registrar'
  and (from_status,to_status) in (
    ('submitted','under_review'),('discrepancy_review','under_review'),
    ('submitted','correction_requested'),('under_review','correction_requested'),
    ('discrepancy_review','correction_requested'),('under_review','registered'),
    ('under_review','rejected')
  );


create or replace function app.reject_immutable_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'records are append-only' using errcode='42501';
end $$;
revoke all on function app.reject_immutable_mutation() from public, anon, authenticated;
drop trigger if exists audit_logs_no_mutation on public.audit_logs;
create trigger audit_logs_no_mutation before update or delete on public.audit_logs
for each row execute function app.reject_immutable_mutation();
drop trigger if exists registration_register_no_mutation on public.registration_register;
create trigger registration_register_no_mutation before update or delete on public.registration_register
for each row execute function app.reject_immutable_mutation();

-- Read-only staff workspace. Role and jurisdiction are loaded from profiles, never from request JSON.
create or replace function public.staff_queue(p_status text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_district text; v_upazila text; v_rows jsonb;
begin
  select role,district,upazila into v_role,v_district,v_upazila
  from public.profiles where id = auth.uid();
  if v_role not in ('sub_registrar','admin') then raise exception 'staff access required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.submitted_at nulls last, q.created_at), '[]'::jsonb) into v_rows
  from (
    select a.id,a.application_no,a.status,a.created_at,a.submitted_at,a.updated_at,a.district,a.upazila,a.mouza,a.khatian_no,a.sale_price,
           a.biometric_status,p.full_name as applicant_name,p.email as applicant_email
    from public.deed_applications a
    join public.profiles p on p.id=a.applicant_id
    where a.status not in ('draft','withdrawn')
      and (v_role='admin' or (a.office_district=v_district and a.office_upazila=v_upazila))
      and (p_status is null or a.status=p_status)
  ) q;
  return jsonb_build_object('ok',true,'role',v_role,'district',v_district,'upazila',v_upazila,'applications',v_rows);
end $$;

create or replace function public.staff_application_detail(p_app uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_district text; v_upazila text; a public.deed_applications%rowtype;
begin
  select role,district,upazila into v_role,v_district,v_upazila from public.profiles where id=auth.uid();
  if v_role not in ('sub_registrar','admin') then raise exception 'staff access required' using errcode='42501'; end if;
  select * into a from public.deed_applications x where x.id=p_app
    and (v_role='admin' or (x.office_district=v_district and x.office_upazila=v_upazila));
  if not found or a.status in ('draft','withdrawn') then raise exception 'application not found' using errcode='42501'; end if;
  insert into public.audit_logs(actor_id,actor_role,action,application_id,details)
    values(auth.uid(),v_role,'application_review_opened',p_app,'{}'::jsonb);
  return jsonb_build_object(
    'application',to_jsonb(a),
    'applicant',(select jsonb_build_object('full_name',p.full_name,'email',p.email) from public.profiles p where p.id=a.applicant_id),
    'parties',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.application_parties x where x.application_id=p_app),
    'ownership',(select to_jsonb(x) from public.application_ownership x where x.application_id=p_app),
    'plots',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.application_plots x where x.application_id=p_app),
    'fees',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.application_fee_items x where x.application_id=p_app),
    'challans',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.application_challans x where x.application_id=p_app),
    'documents',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.application_documents x where x.application_id=p_app),
    'appointments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.appt_date desc),'[]'::jsonb) from public.application_appointments x where x.application_id=p_app),
    'corrections',(select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_at desc),'[]'::jsonb) from public.application_corrections x where x.application_id=p_app),
    'history',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) from public.application_status_history x where x.application_id=p_app)
  );
end $$;

create or replace function public.staff_decide_application(
 p_app uuid, p_decision text, p_note text default '', p_steps smallint[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_district text; v_upazila text; a public.deed_applications%rowtype; v_to text;
begin
  select role,district,upazila into v_role,v_district,v_upazila from public.profiles where id=auth.uid();
  if v_role not in ('sub_registrar','admin') then raise exception 'staff access required' using errcode='42501'; end if;
  select * into a from public.deed_applications x where x.id=p_app
    and (v_role='admin' or (x.office_district=v_district and x.office_upazila=v_upazila)) for update;
  if not found then raise exception 'application not found' using errcode='42501'; end if;
  if a.status not in ('submitted','under_review','discrepancy_review','correction_requested') then
    raise exception 'application is not in a reviewable state' using errcode='AP001';
  end if;
  if p_decision not in ('start_review','request_correction','approve','reject','confirm_appointment','mark_biometric_completed','mark_biometric_failed') then
    raise exception 'unsupported decision' using errcode='22023';
  end if;
  if p_decision='start_review' then v_to='under_review';
  elsif p_decision='request_correction' then v_to='correction_requested';
  elsif p_decision='reject' then v_to='rejected';
  else v_to=a.status; end if;

  if p_decision='request_correction' and length(btrim(coalesce(p_note,'')))<5 then
    raise exception 'Correction request must explain what needs fixing.' using errcode='22023';
  end if;
  if p_decision in ('approve','confirm_appointment','mark_biometric_completed','mark_biometric_failed') and a.status not in ('under_review','submitted','discrepancy_review') then
    raise exception 'application must be under review' using errcode='AP001';
  end if;
  if p_decision='request_correction' then
    insert into public.application_corrections(application_id,requested_by,message,steps)
      values(p_app,auth.uid(),btrim(p_note),coalesce(p_steps,'{}'));
  end if;
  if p_decision='confirm_appointment' then
    update public.application_appointments set status='confirmed',updated_at=now()
      where application_id=p_app and status in ('booked','rescheduled');
    if not found then raise exception 'no bookable appointment found' using errcode='AP001'; end if;
  elsif p_decision='mark_biometric_completed' then
    if not exists(select 1 from public.application_appointments where application_id=p_app and status in ('confirmed','completed')) then
      raise exception 'confirm an appointment before recording biometric status' using errcode='AP001';
    end if;
    update public.deed_applications set biometric_status='completed' where id=p_app;
    update public.application_appointments set status='completed',updated_at=now() where application_id=p_app and status='confirmed';
  elsif p_decision='mark_biometric_failed' then
    update public.deed_applications set biometric_status='failed' where id=p_app;
  elsif p_decision='approve' then
    if jsonb_array_length(coalesce(a.blockers,'[]'::jsonb))>0 then raise exception 'application has unresolved system blockers' using errcode='AP001'; end if;
    if a.biometric_status <> 'completed' then raise exception 'record biometric appointment outcome before approval' using errcode='AP001'; end if;
    if exists(select 1 from public.application_challans c where c.application_id=p_app
      and not exists(select 1 from ref.echallans e where ref.bn2en(e.challan_no)=ref.bn2en(c.challan_no)
        and e.amount=c.amount and e.fee_type=c.challan_type and e.verify_status='verified')) then
      raise exception 'one or more challans could not be verified against reference records' using errcode='AP001';
    end if;
  end if;
  if v_to<>a.status then
    update public.deed_applications set status=v_to,updated_at=now() where id=p_app;
    insert into public.application_status_history(application_id,from_status,to_status,actor_id,actor_role,note)
      values(p_app,a.status,v_to,auth.uid(),v_role,coalesce(nullif(btrim(p_note),''),p_decision));
  end if;
  insert into public.audit_logs(actor_id,actor_role,action,application_id,details)
    values(auth.uid(),v_role,'registrar_decision',p_app,jsonb_build_object('decision',p_decision,'note',left(coalesce(p_note,''),1000),'from_status',a.status,'to_status',v_to));
  insert into public.user_notifications(user_id,application_id,kind,title_bn,title_en)
    values(a.applicant_id,p_app,'staff_update','আবেদনের অবস্থা হালনাগাদ','Application updated');
  return jsonb_build_object('ok',true,'status',v_to,'decision',p_decision);
end $$;

create or replace function public.staff_finalize_registration(p_app uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_district text; v_upazila text; a public.deed_applications%rowtype; v_ref text; v_snapshot jsonb;
begin
  select role,district,upazila into v_role,v_district,v_upazila from public.profiles where id=auth.uid();
  if v_role not in ('sub_registrar','admin') then raise exception 'staff access required' using errcode='42501'; end if;
  select * into a from public.deed_applications x where x.id=p_app
    and (v_role='admin' or (x.office_district=v_district and x.office_upazila=v_upazila)) for update;
  if not found then raise exception 'application not found' using errcode='42501'; end if;
  if a.status <> 'under_review' then raise exception 'application must be under review before finalization' using errcode='AP001'; end if;
  if a.biometric_status <> 'completed' then raise exception 'biometric appointment status is not recorded as completed' using errcode='AP001'; end if;
  if jsonb_array_length(coalesce(a.blockers,'[]'::jsonb))>0 then raise exception 'application has unresolved blockers' using errcode='AP001'; end if;
  if exists(select 1 from public.application_challans c where c.application_id=p_app
    and not exists(select 1 from ref.echallans e where ref.bn2en(e.challan_no)=ref.bn2en(c.challan_no)
      and e.amount=c.amount and e.fee_type=c.challan_type and e.verify_status='verified'
      and (e.used_in_application_no is null or e.used_in_application_no=a.application_no))) then
    raise exception 'challan verification precondition failed' using errcode='AP001';
  end if;
  if not exists(select 1 from public.audit_logs l where l.application_id=p_app
    and l.action='registrar_decision' and l.details->>'decision'='approve') then
    raise exception 'registrar approval decision must be recorded before finalization' using errcode='AP001';
  end if;
  if exists(select 1 from public.registration_register where application_id=p_app) then
    raise exception 'application already has a registration record' using errcode='AP001';
  end if;
  v_ref := 'DEMO-' || to_char(now() at time zone 'Asia/Dhaka','YYYY') || '-' || lpad(nextval('app.registration_ref_seq')::text,8,'0');
  v_snapshot := jsonb_build_object('application_no',a.application_no,'district',a.district,'upazila',a.upazila,
    'mouza',a.mouza,'khatian_no',a.khatian_no,'sale_price',a.sale_price,'flags',a.flags,
    'parties',(select coalesce(jsonb_agg(jsonb_build_object('role',role,'name_bn',name_bn,'nid_masked',nid_masked)),'[]'::jsonb) from public.application_parties where application_id=p_app),
    'plots',(select coalesce(jsonb_agg(jsonb_build_object('dag_no',dag_no,'area_sold',area_sold)),'[]'::jsonb) from public.application_plots where application_id=p_app));
  insert into public.registration_register(application_id,registration_ref,registered_by,mode,snapshot)
    values(p_app,v_ref,auth.uid(),'DEMO',v_snapshot);
  update public.deed_applications set status='registered',updated_at=now() where id=p_app;
  insert into public.application_status_history(application_id,from_status,to_status,actor_id,actor_role,note)
    values(p_app,'under_review','registered',auth.uid(),v_role,'DEMO registration finalized; not official government registration');
  insert into public.audit_logs(actor_id,actor_role,action,application_id,details)
    values(auth.uid(),v_role,'demo_registration_finalized',p_app,jsonb_build_object('registration_ref',v_ref,'mode','DEMO'));
  return jsonb_build_object('ok',true,'mode','DEMO','registration_ref',v_ref,'registered_at',now(),
    'notice','DEMO ONLY — not an official government registration or legally valid deed.');
end $$;

create or replace function public.admin_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_result jsonb;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role <> 'admin' then raise exception 'admin access required' using errcode='42501'; end if;
 select jsonb_build_object(
   'status_counts',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from public.deed_applications group by status) s),
   'registrars',(select coalesce(jsonb_agg(jsonb_build_object('full_name',full_name,'email',email,'district',district,'upazila',upazila)),'[]'::jsonb) from public.profiles where role='sub_registrar'),
   'users_total',(select count(*) from public.profiles where role='user'),
   'registrations_total',(select count(*) from public.registration_register),
   'recent_audit',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]'::jsonb) from (select id,actor_role,action,application_id,details,created_at from public.audit_logs order by created_at desc limit 50) x)
 ) into v_result;
 return v_result;
end $$;

revoke all on function public.staff_queue(text) from public, anon;
revoke all on function public.staff_application_detail(uuid) from public, anon;
revoke all on function public.staff_decide_application(uuid,text,text,smallint[]) from public, anon;
revoke all on function public.staff_finalize_registration(uuid) from public, anon;
revoke all on function public.admin_summary() from public, anon;
grant execute on function public.staff_queue(text) to authenticated;
grant execute on function public.staff_application_detail(uuid) to authenticated;
grant execute on function public.staff_decide_application(uuid,text,text,smallint[]) to authenticated;
grant execute on function public.staff_finalize_registration(uuid) to authenticated;
grant execute on function public.admin_summary() to authenticated;
