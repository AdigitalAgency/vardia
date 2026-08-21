-- Vardia — initial schema (v1)
-- Multi-tenancy: single DB, shared schema, tenant_id + RLS everywhere.
-- Roles live in memberships, not on the user. See projects/littlemosque/research/03-pm-decision.md §2.4-2.5.

create extension if not exists "pgcrypto";

-- ---------- Core tenancy ----------

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Europe/Athens',
  week_start smallint not null default 1, -- 1 = Monday
  settings jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table tenant_products (
  tenant_id uuid not null references tenants(id) on delete cascade,
  product_key text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}',
  primary key (tenant_id, product_key)
);

create type membership_role as enum ('owner', 'manager', 'accountant', 'employee');
create type membership_status as enum ('invited', 'active', 'disabled');

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  role membership_role not null,
  invited_via text,
  status membership_status not null default 'invited',
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

-- ---------- Org structure ----------

create table departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  full_name text not null,
  phone text,
  afm text,          -- ΑΦΜ: required by the accountant export (LITTLEMOSQUE_BRAIN §5α)
  payroll_id text,   -- ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ in the accountant's payroll system
  sort_order int not null default 0,
  user_id uuid references auth.users(id), -- linked on invite accept; nullable until then
  status text not null default 'active',
  archived_at timestamptz
);

create table shift_presets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  label text not null,
  start_time smallint, -- minutes since midnight; null for non-work presets (ΡΕΠΟ/ΑΔΕΙΑ)
  end_time smallint,
  crosses_midnight boolean not null default false,
  kind text not null default 'work', -- work | repo | adeia
  color text,
  sort_order int not null default 0,
  usage_count int not null default 0
);

-- ---------- Scheduling ----------

create type week_status as enum ('draft', 'published', 'published_dirty');
create type shift_kind as enum ('work', 'repo', 'adeia', 'custom_status', 'empty');

create table schedule_weeks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  week_start_date date not null,
  status week_status not null default 'draft',
  published_at timestamptz,
  published_by uuid references auth.users(id),
  unique (tenant_id, week_start_date)
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  week_id uuid not null references schedule_weeks(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  kind shift_kind not null default 'empty',
  preset_id uuid references shift_presets(id) on delete set null,
  start_time smallint,
  end_time smallint,
  crosses_midnight boolean not null default false,
  leave_type text, -- when kind = adeia: kanoniki | patrotita | astheneia | ...
  note text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (week_id, employee_id, date)
);

-- Append-only history of changes to published shifts: feeds diff-notifications
-- and is the audit foundation required before any payroll-facing feature.
create table shift_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  before jsonb,
  after jsonb
);

create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  type text not null, -- adeia | repo | other (maps to accountant vocabulary)
  date_from date not null,
  date_to date not null,
  comment text,
  status leave_status not null default 'pending',
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

-- ---------- Exports / notifications / audit ----------

create table exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  requested_by uuid references auth.users(id),
  period_start date not null,
  period_end date not null,
  format text not null, -- weekly-matrix-csv | weekly-matrix-xlsx
  file_ref text,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------

create or replace function member_tenants()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from memberships
  where user_id = auth.uid() and status = 'active'
$$;

create or replace function has_role(t uuid, roles membership_role[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and tenant_id = t
      and status = 'active' and role = any(roles)
  )
$$;

alter table tenants enable row level security;
alter table tenant_products enable row level security;
alter table memberships enable row level security;
alter table departments enable row level security;
alter table employees enable row level security;
alter table shift_presets enable row level security;
alter table schedule_weeks enable row level security;
alter table shifts enable row level security;
alter table shift_revisions enable row level security;
alter table leave_requests enable row level security;
alter table exports enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table audit_log enable row level security;

create policy tenants_member_read on tenants
  for select using (id in (select member_tenants()));

create policy memberships_self_read on memberships
  for select using (user_id = auth.uid() or has_role(tenant_id, array['owner','manager']::membership_role[]));

create policy tenant_products_member_read on tenant_products
  for select using (tenant_id in (select member_tenants()));

create policy departments_member_read on departments
  for select using (tenant_id in (select member_tenants()));
create policy departments_admin_write on departments
  for all using (has_role(tenant_id, array['owner','manager']::membership_role[]));

create policy employees_admin_all on employees
  for all using (has_role(tenant_id, array['owner','manager','accountant']::membership_role[]));
create policy employees_self_read on employees
  for select using (user_id = auth.uid());

create policy presets_member_read on shift_presets
  for select using (tenant_id in (select member_tenants()));
create policy presets_admin_write on shift_presets
  for all using (has_role(tenant_id, array['owner','manager']::membership_role[]));

create policy weeks_admin_all on schedule_weeks
  for all using (has_role(tenant_id, array['owner','manager','accountant']::membership_role[]));
-- Employees only ever see published weeks.
create policy weeks_employee_read on schedule_weeks
  for select using (
    status in ('published','published_dirty')
    and tenant_id in (select member_tenants())
  );

create policy shifts_admin_all on shifts
  for all using (has_role(tenant_id, array['owner','manager','accountant']::membership_role[]));
-- Employees see ONLY their own shifts, and only from published weeks.
create policy shifts_employee_read on shifts
  for select using (
    employee_id in (select id from employees where user_id = auth.uid())
    and week_id in (select id from schedule_weeks where status in ('published','published_dirty'))
  );

create policy revisions_admin_read on shift_revisions
  for select using (has_role(tenant_id, array['owner','manager','accountant']::membership_role[]));

create policy leave_admin_all on leave_requests
  for all using (has_role(tenant_id, array['owner','manager']::membership_role[]));
create policy leave_self_all on leave_requests
  for all using (employee_id in (select id from employees where user_id = auth.uid()));
create policy leave_accountant_read on leave_requests
  for select using (has_role(tenant_id, array['accountant']::membership_role[]));

create policy exports_admin_all on exports
  for all using (has_role(tenant_id, array['owner','manager','accountant']::membership_role[]));

create policy notifications_self on notifications
  for all using (user_id = auth.uid());

create policy push_self on push_subscriptions
  for all using (user_id = auth.uid());

create policy audit_admin_read on audit_log
  for select using (has_role(tenant_id, array['owner','manager','accountant']::membership_role[]));

-- Writes to tenants/memberships/tenant_products/shift_revisions/audit_log happen
-- through service-role server code (wizard provisioning, invite accept, publish flow),
-- never directly from the browser.
