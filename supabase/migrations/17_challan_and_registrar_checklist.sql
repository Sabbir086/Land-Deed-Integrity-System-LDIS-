-- Additive LDIS enhancement: normalize eligible legacy challan status and persist registrar checklist.
-- Review this migration and apply it to the existing Supabase project; it does not reset data.
begin;

create or replace function ref.ldis_normalize_challan_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- The existing reference-matching/amount/type checks remain in the verification RPC.
  -- This only normalizes the explicitly positive legacy state requested by the application workflow.
  if lower(btrim(coalesce(new.verify_status::text,'')))='valid' then
    new.verify_status := 'verified';
  end if;
  return new;
end $$;
revoke all on function ref.ldis_normalize_challan_status() from public, anon, authenticated;
drop trigger if exists ldis_normalize_challan_status on ref.echallans;
create trigger ldis_normalize_challan_status before insert or update of verify_status on ref.echallans
for each row execute function ref.ldis_normalize_challan_status();

create table if not exists public.registrar_review_checklist (
  application_id uuid not null references public.deed_applications(id) on delete cascade,
  item_id smallint not null check (item_id between 1 and 12),
  decision text not null check (decision in ('correct','incorrect')),
  reason text not null default '',
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  primary key(application_id,item_id),
  check (decision <> 'incorrect' or length(btrim(reason)) >= 5)
);
alter table public.registrar_review_checklist enable row level security;
revoke all on public.registrar_review_checklist from anon, authenticated;

create or replace function public.staff_get_review_checklist(p_app uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_district text; v_upazila text; v_ok boolean; v_decisions jsonb; v_reasons jsonb;
begin
 select role,district,upazila into v_role,v_district,v_upazila from public.profiles where id=auth.uid() and is_approved=true;
 if v_role not in ('sub_registrar','admin') then raise exception 'staff access required' using errcode='42501'; end if;
 select exists(select 1 from public.deed_applications a where a.id=p_app and (v_role='admin' or (a.office_district=v_district and a.office_upazila=v_upazila))) into v_ok;
 if not v_ok then raise exception 'application not found' using errcode='42501'; end if;
 select coalesce(jsonb_object_agg(item_id::text,decision),'{}'::jsonb),coalesce(jsonb_object_agg(item_id::text,reason),'{}'::jsonb)
 into v_decisions,v_reasons from public.registrar_review_checklist where application_id=p_app;
 return jsonb_build_object('decisions',v_decisions,'reasons',v_reasons);
end $$;

create or replace function public.staff_save_review_checklist(p_app uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_district text; v_upazila text; v_ok boolean; item jsonb; v_id smallint; v_decision text; v_reason text; v_count integer:=0;
begin
 select role,district,upazila into v_role,v_district,v_upazila from public.profiles where id=auth.uid() and is_approved=true;
 if v_role not in ('sub_registrar','admin') then raise exception 'staff access required' using errcode='42501'; end if;
 if jsonb_typeof(p_items)<>'array' then raise exception 'items must be an array' using errcode='22023'; end if;
 select exists(select 1 from public.deed_applications a where a.id=p_app and a.status='under_review' and (v_role='admin' or (a.office_district=v_district and a.office_upazila=v_upazila))) into v_ok;
 if not v_ok then raise exception 'application must be under review in your jurisdiction' using errcode='42501'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
   v_id:=(item->>'item_id')::smallint; v_decision:=item->>'decision'; v_reason:=btrim(coalesce(item->>'reason',''));
   if v_id not between 1 and 12 or v_decision not in ('correct','incorrect') then raise exception 'Every checklist item needs a Correct/Incorrect decision' using errcode='22023'; end if;
   if v_decision='incorrect' and length(v_reason)<5 then raise exception 'Incorrect items require a reason of at least 5 characters' using errcode='22023'; end if;
   insert into public.registrar_review_checklist(application_id,item_id,decision,reason,reviewed_by,reviewed_at)
   values(p_app,v_id,v_decision,v_reason,auth.uid(),now())
   on conflict(application_id,item_id) do update set decision=excluded.decision,reason=excluded.reason,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at;
   v_count:=v_count+1;
 end loop;
 insert into public.audit_logs(actor_id,actor_role,action,application_id,details) values(auth.uid(),v_role,'registrar_checklist_saved',p_app,jsonb_build_object('submitted_items',v_count));
 return public.staff_get_review_checklist(p_app);
end $$;

-- Guard final registration at database level, not only in the UI.
create or replace function public.ldis_guard_registration_checklist()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_total integer; v_correct integer;
begin
 select count(*),count(*) filter(where decision='correct') into v_total,v_correct
 from public.registrar_review_checklist where application_id=new.application_id;
 if v_total<>12 or v_correct<>12 then raise exception 'All 12 mandatory Sub-Registrar checklist items must be marked Correct before registration' using errcode='AP001'; end if;
 return new;
end $$;
revoke all on function public.ldis_guard_registration_checklist() from public,anon,authenticated;
drop trigger if exists ldis_guard_registration_checklist on public.registration_register;
create trigger ldis_guard_registration_checklist before insert on public.registration_register
for each row execute function public.ldis_guard_registration_checklist();

revoke all on function public.staff_get_review_checklist(uuid) from public,anon;
revoke all on function public.staff_save_review_checklist(uuid,jsonb) from public,anon;
grant execute on function public.staff_get_review_checklist(uuid) to authenticated;
grant execute on function public.staff_save_review_checklist(uuid,jsonb) to authenticated;
commit;
