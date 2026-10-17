-- LDIS migration 21: normalized multiple parcels/witnesses on existing deeds, and authorized demo print data.
-- Additive only. It preserves the legacy ref.deeds columns queried by existing workflow functions.

begin;

-- Canonical price field for existing/reference deeds; aliases from legacy imports remain readable in verify_deed().
alter table ref.deeds add column if not exists deed_value numeric(14,2);

create table if not exists ref.deed_parcels (
  id uuid primary key default gen_random_uuid(),
  deed_id uuid not null references ref.deeds(id) on delete cascade,
  serial smallint not null check (serial between 1 and 50),
  location_id uuid not null references ref.locations(id) on delete restrict,
  khatian_type text not null,
  khatian_no text not null,
  khatian_no_norm text not null,
  dag_no text not null,
  dag_no_norm text not null,
  area numeric(14,4) not null check (area > 0),
  land_class text not null,
  created_at timestamptz not null default now(),
  unique (deed_id, serial)
);
create index if not exists deed_parcels_lookup_idx on ref.deed_parcels(location_id, khatian_no_norm, dag_no_norm);
create index if not exists deed_parcels_deed_idx on ref.deed_parcels(deed_id, serial);
alter table ref.deed_parcels enable row level security;
revoke all on ref.deed_parcels from public, anon, authenticated;

create table if not exists ref.deed_witnesses (
  id uuid primary key default gen_random_uuid(),
  deed_id uuid not null references ref.deeds(id) on delete cascade,
  serial smallint not null check (serial between 1 and 2),
  name text not null check (length(btrim(name)) between 2 and 160),
  father_name text check (father_name is null or length(btrim(father_name)) <= 160),
  created_at timestamptz not null default now(),
  unique (deed_id, serial)
);
create index if not exists deed_witnesses_deed_idx on ref.deed_witnesses(deed_id, serial);
alter table ref.deed_witnesses enable row level security;
revoke all on ref.deed_witnesses from public, anon, authenticated;

-- Separate logical BRS and Namjari/Mutation datasets without breaking legacy RPCs using ref.khatians.
create or replace view ref.brs_porcha as select * from ref.khatians where upper(khatian_type)='BRS';
create or replace view ref.namjari_porcha as select * from ref.khatians where upper(khatian_type) in ('NAMJARI','MUTATION','MUTATIONAL');
revoke all on ref.brs_porcha, ref.namjari_porcha from public, anon, authenticated;

-- Preserve the existing verifier response contract and add fields for richer detail/printing.
create or replace function public.verify_deed(p_deed_no text, p_deed_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; n text; res jsonb; other_dates integer;
begin
  v_role := ref.assert_app_user();
  n := ref.bn2en(p_deed_no);
  if n !~ '^[0-9]{1,6}(/[0-9]{4})?$' then raise exception 'invalid input' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'deed_no',d.deed_no,'deed_date',d.deed_date,'deed_type',d.deed_type,
    'deed_value',coalesce(to_jsonb(d)->>'deed_value',to_jsonb(d)->>'deed_price',to_jsonb(d)->>'sale_price',to_jsonb(d)->>'value_amount',to_jsonb(d)->>'consideration_value',to_jsonb(d)->>'amount',to_jsonb(d)->>'declared_value',to_jsonb(d)->>'price'),
    'division',l.division,'district',l.district,'upazila',l.upazila,'mouza',l.mouza,
    'khatian_no',d.khatian_no,'dag_no',d.dag_no,'area_sold',d.area_sold,
    'donor_name',dd.name_bn,'donor_father_name',dd.father_name,'donor_mother_name',dd.mother_name,'donor_address',dd.address,
    'donee_name',dn.name_bn,'donee_father_name',dn.father_name,'donee_mother_name',dn.mother_name,'donee_address',dn.address,
    'sub_office',d.sub_office,'registered_on',d.registered_on,'prev_deed_no',pd.deed_no,'prev_deed_date',pd.deed_date,
    'parcels',coalesce((select jsonb_agg(jsonb_build_object('serial',dp.serial,'division',pl.division,'district',pl.district,'upazila',pl.upazila,'mouza',pl.mouza,'location_id',dp.location_id,'khatian_type',dp.khatian_type,'khatian_no',dp.khatian_no,'dag_no',dp.dag_no,'area',dp.area,'land_class',dp.land_class) order by dp.serial)
      from ref.deed_parcels dp left join ref.locations pl on pl.id=dp.location_id where dp.deed_id=d.id),
      jsonb_build_array(jsonb_build_object('serial',1,'division',l.division,'district',l.district,'upazila',l.upazila,'mouza',l.mouza,'location_id',d.location_id,'khatian_type',null,'khatian_no',d.khatian_no,'dag_no',d.dag_no,'area',d.area_sold,'land_class',null))),
    'witnesses',coalesce((select jsonb_agg(jsonb_build_object('serial',w.serial,'name',w.name,'father_name',w.father_name) order by w.serial) from ref.deed_witnesses w where w.deed_id=d.id),'[]'::jsonb)
  ) order by d.deed_date),'[]'::jsonb) into res
  from ref.deeds d
  left join ref.locations l on l.id=d.location_id
  left join ref.nid_persons dd on dd.id=d.donor_id
  left join ref.nid_persons dn on dn.id=d.donee_id
  left join ref.deeds pd on pd.id=d.prev_deed_id
  where d.deed_no_norm=n and (p_deed_date is null or d.deed_date=p_deed_date);
  select count(*) into other_dates from ref.deeds d where d.deed_no_norm=n and p_deed_date is not null and d.deed_date<>p_deed_date;
  return jsonb_build_object('candidates',res,'same_number_other_dates',other_dates);
end $$;
revoke all on function public.verify_deed(text,date) from public, anon;
grant execute on function public.verify_deed(text,date) to authenticated;

-- Owner/assigned registrar/admin only; the browser cannot query the archive table directly.
-- NID details are resolved from person_id at print time. This RPC is available only after DEMO finalization.
create or replace function public.get_registered_deed_print(p_app uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_role text; v_district text; v_upazila text; v_approved boolean;
  a public.deed_applications%rowtype; r public.registered_deeds%rowtype; parties jsonb; plots jsonb; witnesses jsonb;
begin
  if v_uid is null then raise exception 'sign in required' using errcode='28000'; end if;
  select role,district,upazila,is_approved into v_role,v_district,v_upazila,v_approved from public.profiles where id=v_uid;
  if v_approved is distinct from true then raise exception 'approved profile required' using errcode='42501'; end if;
  select * into a from public.deed_applications where id=p_app;
  if not found or a.status <> 'registered' then raise exception 'registered demo deed not found' using errcode='42501'; end if;
  if a.applicant_id <> v_uid and not (coalesce(v_role,'')='admin' or (coalesce(v_role,'')='sub_registrar' and a.office_district=v_district and a.office_upazila=v_upazila)) then
    raise exception 'not permitted to view this deed' using errcode='42501';
  end if;
  select * into r from public.registered_deeds where application_id=p_app;
  if not found then raise exception 'registered deed archive entry missing' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'role',p.role,'person_id',p.person_id,'name_bn',n.name_bn,'father_name',n.father_name,'mother_name',n.mother_name,
    'dob',n.dob,'gender',n.gender,'address',n.address,'occupation',n.occupation,'nid_no',n.nid_no_norm
  ) order by case when p.role='donor' then 1 else 2 end,p.role),'[]'::jsonb) into parties
  from public.application_parties p left join ref.nid_persons n on n.id=p.person_id where p.application_id=p_app;
  select coalesce(jsonb_agg(jsonb_build_object('dag_no',p.dag_no,'dag_area',p.dag_area,'area_sold',p.area_sold,'land_class',p.land_class,'remaining',p.remaining,'after_sale',p.after_sale) order by p.created_at),'[]'::jsonb)
    into plots from public.application_plots p where p.application_id=p_app;
  select coalesce(jsonb_agg(jsonb_build_object('serial',w.serial,'name',w.name,'father_name',w.father_name) order by w.serial),'[]'::jsonb)
    into witnesses from public.application_witnesses w where w.application_id=p_app;
  return jsonb_build_object(
    'record',jsonb_build_object('id',r.id,'application_id',r.application_id,'registration_ref',r.registration_ref,
      'demo_deed_no',r.demo_deed_no,'deed_date',r.deed_date,'registered_at',r.registered_at,'registration_mode',r.registration_mode,
      'snapshot',r.deed_snapshot),
    'parties',parties,'plots',plots,'witnesses',witnesses,
    'location',jsonb_build_object('division',a.division,'district',a.district,'upazila',a.upazila,'mouza',a.mouza,'khatian_type',a.khatian_type,'khatian_no',a.khatian_no),
    'deed_nature',a.deed_nature,'sale_price',a.sale_price,
    'notice','DEMO ONLY — not an official government registration or legally valid deed.'
  );
end $$;
revoke all on function public.get_registered_deed_print(uuid) from public, anon;
grant execute on function public.get_registered_deed_print(uuid) to authenticated;

commit;
