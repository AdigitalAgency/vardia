-- Vardia — seed pilot tenant: The Little Mosque
-- ΠΡΟΫΠΟΘΕΣΗ: πρώτα δημιούργησε τον owner user στο Supabase Dashboard
-- (Authentication → Users → Add user, με email+password, auto-confirmed)
-- και βάλε το email του στο v_owner_email παρακάτω. Τρέξε το στο SQL Editor.

do $$
declare
  v_owner_email text := 'ΒΑΛΕ_ΕΔΩ_ΤΟ_EMAIL_ΤΟΥ_OWNER';
  v_user uuid;
  v_tenant uuid;
  d_bar uuid; d_service uuid; d_latza uuid; d_kouzina uuid;
begin
  select id into v_user from auth.users where email = v_owner_email;
  if v_user is null then
    raise exception 'Δεν βρέθηκε user με email %. Φτιάξε τον πρώτα στο Authentication → Users.', v_owner_email;
  end if;

  insert into tenants (name, slug, created_by)
  values ('The Little Mosque', 'little-mosque', v_user)
  returning id into v_tenant;

  insert into tenant_products (tenant_id, product_key) values (v_tenant, 'scheduling');

  insert into memberships (user_id, tenant_id, role, status)
  values (v_user, v_tenant, 'owner', 'active');

  insert into departments (tenant_id, name, sort_order) values (v_tenant, 'BAR', 0) returning id into d_bar;
  insert into departments (tenant_id, name, sort_order) values (v_tenant, 'SERVICE', 1) returning id into d_service;
  insert into departments (tenant_id, name, sort_order) values (v_tenant, 'ΒΟΗΘΟΙ / ΛΑΤΖΑ', 2) returning id into d_latza;
  insert into departments (tenant_id, name, sort_order) values (v_tenant, 'ΚΟΥΖΙΝΑ', 3) returning id into d_kouzina;

  -- Προσωπικό όπως στο χειρόγραφο πρόγραμμα (17-23/8). ΑΦΜ + αριθμός μητρώου
  -- συμπληρώνονται από τον owner/λογιστή πριν από το πρώτο export.
  insert into employees (tenant_id, department_id, full_name, sort_order) values
    (v_tenant, d_bar, 'Ρόκκας', 0),
    (v_tenant, d_bar, 'Πάρης', 1),
    (v_tenant, d_bar, 'Ορέστης', 2),
    (v_tenant, d_service, 'Τσιμπάνου', 0),
    (v_tenant, d_service, 'Γιαννούλας', 1),
    (v_tenant, d_service, 'Αναγνώστου', 2),
    (v_tenant, d_service, 'Πάτα', 3),
    (v_tenant, d_service, 'Ντέρη', 4),
    (v_tenant, d_service, 'Αδαμόπουλος', 5),
    (v_tenant, d_latza, 'Γευμωμάτη', 0),
    (v_tenant, d_latza, 'Παπαθανασίου', 1),
    (v_tenant, d_latza, 'Φάλιας', 2),
    (v_tenant, d_latza, 'Παπαχρήστος', 3),
    (v_tenant, d_kouzina, 'Μακρής', 0),
    (v_tenant, d_kouzina, 'Αργύρης', 1);

  -- Presets από τα μοτίβα του χαρτιού (start/end σε λεπτά από μεσάνυχτα).
  insert into shift_presets (tenant_id, label, kind, start_time, end_time, crosses_midnight, sort_order) values
    (v_tenant, '17–01', 'work', 1020, 60, true, 0),
    (v_tenant, '18–02', 'work', 1080, 120, true, 1),
    (v_tenant, '18–00', 'work', 1080, 0, true, 2),
    (v_tenant, '19:30–00:30', 'work', 1170, 30, true, 3),
    (v_tenant, '21–01', 'work', 1260, 60, true, 4),
    (v_tenant, '09–17', 'work', 540, 1020, false, 5),
    (v_tenant, '10–18', 'work', 600, 1080, false, 6),
    (v_tenant, 'ΡΕΠΟ', 'repo', null, null, false, 7),
    (v_tenant, 'ΑΔΕΙΑ', 'adeia', null, null, false, 8);

  raise notice 'OK — tenant % με 15 εργαζόμενους, 4 τμήματα, 9 presets.', v_tenant;
end $$;
