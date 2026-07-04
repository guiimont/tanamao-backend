# Supabase Admin SQL

Use `apply_full_schema_now.sql` as the current source of truth for the Ta na Mao database.

Run it in the Supabase SQL Editor when:

- a screen fails with `Could not find the ... column ... in the schema cache`;
- a new table is missing;
- a new Supabase project needs to be prepared;
- the panel and site code were updated before the database.

The script is additive: it creates missing tables, adds missing columns, refreshes functions/triggers, seeds minimal settings and runs `notify pgrst, 'reload schema';`.

Older files in this folder are kept as narrow emergency fixes, but the full schema file should be preferred.
