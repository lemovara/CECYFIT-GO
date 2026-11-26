alter table public.patient_meals add column photo_url text check (photo_url is null or (char_length(photo_url) <= 2048 and photo_url like 'https://www.themealdb.com/images/%'));
grant insert (photo_url) on public.patient_meals to authenticated;
