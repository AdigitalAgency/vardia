-- Vardia — δημοσίευση με στοχευμένες ειδοποιήσεις
-- Ο εργαζόμενος ειδοποιείται ΜΟΝΟ όταν αλλάζει κάτι δικό του (PM §1.2-U1:
-- diff-based notifications, όχι spam σε κάθε republish).

-- 1) Το shift_revisions χρειάζεται συμφραζόμενα που επιβιώνουν της διαγραφής του shift.
alter table shift_revisions add column if not exists week_id uuid references schedule_weeks(id) on delete cascade;
alter table shift_revisions add column if not exists employee_id uuid references employees(id) on delete cascade;
alter table shift_revisions alter column shift_id drop not null;

do $$
begin
  alter table shift_revisions drop constraint if exists shift_revisions_shift_id_fkey;
  alter table shift_revisions
    add constraint shift_revisions_shift_id_fkey
    foreign key (shift_id) references shifts(id) on delete set null;
end $$;

create index if not exists shift_revisions_week_idx on shift_revisions (week_id, changed_at);

-- 2) Κάθε αλλαγή σε ΔΗΜΟΣΙΕΥΜΕΝΗ εβδομάδα καταγράφεται αυτόματα.
--    Οι draft εβδομάδες αλλάζουν συνεχώς όσο φτιάχνεται το πρόγραμμα — δεν μας νοιάζουν.
create or replace function log_shift_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status week_status;
  v_week uuid := coalesce(new.week_id, old.week_id);
begin
  select status into v_status from schedule_weeks where id = v_week;

  if v_status in ('published', 'published_dirty') then
    insert into shift_revisions (
      tenant_id, shift_id, week_id, employee_id, changed_by, before, after
    )
    values (
      coalesce(new.tenant_id, old.tenant_id),
      case when tg_op = 'DELETE' then null else new.id end,
      v_week,
      coalesce(new.employee_id, old.employee_id),
      auth.uid(),
      case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      case when tg_op = 'DELETE' then null else to_jsonb(new) end
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists shifts_revision_trigger on shifts;
create trigger shifts_revision_trigger
after insert or update or delete on shifts
for each row execute function log_shift_revision();

-- 3) Δημοσίευση + ειδοποιήσεις σε μία κλήση.
create or replace function publish_week(p_week_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week schedule_weeks;
  v_uid uuid := auth.uid();
  v_tenant_name text;
  v_first boolean;
  v_notified int := 0;
  v_rec record;
begin
  select * into v_week from schedule_weeks where id = p_week_id;
  if not found then
    raise exception 'WEEK_NOT_FOUND';
  end if;
  if not has_role(v_week.tenant_id, array['owner', 'manager']::membership_role[]) then
    raise exception 'FORBIDDEN';
  end if;

  v_first := v_week.status = 'draft';
  select name into v_tenant_name from tenants where id = v_week.tenant_id;

  for v_rec in
    select distinct e.user_id
    from employees e
    where e.tenant_id = v_week.tenant_id
      and e.user_id is not null
      and (
        -- πρώτη δημοσίευση: όποιος έχει έστω ένα κελί μέσα στην εβδομάδα
        (v_first and exists (
          select 1 from shifts s
          where s.week_id = p_week_id and s.employee_id = e.id
        ))
        -- επαναδημοσίευση: μόνο όσοι άλλαξαν από την προηγούμενη δημοσίευση
        or (not v_first and exists (
          select 1 from shift_revisions r
          where r.week_id = p_week_id
            and r.employee_id = e.id
            and r.changed_at > coalesce(v_week.published_at, to_timestamp(0))
        ))
      )
  loop
    insert into notifications (tenant_id, user_id, kind, payload)
    values (
      v_week.tenant_id,
      v_rec.user_id,
      case when v_first then 'schedule_published' else 'schedule_changed' end,
      jsonb_build_object(
        'week_start', v_week.week_start_date,
        'tenant_name', v_tenant_name
      )
    );
    v_notified := v_notified + 1;
  end loop;

  update schedule_weeks
  set status = 'published', published_at = now(), published_by = v_uid
  where id = p_week_id;

  insert into audit_log (tenant_id, actor, action, entity, entity_id, after)
  values (v_week.tenant_id, v_uid, 'publish', 'schedule_week', p_week_id::text,
          jsonb_build_object('week_start', v_week.week_start_date, 'notified', v_notified));

  return jsonb_build_object('notified', v_notified, 'first_publish', v_first);
end;
$$;

revoke all on function publish_week(uuid) from public;
grant execute on function publish_week(uuid) to authenticated;

-- 4) Πρόσκληση λογιστή/υπεύθυνου: το ίδιο invite μηχανισμό, με ρόλο.
alter table employee_invites add column if not exists role membership_role not null default 'employee';
alter table employee_invites alter column employee_id drop not null;

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

  -- Οι προσκλήσεις εργαζομένων δένονται με συγκεκριμένη καρτέλα· λογιστής/υπεύθυνος όχι.
  if v_invite.employee_id is not null then
    select user_id into v_taken from employees where id = v_invite.employee_id;
    if v_taken is not null and v_taken <> v_uid then
      raise exception 'ALREADY_LINKED';
    end if;
    update employees set user_id = v_uid where id = v_invite.employee_id;
  end if;

  insert into memberships (user_id, tenant_id, role, status, invited_via)
  values (v_uid, v_invite.tenant_id, v_invite.role, 'active', 'link')
  on conflict (user_id, tenant_id) do update set status = 'active', role = excluded.role;

  update employee_invites
  set used_at = now(), used_by = v_uid
  where id = v_invite.id;

  return jsonb_build_object(
    'tenant_id', v_invite.tenant_id,
    'employee_id', v_invite.employee_id,
    'role', v_invite.role
  );
end;
$$;

create or replace function invite_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_tenant text;
  v_role membership_role;
  v_found boolean := false;
begin
  select coalesce(e.full_name, ''), t.name, i.role
  into v_name, v_tenant, v_role
  from employee_invites i
  join tenants t on t.id = i.tenant_id
  left join employees e on e.id = i.employee_id
  where i.token = p_token and i.used_at is null and i.expires_at > now();

  if v_tenant is null then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object(
    'valid', true,
    'employee_name', nullif(v_name, ''),
    'tenant_name', v_tenant,
    'role', v_role
  );
end;
$$;

grant execute on function invite_preview(text) to anon, authenticated;
