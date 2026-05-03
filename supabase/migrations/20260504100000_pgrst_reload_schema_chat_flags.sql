-- PostgREST keeps a schema cache; new RPCs can 404 with PGRST202 until the cache reloads.
-- See: https://postgrest.org/en/stable/references/connection.html#listen-notify
NOTIFY pgrst, 'reload schema';
