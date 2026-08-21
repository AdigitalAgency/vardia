-- Vardia — πλήρης καρτέλα εργαζομένου (Owner directory)
-- Ο owner διαχειρίζεται ο ίδιος το προσωπικό: στοιχεία, πόστο, συμφωνημένες ώρες,
-- αμοιβή, και δημιουργία κωδικών πρόσβασης (χωρίς invite link).

-- Data minimization (απόφαση Φώτη 2026-08-21): το Vardia ΔΕΝ είναι σύστημα μισθοδοσίας.
-- Κρατάμε μόνο ό,τι χρειάζεται για πρόγραμμα + το αρχείο του λογιστή.
-- ΔΕΝ αποθηκεύουμε: ΑΜΚΑ, ημερομηνία γέννησης, ειδικότητα/πόστο (το τμήμα αρκεί).
-- Το ΑΦΜ (στήλη afm, ήδη από το 0001) μένει γιατί είναι στήλη του export του λογιστή,
-- αλλά είναι ορατό ΜΟΝΟ στην οθόνη του λογιστή — όχι στην καρτέλα του owner.

alter table employees add column if not exists email text;
alter table employees add column if not exists hire_date date;
alter table employees add column if not exists contract_type text;     -- full | part | rotational
alter table employees add column if not exists weekly_hours numeric(5,2);
alter table employees add column if not exists pay_type text;          -- hourly | daily | monthly
alter table employees add column if not exists pay_amount numeric(10,2);
alter table employees add column if not exists notes text;
alter table employees add column if not exists login_phone text;       -- το κινητό σύνδεσης (ό,τι δόθηκε στο auth)

comment on column employees.weekly_hours is 'Συμφωνημένες ώρες/εβδομάδα — βάση για ειδοποίηση υπέρβασης';
comment on column employees.pay_type is 'hourly | daily | monthly — ο owner επιλέγει τι δηλώνει';
comment on column employees.login_phone is 'Κινητό σύνδεσης· ο auth user είναι <phone>@employee.vardia.app';

-- Αρχειοθέτηση αντί για διαγραφή: τα shifts έχουν ON DELETE CASCADE, οπότε ένα hard
-- delete θα έσβηνε και το ιστορικό που χρειάζεται ο λογιστής.
create or replace function archive_employee(p_employee_id uuid, p_archive boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from employees where id = p_employee_id;
  if v_tenant is null then
    raise exception 'NOT_FOUND';
  end if;
  if not has_role(v_tenant, array['owner','manager']::membership_role[]) then
    raise exception 'FORBIDDEN';
  end if;

  update employees
  set status = case when p_archive then 'archived' else 'active' end,
      archived_at = case when p_archive then now() else null end
  where id = p_employee_id;

  insert into audit_log (tenant_id, actor, action, entity, entity_id)
  values (v_tenant, auth.uid(),
          case when p_archive then 'archive' else 'restore' end,
          'employee', p_employee_id::text);
end;
$$;

revoke all on function archive_employee(uuid, boolean) from public;
grant execute on function archive_employee(uuid, boolean) to authenticated;

/**
 * Οριστική διαγραφή — ΜΟΝΟ αν ο εργαζόμενος δεν έχει καμία βάρδια.
 * (GDPR: δικαίωμα διαγραφής για κάποιον που μπήκε κατά λάθος.)
 */
create or replace function delete_employee(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_shifts int;
begin
  select tenant_id into v_tenant from employees where id = p_employee_id;
  if v_tenant is null then
    raise exception 'NOT_FOUND';
  end if;
  if not has_role(v_tenant, array['owner','manager']::membership_role[]) then
    raise exception 'FORBIDDEN';
  end if;

  select count(*) into v_shifts from shifts where employee_id = p_employee_id;
  if v_shifts > 0 then
    raise exception 'HAS_SHIFTS';
  end if;

  delete from employees where id = p_employee_id;

  insert into audit_log (tenant_id, actor, action, entity, entity_id)
  values (v_tenant, auth.uid(), 'delete', 'employee', p_employee_id::text);
end;
$$;

revoke all on function delete_employee(uuid) from public;
grant execute on function delete_employee(uuid) to authenticated;

/** Σύνδεση υπάρχοντος auth user με καρτέλα εργαζομένου (καλείται από το API route). */
create or replace function link_employee_account(
  p_employee_id uuid,
  p_user_id uuid,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from employees where id = p_employee_id;
  if v_tenant is null then
    raise exception 'NOT_FOUND';
  end if;

  update employees
  set user_id = p_user_id, login_phone = p_phone
  where id = p_employee_id;

  insert into memberships (user_id, tenant_id, role, status, invited_via)
  values (p_user_id, v_tenant, 'employee', 'active', 'owner_created')
  on conflict (user_id, tenant_id) do update set status = 'active';

  insert into audit_log (tenant_id, actor, action, entity, entity_id)
  values (v_tenant, auth.uid(), 'create_account', 'employee', p_employee_id::text);
end;
$$;

revoke all on function link_employee_account(uuid, uuid, text) from public;
grant execute on function link_employee_account(uuid, uuid, text) to service_role;
