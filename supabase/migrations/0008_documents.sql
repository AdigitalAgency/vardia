-- Vardia — πιστοποιητικό υγείας + έγγραφα εργαζομένου
-- Στα καταστήματα υγειονομικού ενδιαφέροντος το πιστοποιητικό υγείας είναι
-- υποχρεωτικό και ελέγχεται σε επιθεώρηση — γι' αυτό είναι ξεχωριστό πεδίο
-- με ημερομηνία λήξης, όχι απλώς ένα ακόμα αρχείο.

alter table employees add column if not exists health_cert boolean not null default false;
alter table employees add column if not exists health_cert_expiry date;

comment on column employees.health_cert is 'Έχει προσκομίσει πιστοποιητικό υγείας (κατάστημα υγειονομικού ενδιαφέροντος)';
comment on column employees.health_cert_expiry is 'Λήξη πιστοποιητικού — βάση για υπενθύμιση ανανέωσης';

create table if not exists employee_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  kind text not null default 'other', -- health_cert | contract | id | other
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists employee_documents_employee_idx on employee_documents (employee_id);

alter table employee_documents enable row level security;

-- Έγγραφα εργαζομένων: owner/manager διαχειρίζονται, λογιστής βλέπει,
-- ο ίδιος ο εργαζόμενος βλέπει τα δικά του. Κανείς άλλος.
create policy documents_admin_all on employee_documents
  for all using (has_role(tenant_id, array['owner','manager']::membership_role[]));

create policy documents_accountant_read on employee_documents
  for select using (has_role(tenant_id, array['accountant']::membership_role[]));

create policy documents_self_read on employee_documents
  for select using (
    employee_id in (select id from employees where user_id = auth.uid())
  );

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-docs',
  'employee-docs',
  false, -- ΠΟΤΕ δημόσιο: περιέχει έγγραφα ταυτοποίησης
  10485760, -- 10MB
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

-- Τα αρχεία μπαίνουν σε φάκελο ανά tenant: <tenant_id>/<employee_id>/<uuid>.<ext>
-- Έτσι το πρώτο path segment αρκεί για τον έλεγχο πρόσβασης.
drop policy if exists "employee docs admin" on storage.objects;
create policy "employee docs admin" on storage.objects
  for all
  using (
    bucket_id = 'employee-docs'
    and has_role((storage.foldername(name))[1]::uuid,
                 array['owner','manager']::membership_role[])
  )
  with check (
    bucket_id = 'employee-docs'
    and has_role((storage.foldername(name))[1]::uuid,
                 array['owner','manager']::membership_role[])
  );

drop policy if exists "employee docs accountant read" on storage.objects;
create policy "employee docs accountant read" on storage.objects
  for select
  using (
    bucket_id = 'employee-docs'
    and has_role((storage.foldername(name))[1]::uuid,
                 array['accountant']::membership_role[])
  );
