-- Public media bucket for post photos/videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/wav']
)
on conflict (id) do nothing;

create policy "media is publicly readable" on storage.objects
  for select using (bucket_id = 'media');

create policy "users upload to their own folder" on storage.objects
  for insert with check (
    bucket_id = 'media'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users update own media" on storage.objects
  for update using (
    bucket_id = 'media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users delete own media" on storage.objects
  for delete using (
    bucket_id = 'media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
