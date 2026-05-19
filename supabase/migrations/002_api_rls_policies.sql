-- Backend uses service_role (bypasses RLS). These policies allow the REST API
-- if you later switch to the anon key; tighten when Supabase Auth is wired.

create policy "patients_service_all"
  on public.patients for all
  using (true)
  with check (true);

create policy "visits_service_all"
  on public.visits for all
  using (true)
  with check (true);

create policy "sigma_service_all"
  on public.sigma_store for all
  using (true)
  with check (true);
