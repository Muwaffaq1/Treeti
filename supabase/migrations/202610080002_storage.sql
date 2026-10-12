insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('ahd-evidence','ahd-evidence',false,10485760,array['application/pdf','application/json']),
       ('repayment-proofs-private','repayment-proofs-private',false,5242880,array['application/pdf','image/png','image/jpeg'])
on conflict (id) do nothing;
-- Uploads and short-lived download URLs are issued by authorized server routes.
-- No public object policy, no direct browser writes.
