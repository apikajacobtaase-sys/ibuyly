SELECT
  current_database() AS database_name,
  to_regclass('public.users') AS users_table,
  to_regclass('public.products') AS products_table,
  to_regclass('public.wishlists') AS wishlists_table;