-- LDIS migration 11: registration approval + Admin role management.
-- Apply AFTER the existing profile table and migrations 06-10 are present.
-- New profiles default to pending; existing profiles are grandfathered as approved.

alter table public.profiles
  add column if not exists is_approved boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

update public.profiles
set is_approved = true,
    approved_at = coalesce(approved_at, now())
where is_approved = false;

-- Only the Admin RPCs below can change access from the app. Profiles RLS remains in force.
create or replace function public.admin_list_users()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text; v_approved boolean; v_result jsonb;
begin
  select p.role, p.is_approved into v_role, v_approved
  from public.profiles p where p.id = auth.uid();
  if v_role is distinct from 'admin' or v_approved is distinct from true then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'email', p.email, 'full_name', p.full_name,
    'role', p.role, 'is_approved', p.is_approved,
    'created_at', p.created_at
  ) order by p.is_approved asc, p.created_at desc), '[]'::jsonb)
  into v_result from public.profiles p;
  return v_result;
end;
$$;

create or replace function public.admin_set_user_access(p_user_id uuid, p_role text, p_approved boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text; v_approved boolean;
begin
  select p.role, p.is_approved into v_role, v_approved
  from public.profiles p where p.id = auth.uid();
  if v_role is distinct from 'admin' or v_approved is distinct from true then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_role not in ('user', 'sub_registrar', 'admin') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'admin' or p_approved is distinct from true) then
    raise exception 'you cannot remove your own admin access or approval' using errcode = '42501';
  end if;
  update public.profiles
  set role = p_role,
      is_approved = p_approved,
      approved_at = case when p_approved then coalesce(approved_at, now()) else null end,
      approved_by = case when p_approved then auth.uid() else null end
  where id = p_user_id;
  if not found then raise exception 'user profile not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs(actor_id, actor_role, action, details)
  values(auth.uid(), 'admin', 'user_access_updated', jsonb_build_object(
    'target_user_id', p_user_id, 'role', p_role, 'is_approved', p_approved
  ));
  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'role', p_role, 'is_approved', p_approved);
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_user_access(uuid, text, boolean) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_user_access(uuid, text, boolean) to authenticated;

-- Provision the requested accounts. Existing auth.users/profile rows are not created here.
-- If the first email is not present in public.profiles, register it first and rerun this block.
update public.profiles
set role = 'user', is_approved = true, approved_at = coalesce(approved_at, now())
where lower(email) = lower('demo_4@ldis.com');

update public.profiles
set role = 'admin', is_approved = true, approved_at = coalesce(approved_at, now())
where lower(email) = lower('taslimaakhter.cse@diu.edu.bd');
