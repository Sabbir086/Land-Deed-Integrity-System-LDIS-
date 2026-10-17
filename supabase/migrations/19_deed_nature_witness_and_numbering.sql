-- LDIS migration 19: deed nature first, normalized witnesses, and simulated deed numbering.
-- Additive migration. This does not delete reference records, user accounts, or roles.
-- Apply only after existing migrations 07-18 have been reviewed and applied.

begin;

alter table public.deed_applications
  add column if not exists deed_nature text,
  add column if not exists deed_date date;

create table if not exists public.deed_nature_options (
  code text primary key,
  label_bn text not null,
  active boolean not null default true,
  sort_order smallint not null default 0
);
insert into public.deed_nature_options(code,label_bn,sort_order) values
 ('saf_kabala','সাফ-কবলা দলিল',1),
 ('heba_declaration','হেবা ঘোষণাপত্র / হেবা দলিল',2),
 ('gift_deed','দানপত্র দলিল',3),
 ('partition_deed','বণ্টননামা দলিল',4),
 ('exchange_deed','বিনিময় দলিল',5),
 ('mortgage_deed','বন্ধক দলিল',6),
 ('sale_agreement','বায়নাপত্র / বিক্রয় চুক্তি',7),
 ('release_deed','দাবি/স্বত্ব ত্যাগ দলিল',8),
 ('will_deed','অছিয়তনামা',9),
 ('other','অন্যান্য',10)
on conflict(code) do update set label_bn=excluded.label_bn,active=true,sort_order=excluded.sort_order;
alter table public.deed_nature_options enable row level security;
revoke all on public.deed_nature_options from public,anon,authenticated;

create table if not exists public.application_witnesses (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  serial smallint not null check(serial between 1 and 2),
  name text not null check(length(btrim(name)) between 2 and 160),
  father_name text check(father_name is null or length(btrim(father_name)) <= 160),
  created_at timestamptz not null default now(),
  unique(application_id,serial)
);
create index if not exists application_witnesses_application_idx on public.application_witnesses(application_id,serial);
alter table public.application_witnesses enable row level security;
revoke all on public.application_witnesses from public,anon,authenticated;

-- Annual counter creates values such as 1/2026, 2/2026. These are simulated numbers only.
create table if not exists public.demo_deed_number_counters (
  deed_year integer primary key check(deed_year between 2000 and 2200),
  last_number bigint not null check(last_number >= 0)
);
revoke all on public.demo_deed_number_counters from public,anon,authenticated;

create or replace function app.next_demo_deed_no(p_year integer)
returns text language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  insert into public.demo_deed_number_counters(deed_year,last_number)
    values(p_year,1)
  on conflict(deed_year) do update
    set last_number=public.demo_deed_number_counters.last_number+1
  returning last_number into n;
  return n::text || '/' || p_year::text;
end $$;
revoke all on function app.next_demo_deed_no(integer) from public,anon,authenticated;

alter table public.registered_deeds add column if not exists demo_deed_no text;
alter table public.registered_deeds add column if not exists deed_date date;
create unique index if not exists registered_deeds_demo_deed_no_uidx
  on public.registered_deeds(demo_deed_no) where demo_deed_no is not null;

-- Existing archive rows were append-only. This migration assigns historical simulated numbers once,
-- then reinstates the immutable trigger before commit.
drop trigger if exists registered_deeds_no_mutation on public.registered_deeds;
with numbered as (
  select id, row_number() over(partition by extract(year from registered_at at time zone 'Asia/Dhaka')::integer order by registered_at,id) as seq,
         extract(year from registered_at at time zone 'Asia/Dhaka')::integer as yr
  from public.registered_deeds
  where demo_deed_no is null
), yearly_max as (
  select yr, max(seq) as max_seq from numbered group by yr
)
update public.registered_deeds d
set demo_deed_no=n.seq::text || '/' || n.yr::text,
    deed_date=(d.registered_at at time zone 'Asia/Dhaka')::date,
    deed_snapshot=d.deed_snapshot || jsonb_build_object('demo_deed_no',n.seq::text || '/' || n.yr::text,'deed_date',(d.registered_at at time zone 'Asia/Dhaka')::date)
from numbered n where d.id=n.id;

insert into public.demo_deed_number_counters(deed_year,last_number)
select extract(year from registered_at at time zone 'Asia/Dhaka')::integer,max(split_part(demo_deed_no,'/',1)::bigint)
from public.registered_deeds where demo_deed_no is not null
 group by extract(year from registered_at at time zone 'Asia/Dhaka')::integer
on conflict(deed_year) do update set last_number=greatest(public.demo_deed_number_counters.last_number,excluded.last_number);

create or replace function app.archive_registered_deed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_year integer; v_demo_no text; v_deed_date date;
begin
  v_year := extract(year from new.registered_at at time zone 'Asia/Dhaka')::integer;
  v_demo_no := app.next_demo_deed_no(v_year);
  v_deed_date := coalesce(nullif(new.snapshot->>'deed_date','')::date, (new.registered_at at time zone 'Asia/Dhaka')::date);
  insert into public.registered_deeds (
    application_id,registration_record_id,registration_ref,registered_by,registered_at,
    registration_mode,deed_snapshot,demo_deed_no,deed_date
  ) values (
    new.application_id,new.id,new.registration_ref,new.registered_by,new.registered_at,
    new.mode,new.snapshot || jsonb_build_object('demo_deed_no',v_demo_no,'deed_date',v_deed_date),v_demo_no,v_deed_date
  ) on conflict(application_id) do nothing;
  return new;
end $$;
revoke all on function app.archive_registered_deed() from public,anon,authenticated;
drop trigger if exists registered_deeds_no_mutation on public.registered_deeds;
create trigger registered_deeds_no_mutation before update or delete on public.registered_deeds
for each row execute function app.reject_immutable_mutation();

create or replace function public.app_set_deed_nature(p_app uuid,p_deed_nature text,p_deed_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype;
begin
  a := app.load_editable(p_app);
  if not exists(select 1 from public.deed_nature_options o where o.code=p_deed_nature and o.active=true) then
    raise exception 'Select a valid deed nature.' using errcode='22023';
  end if;
  if p_deed_date is null or p_deed_date > (now() at time zone 'Asia/Dhaka')::date then
    raise exception 'Enter a valid deed date that is not in the future.' using errcode='22023';
  end if;
  update public.deed_applications set deed_nature=p_deed_nature,deed_date=p_deed_date,updated_at=now() where id=p_app;
  return jsonb_build_object('ok',true,'application',app.view(p_app));
end $$;
revoke all on function public.app_set_deed_nature(uuid,text,date) from public,anon;
grant execute on function public.app_set_deed_nature(uuid,text,date) to authenticated;

create or replace function public.app_set_witnesses(p_app uuid,p_witnesses jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; item jsonb; i integer:=0; v_name text; v_father text;
begin
  a := app.load_editable(p_app);
  if p_witnesses is null or jsonb_typeof(p_witnesses)<>'array' or jsonb_array_length(p_witnesses) not between 1 and 2 then
    raise exception 'Enter one or two witness names.' using errcode='22023';
  end if;
  delete from public.application_witnesses where application_id=p_app;
  for item in select value from jsonb_array_elements(p_witnesses) loop
    i:=i+1; v_name:=btrim(coalesce(item->>'name','')); v_father:=nullif(btrim(item->>'father_name'),'');
    if length(v_name) not between 2 and 160 or (v_father is not null and length(v_father)>160) then
      raise exception 'Witness names must be between 2 and 160 characters.' using errcode='22023';
    end if;
    insert into public.application_witnesses(application_id,serial,name,father_name)
      values(p_app,i,v_name,v_father);
  end loop;
  return jsonb_build_object('ok',true,'application',app.view(p_app));
end $$;
revoke all on function public.app_set_witnesses(uuid,jsonb) from public,anon;
grant execute on function public.app_set_witnesses(uuid,jsonb) to authenticated;

-- Extend the canonical application view with witnesses without changing other response keys.
create or replace function app.view(p_app uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; kh jsonb := null; res jsonb;
begin
  select * into a from public.deed_applications where id = p_app;
  if a.khatian_id is not null then
    select jsonb_build_object(
      'owners', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'serial', o.serial, 'owner_name', o.owner_name, 'father_name', o.father_name, 'share', o.share) order by o.serial) from ref.khatian_owners o where o.khatian_id = a.khatian_id), '[]'::jsonb),
      'dags', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'serial', d.serial, 'dag_no', d.dag_no, 'land_class', d.land_class, 'area', d.area) order by d.serial) from ref.khatian_dags d where d.khatian_id = a.khatian_id), '[]'::jsonb),
      'share_total', (select coalesce(sum(share), 0) from ref.khatian_owners where khatian_id = a.khatian_id)) into kh;
  end if;
  select jsonb_build_object(
    'application',to_jsonb(a),'khatian',kh,
    'parties',coalesce((select jsonb_agg(to_jsonb(p)-'application_id'-'person_id') from public.application_parties p where p.application_id=a.id),'[]'::jsonb),
    'ownership',(select to_jsonb(o)-'application_id'-'baya_deed_id' from public.application_ownership o where o.application_id=a.id),
    'plots',coalesce((select jsonb_agg(to_jsonb(x)-'application_id' order by x.created_at) from public.application_plots x where x.application_id=a.id),'[]'::jsonb),
    'witnesses',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'serial',w.serial,'name',w.name,'father_name',w.father_name) order by w.serial) from public.application_witnesses w where w.application_id=a.id),'[]'::jsonb),
    'fee_items',coalesce((select jsonb_agg(to_jsonb(f)-'application_id' order by f.fee_code) from public.application_fee_items f where f.application_id=a.id),'[]'::jsonb),
    'challans',coalesce((select jsonb_agg(to_jsonb(c)-'application_id'-'challan_no_norm') from public.application_challans c where c.application_id=a.id),'[]'::jsonb),
    'appointment',(select to_jsonb(ap)-'application_id' from public.application_appointments ap where ap.application_id=a.id and ap.status in ('booked','confirmed')),
    'appointment_events',coalesce((select jsonb_agg(jsonb_build_object('event',e.event,'detail',e.detail,'created_at',e.created_at) order by e.id) from public.application_appointment_events e where e.application_id=a.id),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d)-'application_id' order by d.created_at) from public.application_documents d where d.application_id=a.id),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('from_status',h.from_status,'to_status',h.to_status,'actor_role',h.actor_role,'note',h.note,'created_at',h.created_at) order by h.id) from public.application_status_history h where h.application_id=a.id),'[]'::jsonb),
    'corrections',coalesce((select jsonb_agg(to_jsonb(c)-'application_id'-'requested_by' order by c.requested_at) from public.application_corrections c where c.application_id=a.id),'[]'::jsonb)
  ) into res;
  return res;
end $$;

-- Prevent submitting an application without its selected deed nature and at least one witness.
create or replace function app.guard_deed_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('submitted','discrepancy_review') then
    if new.deed_nature is null or not exists(select 1 from public.deed_nature_options o where o.code=new.deed_nature and o.active) then
      raise exception 'Select the deed nature before submission.' using errcode='AP001';
    end if;
    if not exists(select 1 from public.application_witnesses w where w.application_id=new.id) then
      raise exception 'Enter at least one deed witness before submission.' using errcode='AP001';
    end if;
  end if;
  return new;
end $$;
revoke all on function app.guard_deed_submission() from public,anon,authenticated;
drop trigger if exists deed_applications_nature_witness_guard on public.deed_applications;
create trigger deed_applications_nature_witness_guard before update of status on public.deed_applications
for each row execute function app.guard_deed_submission();

-- Return the generated demo deed number to registrar UI.
create or replace function public.staff_finalize_registration(p_app uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_district text; v_upazila text; v_approved boolean; a public.deed_applications%rowtype; v_ref text; v_snapshot jsonb; v_demo_no text;
begin
  select role,district,upazila,is_approved into v_role,v_district,v_upazila,v_approved from public.profiles where id=auth.uid();
  if v_approved is distinct from true or v_role not in ('sub_registrar','admin') then raise exception 'approved staff access required' using errcode='42501'; end if;
  select * into a from public.deed_applications x where x.id=p_app
    and (v_role='admin' or (x.office_district=v_district and x.office_upazila=v_upazila)) for update;
  if not found then raise exception 'application not found' using errcode='42501'; end if;
  if a.status<>'under_review' then raise exception 'application must be under review before finalization' using errcode='AP001'; end if;
  if a.deed_nature is null or a.deed_date is null then raise exception 'deed nature and date are required' using errcode='AP001'; end if;
  if a.biometric_status<>'completed' then raise exception 'biometric appointment status is not recorded as completed' using errcode='AP001'; end if;
  if jsonb_array_length(coalesce(a.blockers,'[]'::jsonb))>0 then raise exception 'application has unresolved blockers' using errcode='AP001'; end if;
  if exists(select 1 from public.application_challans c where c.application_id=p_app and not exists(
    select 1 from ref.echallans e where ref.bn2en(e.challan_no)=ref.bn2en(c.challan_no) and e.amount=c.amount and e.fee_type=c.challan_type and e.verify_status='verified'
      and (e.used_in_application_no is null or e.used_in_application_no=a.application_no))) then
    raise exception 'challan verification precondition failed' using errcode='AP001';
  end if;
  if not exists(select 1 from public.audit_logs l where l.application_id=p_app and l.action='registrar_decision' and l.details->>'decision'='approve') then
    raise exception 'registrar approval decision must be recorded before finalization' using errcode='AP001';
  end if;
  if exists(select 1 from public.registration_register where application_id=p_app) then raise exception 'application already has a registration record' using errcode='AP001'; end if;
  v_ref:='DEMO-'||to_char(now() at time zone 'Asia/Dhaka','YYYY')||'-'||lpad(nextval('app.registration_ref_seq')::text,8,'0');
  v_snapshot:=jsonb_build_object(
    'application_no',a.application_no,'deed_nature',a.deed_nature,'deed_date',a.deed_date,
    'district',a.district,'upazila',a.upazila,'mouza',a.mouza,'khatian_type',a.khatian_type,'khatian_no',a.khatian_no,
    'sale_price',a.sale_price,'flags',a.flags,
    'parties',(select coalesce(jsonb_agg(jsonb_build_object('role',role,'name_bn',name_bn,'father_name',father_name,'mother_name',mother_name,'address',address,'nid_masked',nid_masked)),'[]'::jsonb) from public.application_parties where application_id=p_app),
    'plots',(select coalesce(jsonb_agg(jsonb_build_object('dag_no',dag_no,'area_sold',area_sold,'land_class',land_class)),'[]'::jsonb) from public.application_plots where application_id=p_app),
    'witnesses',(select coalesce(jsonb_agg(jsonb_build_object('serial',serial,'name',name,'father_name',father_name) order by serial),'[]'::jsonb) from public.application_witnesses where application_id=p_app));
  insert into public.registration_register(application_id,registration_ref,registered_by,mode,snapshot)
    values(p_app,v_ref,auth.uid(),'DEMO',v_snapshot);
  select demo_deed_no into v_demo_no from public.registered_deeds where application_id=p_app;
  update public.deed_applications set status='registered',updated_at=now() where id=p_app;
  insert into public.application_status_history(application_id,from_status,to_status,actor_id,actor_role,note)
    values(p_app,'under_review','registered',auth.uid(),v_role,'DEMO registration finalized; not official government registration');
  insert into public.audit_logs(actor_id,actor_role,action,application_id,details)
    values(auth.uid(),v_role,'demo_registration_finalized',p_app,jsonb_build_object('registration_ref',v_ref,'demo_deed_no',v_demo_no,'mode','DEMO'));
  return jsonb_build_object('ok',true,'mode','DEMO','registration_ref',v_ref,'demo_deed_no',v_demo_no,'registered_at',now(),
    'notice','DEMO ONLY — not an official government registration or legally valid deed.');
end $$;
revoke all on function public.staff_finalize_registration(uuid) from public,anon;
grant execute on function public.staff_finalize_registration(uuid) to authenticated;

-- Staff detail response now includes witness rows (existing fields remain unchanged).
create or replace function public.staff_application_detail(p_app uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_district text; v_upazila text; v_approved boolean; a public.deed_applications%rowtype;
begin
  select role,district,upazila,is_approved into v_role,v_district,v_upazila,v_approved from public.profiles where id=auth.uid();
  if v_approved is distinct from true or v_role not in ('sub_registrar','admin') then raise exception 'approved staff access required' using errcode='42501'; end if;
  select * into a from public.deed_applications x where x.id=p_app and (v_role='admin' or (x.office_district=v_district and x.office_upazila=v_upazila));
  if not found or a.status in ('draft','withdrawn') then raise exception 'application not found' using errcode='42501'; end if;
  insert into public.audit_logs(actor_id,actor_role,action,application_id,details) values(auth.uid(),v_role,'application_review_opened',p_app,'{}'::jsonb);
  return jsonb_build_object(
    'application',to_jsonb(a),
    'applicant',(select jsonb_build_object('full_name',p.full_name,'email',p.email) from public.profiles p where p.id=a.applicant_id),
    'parties',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.application_parties x where x.application_id=p_app),
    'witnesses',(select coalesce(jsonb_agg(to_jsonb(x)-'application_id' order by x.serial),'[]'::jsonb) from public.application_witnesses x where x.application_id=p_app),
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
revoke all on function public.staff_application_detail(uuid) from public,anon;
grant execute on function public.staff_application_detail(uuid) to authenticated;

-- Automatic challan serial: 2627-10001, ... (server-side lock; no client-supplied serial).
create table if not exists public.challan_number_counter (
  id boolean primary key default true check(id),
  fiscal_code text not null default '2627' check(fiscal_code ~ '^[0-9]{4}$'),
  office_code text not null default '1',
  last_number integer not null default 10000 check(last_number>=0)
);
insert into public.challan_number_counter(id,fiscal_code,office_code,last_number) values(true,'2627','1',10000)
on conflict(id) do nothing;
revoke all on public.challan_number_counter from public,anon,authenticated;

commit;
