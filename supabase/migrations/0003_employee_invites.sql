-- Vardia — προσκλήσεις εργαζομένων (invite link → σύνδεση user με employee record)
-- Ο employee δεν έχει email-first λογαριασμό: μπαίνει με link που του στέλνει ο owner
-- (SMS/Viber) και ορίζει κινητό + PIN. Η σύνδεση user↔employee γίνεται μέσω
-- SECURITY DEFINER function, ώστε να μη χρειάζεται service-role key στον client.

create table employee_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  token text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz,
  used_by uuid references auth.users(id)
);

create index employee_invites_employee_idx on employee_invites (employee_id) where used_at is null;

alter table employee_invites enable row level security;

create policy invites_admin_all on employee_invites
  for all using (has_role(tenant_id, array['owner','manager']::membership_role[]));

/**
 * Καλείται από τον εργαζόμενο ΑΦΟΥ έχει δημιουργηθεί ο auth user του.
 * Δένει τον user με το employee record και δίνει membership ρόλου employee.
 */
create or replace function accept_employee_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite employee_invites;
  v_uid uuid := auth.uid();
  v_taken uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_invite
  from employee_invites
  where token = p_token and used_at is null and expires_at > now();

  if not found then
    raise exception 'INVALID_INVITE';
  end if;

  -- Το invite είναι προσωπικό: αν το employee record έχει ήδη άλλον user, σταμάτα.
  select user_id into v_taken from employees where id = v_invite.employee_id;
  if v_taken is not null and v_taken <> v_uid then
    raise exception 'ALREADY_LINKED';
  end if;

  update employees set user_id = v_uid where id = v_invite.employee_id;

  insert into memberships (user_id, tenant_id, role, status, invited_via)
  values (v_uid, v_invite.tenant_id, 'employee', 'active', 'link')
  on conflict (user_id, tenant_id) do update set status = 'active';

  update employee_invites
  set used_at = now(), used_by = v_uid
  where id = v_invite.id;

  return jsonb_build_object('tenant_id', v_invite.tenant_id, 'employee_id', v_invite.employee_id);
end;
$$;

revoke all on function accept_employee_invite(text) from public;
grant execute on function accept_employee_invite(text) to authenticated;

/** Το όνομα του εργαζόμενου πίσω από ένα invite token — για την οθόνη αποδοχής. */
create or replace function invite_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_tenant text;
begin
  select e.full_name, t.name into v_name, v_tenant
  from employee_invites i
  join employees e on e.id = i.employee_id
  join tenants t on t.id = i.tenant_id
  where i.token = p_token and i.used_at is null and i.expires_at > now();

  if v_name is null then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object('valid', true, 'employee_name', v_name, 'tenant_name', v_tenant);
end;
$$;

revoke all on function invite_preview(text) from public;
grant execute on function invite_preview(text) to anon, authenticated;
