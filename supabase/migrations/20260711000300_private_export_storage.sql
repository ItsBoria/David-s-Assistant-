-- Export artifacts are private. Trusted server code uploads files and creates
-- short-lived signed URLs; there are intentionally no anon/authenticated object
-- policies for this bucket.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'work-week-exports',
  'work-week-exports',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
