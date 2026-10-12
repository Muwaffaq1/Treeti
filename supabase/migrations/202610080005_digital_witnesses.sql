-- Add the explicit digital policy without changing earlier evidence rows.
alter table public.witness_attestations
  drop constraint witness_attestations_attestation_type_check;
alter table public.witness_attestations
  add constraint witness_attestations_attestation_type_check
  check (attestation_type in ('FORMATION','EXISTING_DEBT_ACKNOWLEDGEMENT','REVIEW_ONLY','DIGITAL_ACKNOWLEDGEMENT'));
