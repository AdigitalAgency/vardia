-- Vardia — provisioning νέου καταστήματος (onboarding wizard)
-- Ο wizard ΕΙΝΑΙ το provisioning: ένα RPC στήνει tenant + membership owner +
-- τμήματα + προσωπικό + presets σε μία συναλλαγή. Χωρίς service-role key στον client.

create or replace function provision_tenant(
  p_name text,
  p_slug text,
  p_departments jsonb, -- [{"name":"BAR","employees":["Ρόκκας","Πάρης"]}]
  p_presets jsonb      -- [{"label":"17–01","kind":"work","start":1020,"end":60}]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_slug text;
  v_suffix int := 1;
  v_dept jsonb;
  v_dept_id uuid;
  v_dept_index int := 0;
  v_emp text;
  v_emp_index int;
  v_preset jsonb;
  v_preset_index int := 0;
  v_owned int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'NAME_REQUIRED';
  end if;

  -- Φρένο κατάχρησης: ένας λογαριασμός δεν στήνει απεριόριστα καταστήματα.
  select count(*) into v_owned
  from memberships where user_id = v_uid and role = 'owner';
  if v_owned >= 10 then
    raise exception 'TOO_MANY_TENANTS';
  end if;

  -- Μοναδικό slug: <slug>, <slug>-2, <slug>-3 …
  v_slug := nullif(regexp_replace(lower(coalesce(p_slug, '')), '[^a-z0-9-]', '', 'g'), '');
  if v_slug is null then
    v_slug := 'shop';
  end if;
  while exists (select 1 from tenants where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := regexp_replace(v_slug, '-\d+$', '') || '-' || v_suffix;
  end loop;

  insert into tenants (name, slug, created_by)
  values (trim(p_name), v_slug, v_uid)
  returning id into v_tenant;

  insert into tenant_products (tenant_id, product_key) values (v_tenant, 'scheduling');

  insert into memberships (user_id, tenant_id, role, status, invited_via)
  values (v_uid, v_tenant, 'owner', 'active', 'setup');

  for v_dept in select * from jsonb_array_elements(coalesce(p_departments, '[]'::jsonb))
  loop
    insert into departments (tenant_id, name, sort_order)
    values (v_tenant, trim(v_dept->>'name'), v_dept_index)
    returning id into v_dept_id;

    v_emp_index := 0;
    for v_emp in
      select value::text from jsonb_array_elements_text(coalesce(v_dept->'employees', '[]'::jsonb)) as value
    loop
      if coalesce(trim(v_emp), '') <> '' then
        insert into employees (tenant_id, department_id, full_name, sort_order)
        values (v_tenant, v_dept_id, trim(v_emp), v_emp_index);
        v_emp_index := v_emp_index + 1;
      end if;
    end loop;

    v_dept_index := v_dept_index + 1;
  end loop;

  for v_preset in select * from jsonb_array_elements(coalesce(p_presets, '[]'::jsonb))
  loop
    insert into shift_presets (
      tenant_id, label, kind, start_time, end_time, crosses_midnight, sort_order
    )
    values (
      v_tenant,
      trim(v_preset->>'label'),
      coalesce(v_preset->>'kind', 'work'),
      (v_preset->>'start')::smallint,
      (v_preset->>'end')::smallint,
      coalesce(
        (v_preset->>'end')::smallint <= (v_preset->>'start')::smallint,
        false
      ),
      v_preset_index
    );
    v_preset_index := v_preset_index + 1;
  end loop;

  insert into audit_log (tenant_id, actor, action, entity, entity_id, after)
  values (v_tenant, v_uid, 'provision', 'tenant', v_tenant::text,
          jsonb_build_object('name', trim(p_name), 'slug', v_slug));

  return jsonb_build_object('tenant_id', v_tenant, 'slug', v_slug);
end;
$$;

revoke all on function provision_tenant(text, text, jsonb, jsonb) from public;
grant execute on function provision_tenant(text, text, jsonb, jsonb) to authenticated;
