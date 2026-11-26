-- Existing recipes and assignments remain unchanged. New imports carry source and content identity.
alter table public.food_recipes
  add column source_key text,
  add column source_name text,
  add column source_url text,
  add column source_license text,
  add column origin_country text,
  add column content_digest text;
create unique index food_recipes_source_key_idx on public.food_recipes(source_key) where source_key is not null;
