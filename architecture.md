# **Ahd — Technical Architecture & Technology Stack**

## **1\. Architecture Summary**

Ahd should be built as a:

> **Mobile-first Next.js web application backed by PostgreSQL, with immutable agreement versions, append-only audit events, OTP-based identity verification, cryptographically sealed finalized records, durable background jobs, private document storage, and role-based participant access.**

The recommended architecture is deliberately **not microservices**.

For V1:

```
┌────────────────────────────────────────────┐
│                 USERS                      │
│                                            │
│ Lender  Borrower  Witness                  │
└──────────────────┬─────────────────────────┘
                   │ HTTPS
                   ▼
┌────────────────────────────────────────────┐
│           NEXT.JS WEB APPLICATION          │
│                  Vercel                    │
│                                            │
│ UI                                         │
│ Server Components                          │
│ Route Handlers                             │
│ Agreement Domain                           │
│ Validation                                 │
│ Authorization                              │
└──────────────┬───────────────┬─────────────┘
               │               │
               ▼               ▼
     ┌─────────────────┐   ┌──────────────────┐
     │    SUPABASE     │   │     INNGEST      │
     │                 │   │                  │
     │ Auth            │   │ Notifications    │
     │ PostgreSQL      │   │ PDF generation   │
     │ Private Storage │   │ Reminders        │
     │ RLS             │   │ Archival         │
     └────────┬────────┘   └─────────┬────────┘
              │                      │
              │                      ├──────────► Resend
              │                      │             Email
              │                      │
              │                      └──────────► SMS/WhatsApp
              │                                    later
              │
              ▼
     ┌────────────────────┐
     │ CRYPTOGRAPHIC      │
     │ EVIDENCE LAYER     │
     │                    │
     │ Version Hashes     │
     │ Hash-Chained Audit │
     │ AWS KMS Signatures │
     └────────┬───────────┘
              │
              ▼
     ┌────────────────────┐
     │ IMMUTABLE ARCHIVE  │
     │                    │
     │ Amazon S3          │
     │ Object Lock        │
     └────────────────────┘
```

For a portfolio/MVP deployment, the S3/KMS layer can initially be simplified.

For a production system people actually rely on as evidence, I would add it.

---

# **2\. Architecture Principles**

Ahd should obey several architectural rules.

## **Rule 1 — Agreements Are Versioned Records**

Never model an agreement as:

```
agreement
- amount
- dueDate
- borrower
```

where those fields can simply be updated.

Instead:

```
Agreement
    ↓
Version 1
    ↓
Version 2
    ↓
Version 3
```

Every material change creates another version.

Previous versions remain permanently readable.

---

## **Rule 2 — Approved Versions Become Immutable**

Suppose the borrower approves:

```
Amount: ₦300,000
Due date: 8 April 2027
```

The lender must never be able to execute:

```
UPDATE agreement
SET amount = 500000;
```

and retain the borrower's previous approval.

Instead:

```
Version 4
₦300,000
Borrower approved

            ↓ change

Version 5
₦500,000
Borrower approval required again
```

An approval always belongs to:

```
participant
+
agreement_version
+
version_hash
```

not merely:

```
agreement_id
```

---

## **Rule 3 — Financial State Changes Must Be Atomic**

Actions such as:

* approving,  
* finalizing,  
* confirming repayment,  
* settling,  
* forgiving debt,

must execute inside database transactions.

Do not perform them as:

```
request
↓
update agreement
↓
insert approval
↓
send email
```

where failure halfway through produces inconsistent state.

Authoritative state changes happen transactionally.

Emails/PDFs happen afterward.

---

## **Rule 4 — Audit History Is Append-Only**

Never update historical events.

Ahd should record:

```
AGREEMENT_CREATED

BORROWER_INVITED

BORROWER_REQUESTED_CHANGE

VERSION_CREATED

BORROWER_APPROVED

LENDER_APPROVED

WITNESS_ATTESTED

AGREEMENT_FINALIZED

REPAYMENT_PROPOSED

REPAYMENT_CONFIRMED

AGREEMENT_SETTLED
```

Once created, events cannot be edited or deleted through normal application permissions.

---

## **Rule 5 — Witnesses and Guarantors Are Different Domain Objects**

Ahd's source concept explicitly distinguishes a witness from someone who guarantees repayment.

Therefore the codebase should not use:

```
cosigner
```

as an alias for:

```
witness
```

V1 should not contain a `guarantor` role at all.

---

## **Rule 6 — Authentication Is Not the Same as Signature**

These are different concepts.

Authentication answers:

> Who is currently using this account?

Agreement approval answers:

> What did this person knowingly agree to?

Cryptographic sealing answers:

> Has this finalized record changed?

Ahd needs all three.

---

# **3\. Recommended Technology Stack**

| Layer | Technology | Purpose |
| ----- | ----- | ----- |
| Language | TypeScript | Shared type safety |
| Frontend | Next.js \+ React | Web product |
| UI | Tailwind CSS | Styling |
| Components | shadcn/ui | Accessible primitives |
| Forms | React Hook Form | Complex agreement forms |
| Validation | Zod | Request/domain validation |
| Database | PostgreSQL | Authoritative relational data |
| Database platform | Supabase | Managed Postgres |
| Authentication | Supabase Auth | OTP/passwordless identity |
| Authorization | PostgreSQL RLS | Participant isolation |
| Primary storage | Supabase Storage | Attachments/private files |
| Immutable archive | AWS S3 Object Lock | Final records |
| Cryptographic sealing | AWS KMS | Sign agreement hashes |
| Background jobs | Inngest | PDF/email/reminder workflows |
| Email | Resend | Invitations \+ notifications |
| SMS OTP | Twilio / configured Supabase provider | Identity verification |
| PDF | @react-pdf/renderer | Deterministic agreement PDF |
| Analytics | PostHog | Product analytics |
| Errors | Sentry | Monitoring |
| Testing | Vitest | Unit/integration |
| E2E | Playwright | Product-flow testing |
| Deployment | Vercel | Next.js hosting |
| CI/CD | GitHub Actions \+ Vercel | Automated deployments |

Supabase currently supports passwordless OTP, phone authentication/MFA, Postgres-integrated authorization, and RLS; RLS is especially useful here because debt records must be isolated participant-by-participant.

---

# **4\. Why PostgreSQL**

Ahd should use a relational database, not MongoDB/Firebase-style document storage as its primary data model.

The product contains strongly related entities:

```
Agreement
    ↓
Versions
    ↓
Participants
    ↓
Approvals
    ↓
Attestations
    ↓
Repayments
    ↓
Settlement
```

We need:

* foreign keys,  
* transactions,  
* uniqueness constraints,  
* locking,  
* immutable records,  
* check constraints,  
* row-level security.

PostgreSQL fits this model exceptionally well.

---

# **5\. Why a Modular Monolith**

Do not build:

```
auth-service

agreement-service

signature-service

witness-service

repayment-service

notification-service

document-service
```

for V1.

That introduces:

* multiple deployments,  
* distributed transactions,  
* network failures,  
* more secrets,  
* tracing complexity,  
* service authentication.

Instead:

```
Next.js application

        ↓

Modular domains
```

Conceptually:

```
src/modules/

    identity/
    agreements/
    invitations/
    witnessing/
    signatures/
    repayments/
    settlement/
    documents/
    notifications/
    audit/
```

Each module has boundaries but runs in the same application.

Extract services only if scale eventually justifies it.

---

# **6\. Recommended Repository Structure**

```
ahd/
│
├── src/
│
│   ├── app/
│   │   ├── (public)/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   ├── invite/
│   │   ├── verify/
│   │   └── api/
│
│   ├── modules/
│   │
│   │   ├── identity/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   └── infrastructure/
│   │
│   │   ├── agreements/
│   │   ├── invitations/
│   │   ├── witnessing/
│   │   ├── repayments/
│   │   ├── settlement/
│   │   ├── audit/
│   │   ├── documents/
│   │   └── notifications/
│
│   ├── components/
│   │   ├── ui/
│   │   ├── agreement/
│   │   ├── witness/
│   │   └── repayment/
│
│   ├── lib/
│   │   ├── supabase/
│   │   ├── crypto/
│   │   ├── pdf/
│   │   ├── email/
│   │   └── money/
│
│   ├── inngest/
│   │   ├── client.ts
│   │   └── functions/
│
│   └── types/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── tests/
│   └── seed.sql
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── architecture.md
│   ├── threat-model.md
│   ├── evidence-model.md
│   └── adr/
│
├── package.json
├── .env.example
└── README.md
```

---

# **7\. Agreement Domain Model**

Central object:

```
Agreement
```

But the `agreements` table should contain only high-level state.

## **agreements**

```
id UUID PK

public_id TEXT UNIQUE

created_by UUID

currency CHAR(3)

current_version_id UUID

status TEXT

original_principal_minor BIGINT

confirmed_repayment_minor BIGINT
forgiven_minor BIGINT
remaining_balance_minor BIGINT

created_at TIMESTAMPTZ
finalized_at TIMESTAMPTZ
settled_at TIMESTAMPTZ

updated_at TIMESTAMPTZ
```

Example `public_id`:

```
AHD-2026-00128
```

---

# **8\. Never Store Money as Float**

Do not store:

```
300000.00
```

as a JavaScript floating-point number.

Store money in minor units.

For NGN:

```
₦300,000.00
```

becomes:

```
30000000 kobo
```

Database:

```
BIGINT
```

Application:

```
type Money = {
  currency: "NGN";
  minor: bigint;
};
```

This prevents floating-point accounting errors.

---

# **9\. Agreement Participants**

## **agreement\_participants**

```
id UUID PK

agreement_id UUID FK

user_id UUID NULLABLE

role TEXT

display_name TEXT

phone TEXT
email TEXT

verification_status TEXT

joined_at TIMESTAMPTZ
created_at TIMESTAMPTZ
```

Possible roles:

```
LENDER
BORROWER
WITNESS
```

Do not add:

```
GUARANTOR
```

until a separate guarantee product is deliberately designed.

---

# **10\. Agreement Versions**

## **agreement\_versions**

This is one of the most important tables.

```
id UUID PK

agreement_id UUID FK

version_number INTEGER

created_by UUID

principal_minor BIGINT

currency CHAR(3)

agreement_date DATE

due_date DATE

repayment_type TEXT

terms_json JSONB

human_readable_text TEXT

canonical_payload JSONB

content_hash TEXT

change_reason TEXT

previous_version_id UUID NULLABLE

created_at TIMESTAMPTZ
```

Unique:

```
UNIQUE(agreement_id, version_number)
```

Once created:

> **No UPDATE. No DELETE.**

---

# **11\. Canonical Agreement Payload**

Every version should have a deterministic representation.

Example:

```
{
  "agreementId": "AHD-2026-00128",
  "version": 3,
  "currency": "NGN",
  "principalMinor": 30000000,
  "interestMinor": 0,
  "lender": {
    "participantId": "..."
  },
  "borrower": {
    "participantId": "..."
  },
  "repayment": {
    "type": "single",
    "dueDate": "2027-04-08"
  },
  "terms": []
}
```

Serialize deterministically.

Prefer an implementation compatible with JSON Canonicalization Scheme principles.

Then:

```
version_hash =
SHA-256(canonical_agreement_payload)
```

Example:

```
767b4d...
```

That hash becomes the identity of the exact terms.

---

# **12\. Why the Version Hash Matters**

Suppose:

```
Version 4
Hash: ABC123
```

Borrower approves:

```
ABC123
```

Lender approves:

```
ABC123
```

Witness attests:

```
ABC123
```

Someone changes the due date.

New content:

```
Hash: XYZ999
```

Existing approvals no longer match.

The system therefore knows:

> Nobody approved this new version.

---

# **13\. Approval Model**

## **participant\_approvals**

```
id UUID PK

agreement_id UUID

version_id UUID

participant_id UUID

role TEXT

action TEXT

version_hash TEXT

affirmation_text TEXT

affirmation_version TEXT

authentication_level TEXT

verified_contact TEXT

ip_address INET NULLABLE
user_agent TEXT

approved_at TIMESTAMPTZ

revoked_at TIMESTAMPTZ NULLABLE
```

Possible actions:

```
ACCEPTED
DECLINED
REQUESTED_CHANGE
```

---

# **14\. Versioned Affirmation Text**

Do not hard-code signature wording solely inside React.

Store its version.

Example:

```
BORROWER_ACCEPT_V1
```

Text:

> I acknowledge that I have reviewed this agreement and that these terms accurately represent the obligation I am agreeing to.

Approval stores:

```
affirmation_version = "BORROWER_ACCEPT_V1"
```

Years later, you can prove exactly what wording the user saw.

---

# **15\. Witness Attestations**

## **witness\_attestations**

```
id UUID PK

agreement_id UUID

version_id UUID

participant_id UUID

version_hash TEXT

attestation_type TEXT

presence_mode TEXT

attestation_text TEXT
attestation_text_version TEXT

verified_contact TEXT

authentication_level TEXT

attested_at TIMESTAMPTZ

ip_address INET NULLABLE
user_agent TEXT
```

Possible `attestation_type`:

```
FORMATION
EXISTING_DEBT_ACKNOWLEDGEMENT
REVIEW_ONLY
```

Possible `presence_mode`:

```
IN_PERSON
LIVE_REMOTE
LATER_ACKNOWLEDGEMENT
```

Exactly which combinations Ahd should formally support requires qualified scholarly/legal review.

The architecture supports the distinctions without deciding the religious ruling in code.

---

# **16\. Witness Permissions**

Witnesses should not automatically receive continuing access to:

* future repayments,  
* extension requests,  
* disputes,  
* borrower history.

A witness should normally receive access only to:

```
the agreement version
+
their attestation
+
the finalized agreement they witnessed
```

This is privacy by default.

---

# **17\. Invitation Model**

## **invitations**

```
id UUID PK

agreement_id UUID

participant_id UUID

version_id UUID NULLABLE

role TEXT

token_hash TEXT

destination TEXT

delivery_channel TEXT

status TEXT

expires_at TIMESTAMPTZ

claimed_at TIMESTAMPTZ NULLABLE

created_at TIMESTAMPTZ
```

Never store raw invitation tokens.

Generate:

```
256-bit random token
```

Send:

```
https://ahd.app/i/<raw-token>
```

Store:

```
SHA-256(raw-token)
```

in the database.

If the database leaks, attackers cannot simply use stored tokens.

---

# **18\. Witnesses Without Visible Account Creation**

Your original concept correctly identifies that forcing an uncle or family elder through lengthy signup could destroy the experience.

UX:

```
Open invitation
↓
Enter/confirm phone number
↓
OTP
↓
Review agreement
↓
Attest
```

The system may create an internal authenticated identity record behind the scenes.

The user does not need to complete a traditional:

```
Create username
Create password
Set profile photo
```

flow.

---

# **19\. Authentication Stack**

Use:

> **Supabase Auth**

Primary method:

```
Phone OTP
```

Fallback:

```
Email OTP
```

For important actions, use **step-up verification**.

Example:

User is already logged in.

Before signing:

```
Confirm this action with OTP.
```

Then capture:

```
authentication_level = STEP_UP_PHONE
```

Supabase supports phone OTP/MFA flows and multiple SMS providers; its documentation also recommends stronger assurance around phone-number-based authentication because phone numbers can be recycled.

---

# **20\. Important Signature Distinction**

Do not call every visual signature:

> Digital signature

in technical/legal documentation.

A user typing their name or drawing a signature is a **user electronic-signature interaction**.

The platform's cryptographic signature is a separate thing.

Architecture:

```
USER AUTHENTICATION
Phone OTP

        ↓

USER INTENT
Role-specific affirmation

        ↓

SIGNATURE RECORD
Version hash + timestamp + identity evidence

        ↓

PLATFORM CRYPTOGRAPHIC SEAL
AWS KMS signature
```

Nigeria's Evidence (Amendment) Act 2023 added specific provisions around electronic records and digital/electronic signatures, including authentication and detectability of alterations; the WIPO Lex entry confirms the 2023 amendment. This makes identity, alteration detection and evidence preservation important architectural concerns, but the implementation still requires Nigerian legal review before you claim a given flow is legally sufficient.

---

# **21\. Agreement State Machine**

Do not let React decide valid status transitions.

Implement a server-side domain state machine.

```
DRAFT

  ↓ send

AWAITING_BORROWER

  ├──────────────► DECLINED
  │
  ├──────────────► CHANGES_REQUESTED
  │                     │
  │                     ▼
  │               NEW_VERSION
  │                     │
  └─────────────────────┘
                ↓

AWAITING_APPROVAL

                ↓

AWAITING_WITNESSES

                ↓

FINALIZED

                ↓

ACTIVE

      ┌─────────┴───────────┐
      │                     │
      ▼                     ▼
   OVERDUE               DISPUTED
      │                     │
      └─────────┬───────────┘
                ▼
             SETTLED
```

---

# **22\. Transition Rules**

Example:

### **DRAFT → AWAITING\_BORROWER**

Requires:

```
borrower exists
principal > 0
due_date exists
interest = 0
agreement text generated
```

---

### **AWAITING\_BORROWER → AWAITING\_APPROVAL**

Requires:

```
borrower accepted latest version
```

---

### **AWAITING\_APPROVAL → AWAITING\_WITNESSES**

Requires:

```
lender approval
borrower approval

both target latest version_hash
```

---

### **AWAITING\_WITNESSES → FINALIZED**

Requires:

```
required witness configuration satisfied

every valid attestation targets same version

lender approval targets same version

borrower approval targets same version
```

---

# **23\. Any Material Change Invalidates Approval**

Function concept:

```
createNewVersion({
  agreementId,
  changedBy,
  changes
})
```

must automatically:

```
create new immutable version
↓
set current_version
↓
invalidate completion status
↓
require new approvals
↓
invalidate unused witness invitations
```

Do not literally delete historical approvals.

They remain as evidence that Version 4 was previously approved.

They simply do not apply to Version 5\.

---

# **24\. Finalization Must Be a Single Transaction**

Conceptually:

```
BEGIN;

LOCK agreement;

verify current status;

verify borrower approval;

verify lender approval;

verify witness requirements;

verify every approval hash =
current version hash;

insert AGREEMENT_FINALIZED event;

update agreement status;

insert outbox event;

COMMIT;
```

If any requirement fails:

```
ROLLBACK
```

No partially finalized agreements.

---

# **25\. Audit Event System**

## **agreement\_events**

```
id UUID PK

agreement_id UUID

sequence_number BIGINT

event_type TEXT

actor_participant_id UUID NULLABLE

version_id UUID NULLABLE

payload JSONB

previous_hash TEXT

event_hash TEXT

created_at TIMESTAMPTZ
```

Unique:

```
UNIQUE(agreement_id, sequence_number)
```

---

# **26\. Hash-Chained Event Log**

First event:

```
H1 = SHA256(event_1)
```

Next event:

```
H2 = SHA256(H1 + event_2)
```

Then:

```
H3 = SHA256(H2 + event_3)
```

So:

```
event 1
   ↓
hash 1
   ↓
event 2
   ↓
hash 2
   ↓
event 3
   ↓
hash 3
```

If someone modifies event 2:

```
hash 2 changes

therefore hash 3 no longer validates.
```

This produces tamper evidence.

---

# **27\. Do Not Allow Normal UPDATE/DELETE on Audit Events**

Database protections should prevent:

```
UPDATE agreement_events ...
```

and:

```
DELETE FROM agreement_events ...
```

for normal application roles.

Only inserts are permitted.

Similarly:

```
agreement_versions
approvals
attestations
```

should be append-only after creation.

---

# **28\. Cryptographic Platform Seal**

Hash chaining proves internal consistency.

But if someone compromises the database and recalculates every hash, they could theoretically rewrite the chain.

Therefore production Ahd should externally sign finalized evidence.

When finalizing:

```
Agreement snapshot
+
participant approvals
+
witness attestations
+
audit root hash

        ↓

canonical manifest

        ↓

SHA-256

        ↓

AWS KMS SIGN
```

AWS KMS can use an asymmetric signing key where the private key stays protected by KMS and the corresponding public key can be used to verify that the signed digest has not changed.

---

# **29\. Evidence Manifest**

Create:

```
manifest.json
```

Example:

```
{
  "agreementId": "AHD-2026-00128",
  "version": 4,
  "versionHash": "...",
  "auditRoot": "...",
  "finalizedAt": "2027-04-08T13:45:22Z",
  "participants": [
    {
      "role": "LENDER",
      "approvalId": "..."
    },
    {
      "role": "BORROWER",
      "approvalId": "..."
    }
  ],
  "attestations": [
    "..."
  ],
  "pdfHash": "...",
  "signatureAlgorithm": "..."
}
```

Sign the digest.

Store:

```
manifest
signature
key identifier
signing algorithm
```

---

# **30\. User Signature vs Platform Seal**

This distinction must be explicit.

```
Abdullah's confirmation

proves:
"the authenticated Abdullah account performed this action"
```

while:

```
Ahd cryptographic seal

proves:
"this finalized digital package has not changed since Ahd sealed it"
```

The platform seal does **not** replace the user's consent record.

---

# **31\. Immutable Artifact Storage**

For MVP:

```
Supabase private Storage
+
database hash
```

For production hardening:

> **Amazon S3 Object Lock**

Store:

```
final.pdf
manifest.json
manifest.sig
audit.json
```

S3 Object Lock supports write-once/read-many retention and can prevent protected object versions from being overwritten or deleted; Compliance mode is specifically designed so even privileged/root users cannot remove protected objects before retention expires.

Do not select the actual retention period until Nigerian legal/data-protection counsel determines the appropriate policy.

---

# **32\. Generated Agreement PDF**

Use:

> `@react-pdf/renderer`

The PDF should be generated from the **canonical finalized data**, never by scraping the UI.

Pipeline:

```
Final version
      ↓
Evidence records
      ↓
PDF model
      ↓
Render PDF
      ↓
SHA-256(PDF)
      ↓
Add PDF hash to evidence manifest
      ↓
Seal/archive
```

---

# **33\. PDF Contents**

The PDF should contain:

```
AHD branding

Agreement ID

Finalization timestamp

Version number

Lender identity

Borrower identity

Principal

Interest: ₦0

Repayment date

Terms

Lender confirmation

Borrower confirmation

Witness attestations

Timeline summary

Verification QR code

Version hash

Platform seal reference
```

---

# **34\. QR Verification**

Footer:

```
Verify this record:

ahd.app/verify/AHD-2026-00128
```

QR points there.

Public verification should NOT reveal:

```
loan amount
phone numbers
addresses
repayment history
```

to random visitors.

Unauthenticated response could show:

```
Record found

Agreement ID:
AHD-2026-00128

Finalized:
8 April 2027

Integrity:
Verified
```

Participants can authenticate to see the actual document.

---

# **35\. Repayment Model**

## **repayments**

```
id UUID PK

agreement_id UUID

proposed_by_participant_id UUID

amount_minor BIGINT

currency CHAR(3)

payment_date DATE

payment_method TEXT

external_reference TEXT NULLABLE

proof_artifact_id UUID NULLABLE

note TEXT NULLABLE

status TEXT

created_at TIMESTAMPTZ
confirmed_at TIMESTAMPTZ NULLABLE
```

Status:

```
PROPOSED
CONFIRMED
DISPUTED
CANCELLED
```

---

# **36\. Repayment Confirmation**

## **repayment\_confirmations**

```
id UUID PK

repayment_id UUID

participant_id UUID

action TEXT

note TEXT NULLABLE

created_at TIMESTAMPTZ
```

The amount does not affect balance until:

```
status = CONFIRMED
```

---

# **37\. Never Directly Edit Balance**

Do not make balance the ultimate source of truth.

Compute:

```
principal
-
confirmed repayments
-
confirmed forgiveness
=
remaining balance
```

You may cache the result for performance.

But it must be derivable from immutable financial events.

---

# **38\. Financial Invariants**

Database/domain tests must enforce:

```
repayment > 0
```

```
forgiveness >= 0
```

```
confirmed repayment <= remaining balance
```

```
remaining balance >= 0
```

```
interest = 0
```

for the qard template.

---

# **39\. Forgiveness Model**

## **debt\_adjustments**

```
id UUID

agreement_id UUID

type TEXT

amount_minor BIGINT

proposed_by UUID

reason TEXT NULLABLE

status TEXT

created_at TIMESTAMPTZ
confirmed_at TIMESTAMPTZ
```

Types:

```
PARTIAL_FORGIVENESS
FULL_FORGIVENESS
```

Never represent forgiveness as:

```
negative repayment
```

It has different meaning and should remain auditable.

---

# **40\. Amendment Architecture**

Do not edit the existing contract.

## **amendments**

```
id UUID

agreement_id UUID

from_version_id UUID

to_version_id UUID

proposed_by UUID

reason TEXT

status TEXT

created_at TIMESTAMPTZ
```

An approved amendment creates:

```
agreement_version N+1
```

---

# **41\. Due-Date Extension Example**

Current:

```
Version 3
Due: 8 April
```

Borrower requests:

```
1 June
```

System:

```
Amendment proposal
↓
Lender accepts
↓
Version 4
Due: 1 June
↓
Required participants confirm Version 4
```

Version 3 remains forever visible.

---

# **42\. Settlement Architecture**

Settlement should be explicit.

Do not automatically mark agreement settled solely because calculated balance hits zero.

Flow:

```
balance = 0
↓
status = SETTLEMENT_PENDING
↓
lender confirms
↓
borrower acknowledges
↓
SETTLED
```

Generate:

```
settlement certificate
```

and append:

```
AGREEMENT_SETTLED
```

to audit log.

---

# **43\. Authorization Architecture**

There are several layers.

## **Layer 1 — Authentication**

Supabase Auth identifies current user.

---

## **Layer 2 — Agreement Membership**

User must exist in:

```
agreement_participants
```

---

## **Layer 3 — Role Permission**

Example:

Lender:

```
may propose agreement
may propose amendments
may confirm repayments
```

Borrower:

```
may approve
may request changes
may propose repayment
```

Witness:

```
may view attested version
may attest
```

---

## **Layer 4 — Agreement State**

Even the lender cannot edit terms after finalization.

Role permission does not override domain state.

---

# **44\. Row-Level Security**

Every sensitive table should have RLS.

Supabase's RLS runs authorization at the Postgres level rather than relying only on UI/API checks. Its current guidance recommends enabling RLS and explicitly controlling grants on every exposed table.

Example concept:

```
CREATE POLICY participant_read_agreement
ON agreements
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM agreement_participants p
    WHERE p.agreement_id = agreements.id
      AND p.user_id = auth.uid()
  )
);
```

---

# **45\. Sensitive Mutations Should Still Go Through Server**

Do not let the browser freely perform:

```
finalize agreement
settle agreement
confirm repayment
create attestation
```

directly against tables.

Use:

```
Browser

   ↓

Next.js Route Handler

   ↓

validate

   ↓

authorize

   ↓

database transaction / RPC
```

RLS remains defense-in-depth.

---

# **46\. API Design**

Recommended routes:

```
POST /api/agreements

GET /api/agreements/:id

POST /api/agreements/:id/send

POST /api/agreements/:id/versions

POST /api/agreements/:id/request-change

POST /api/agreements/:id/approve

POST /api/agreements/:id/decline

POST /api/agreements/:id/witnesses

POST /api/attestations

POST /api/agreements/:id/finalize

POST /api/agreements/:id/repayments

POST /api/repayments/:id/confirm

POST /api/repayments/:id/dispute

POST /api/agreements/:id/amendments

POST /api/agreements/:id/forgiveness

POST /api/agreements/:id/settle

GET /api/agreements/:id/pdf

GET /api/verify/:publicId
```

---

# **47\. Request Validation**

Every route:

```
request
↓
Zod schema
↓
authentication
↓
authorization
↓
domain validation
↓
transaction
```

Example:

```
const repaymentSchema = z.object({
  agreementId: z.string().uuid(),
  amountMinor: z.coerce.bigint().positive(),
  paymentDate: z.coerce.date(),
  reference: z.string().max(100).optional(),
});
```

Never trust client-calculated:

```
remainingBalance
status
role
agreementVersion
```

Those come from server state.

---

# **48\. Optimistic Concurrency**

Two participants may interact simultaneously.

Every command should specify:

```
expectedVersionId
```

Example:

Borrower opened Version 4\.

Meanwhile lender creates Version 5\.

Borrower presses Accept.

Server sees:

```
expected: Version 4
current: Version 5
```

Reject:

> This agreement changed since you opened it.

This prevents stale approvals.

---

# **49\. Idempotency**

Important actions need:

```
Idempotency-Key
```

Example:

Mobile network is slow.

User presses:

**Confirm repayment**

twice.

Server must not create two repayments.

Table:

## **idempotency\_keys**

```
key TEXT
actor_id UUID
operation TEXT
response JSONB
created_at TIMESTAMPTZ
expires_at TIMESTAMPTZ
```

---

# **50\. Transactional Outbox**

Never couple authoritative agreement state to email delivery.

Problem:

```
agreement finalized successfully

↓

server crashes before email sent
```

Solution:

Inside finalization transaction:

```
insert agreement event

insert outbox event

commit
```

Table:

## **outbox\_events**

```
id UUID

event_type TEXT

aggregate_id UUID

payload JSONB

status TEXT

created_at TIMESTAMPTZ
processed_at TIMESTAMPTZ
```

Worker processes afterward.

---

# **51\. Background Jobs**

Use:

> **Inngest**

Good use cases:

```
send borrower invitation

send witness invitation

generate PDF

archive evidence bundle

send due reminder

retry failed email

create settlement certificate

send amendment notifications
```

Inngest currently integrates directly with Next.js and persists completed workflow steps so temporary failures can retry without restarting successful earlier work.

---

# **52\. Never Background Critical Consent**

Do NOT use a background job to decide:

```
borrower approved
```

or:

```
agreement finalized
```

Those operations must return synchronously after committing to the authoritative database.

Background jobs handle side effects.

---

# **53\. Notifications**

## **V1**

Use:

> **Resend**

for:

```
borrower invitations
witness invitations
approval requests
finalization notices
repayment confirmation
settlement
due-date reminders
```

Resend exposes delivery webhooks/retries that can be recorded to track whether an invitation was delivered or bounced.

---

# **54\. Notification Table**

## **notifications**

```
id UUID

user_id UUID NULLABLE

participant_id UUID NULLABLE

agreement_id UUID NULLABLE

type TEXT

channel TEXT

destination TEXT

provider_message_id TEXT

status TEXT

created_at TIMESTAMPTZ
sent_at TIMESTAMPTZ
delivered_at TIMESTAMPTZ
failed_at TIMESTAMPTZ
```

---

# **55\. Notification Delivery Is Not Agreement State**

If email fails:

```
Agreement remains finalized.
```

Correct behavior:

```
Notification:
FAILED

Agreement:
FINALIZED
```

User gets:

**Resend notification**

---

# **56\. Reminder Engine**

Start simple.

Daily scheduled workflow:

```
once per day
↓
query active agreements

due in:
30 days
7 days
1 day

or overdue
↓
generate eligible reminders
↓
send
```

Every reminder event should have a uniqueness constraint:

```
UNIQUE(
 agreement_id,
 reminder_type,
 target_date
)
```

so retries cannot send duplicates.

---

# **57\. File Storage**

Supabase Storage:

```
repayment-proofs-private

profile-images

temporary-documents
```

Supabase Storage can use RLS-based access policies and private signed URLs.

Finalized evidence packages should move to the stronger immutable archive architecture described earlier.

---

# **58\. Private Storage Paths**

Example:

```
agreements/
  <agreement_uuid>/
      repayments/
          <repayment_uuid>.pdf
```

Do not use:

```
ahmad-ibrahim-300000-naira.pdf
```

in object keys.

That unnecessarily exposes PII in logs/storage metadata.

---

# **59\. Data Protection Architecture**

Ahd processes sensitive financial and identity data.

Nigeria's Data Protection Act 2023 is administered by the NDPC and requires personal-data processing to be fair, lawful, accountable and appropriately protected.

Therefore design for:

```
data minimization

purpose limitation

controlled access

retention policies

deletion workflows

auditability

encryption

incident response
```

The exact lawful basis, retention periods, cross-border processing requirements and data-subject workflows should be reviewed professionally before public launch.

---

# **60\. Data Classification**

## **Highly Sensitive**

```
loan amount
repayment history
signatures
phone numbers
email addresses
identity documents
```

## **Sensitive**

```
agreement status
witness relationships
notifications
IP/device metadata
```

## **Public/Safe**

Almost nothing related to an agreement.

Even verification pages should minimize disclosure.

---

# **61\. Encryption**

### **In Transit**

```
TLS/HTTPS everywhere
```

### **At Rest**

Use managed database/storage encryption.

### **Additional Application Encryption**

Potentially encrypt particularly sensitive fields:

```
government ID numbers
identity verification responses
```

with envelope encryption/KMS.

Do not build custom cryptography.

---

# **62\. Secret Management**

Secrets:

```
SUPABASE_SERVICE_ROLE_KEY

RESEND_API_KEY

AWS_ACCESS_KEY_ID

AWS_SECRET_ACCESS_KEY

KMS_KEY_ID

INNGEST_SIGNING_KEY
```

Server-only.

Never prefix them with:

```
NEXT_PUBLIC_
```

Use Vercel environment secrets.

---

# **63\. Rate Limiting**

Protect:

```
OTP send
OTP verify
invitation lookup
login
agreement creation
PDF generation
public verification
```

especially against:

```
OTP abuse
brute force
email/SMS cost attacks
token guessing
```

Use:

```
Upstash Redis + @upstash/ratelimit
```

or equivalent.

---

# **64\. Invitation Security**

Invitation token:

```
minimum 256-bit entropy
```

The invitation itself is **not authentication**.

Correct:

```
Invitation token
+
OTP verification
=
access
```

Not:

```
I have link
=
I am witness
```

---

# **65\. Signature Ceremony**

For high-value actions:

```
Review exact version
↓
scroll/read terms
↓
role-specific affirmation
↓
step-up OTP
↓
Confirm & Sign
↓
server verifies current version
↓
create immutable record
```

Never sign silently.

---

# **66\. Example Borrower Ceremony**

Screen:

```
You are confirming:

Principal
₦300,000

Due
8 April 2027

Interest
₦0

Agreement
Version 4
```

Checkbox:

```
I have reviewed these terms.
```

Affirmation:

> I acknowledge that these terms accurately represent the obligation I am agreeing to.

Then:

**Send verification code**

OTP:

```
482931
```

CTA:

**Confirm Agreement**

---

# **67\. Example Witness Ceremony**

First:

> You are acting as a witness, not a repayment guarantor.

Checkbox:

```
I understand that I am not agreeing to repay this debt.
```

Then select:

```
What did you personally witness?
```

Then show exact version.

Then OTP.

Then:

**Submit Attestation**

---

# **68\. Audit Metadata**

For important events store:

```
server timestamp

actor ID

participant ID

role

agreement version

version hash

authentication method

IP address where appropriate

user-agent

affirmation version

request ID

session ID
```

But do not collect data merely because it might be useful.

IP/device metadata is personal data and requires a defined purpose and retention policy.

---

# **69\. Server Timestamps Only**

Never trust:

```
new Date()
```

from browser as evidence time.

Authoritative timestamp:

```
PostgreSQL NOW()
```

Browser time is presentation only.

---

# **70\. Time Handling**

Database timestamps:

```
TIMESTAMPTZ
```

stored UTC.

Contractual repayment date:

```
DATE
```

Example:

```
2027-04-08
```

because a contractual due date is normally a calendar date, not:

```
2027-04-08T00:00:00Z
```

---

# **71\. Analytics**

Use:

> PostHog

but maintain an allowlist.

Allowed:

```
agreement_started

agreement_sent

borrower_reviewed

change_requested

agreement_finalized

witness_invited

witness_completed

repayment_recorded

settlement_completed
```

Never send:

```
loan amount

person names

phone

email

full agreement terms

signature

repayment proof
```

to analytics.

---

# **72\. Error Monitoring**

Use:

> Sentry

Capture:

```
route

error code

agreement ID pseudonym/reference

state

operation
```

Do not attach the full agreement payload.

Configure PII scrubbing.

---

# **73\. Domain Error Codes**

Avoid generic:

```
Something went wrong
```

Internal errors:

```
AGREEMENT_VERSION_STALE

BORROWER_NOT_APPROVED

WITNESS_REQUIREMENTS_INCOMPLETE

INVALID_STATE_TRANSITION

REPAYMENT_EXCEEDS_BALANCE

PARTICIPANT_NOT_AUTHORIZED

INVITATION_EXPIRED

SIGNATURE_VERIFICATION_REQUIRED
```

UI maps these to human messages.

---

# **74\. Public Verification Architecture**

Endpoint:

```
GET /api/verify/AHD-2026-00128
```

Backend:

```
find evidence manifest
↓
calculate expected digest
↓
verify KMS signature
↓
verify PDF hash
↓
return verification result
```

Response:

```
{
  "record": "AHD-2026-00128",
  "status": "verified",
  "finalizedAt": "...",
  "version": 4
}
```

No sensitive terms.

---

# **75\. No Blockchain Required**

Do not introduce blockchain for the MVP.

You already have:

```
immutable versions

append-only audit log

hash chaining

external KMS signature

WORM artifact storage
```

Blockchain would add:

* infrastructure,  
* wallet concepts,  
* privacy challenges,  
* transaction costs,  
* irreversible PII problems,

without solving the core UX problem.

---

# **76\. Failure Architecture**

## **Database Commit Fails**

Action:

```
not completed
```

No success UI.

---

## **Email Fails**

Agreement state remains valid.

Retry email.

---

## **PDF Generation Fails**

Agreement remains finalized.

Display:

> PDF generation temporarily unavailable.

Background job retries.

---

## **S3 Archival Fails**

Mark:

```
archive_status = RETRYING
```

Raise operational alert.

Do not claim:

> Permanently archived

until archive succeeds.

---

## **KMS Signing Fails**

For production:

Do not declare final evidence package sealed.

Possible state:

```
FINALIZATION_PROCESSING
```

retry signing.

---

## **Participant Double-Clicks Sign**

Idempotency prevents duplicate signature record.

---

## **Browser Disconnects After Signing**

On reconnect:

```
GET current agreement state
```

Server determines whether signature actually succeeded.

---

# **77\. Testing Strategy**

## **Unit Tests**

Test:

```
state transitions

money arithmetic

agreement canonicalization

version hashing

audit-chain hashing

witness requirement checks

approval invalidation

settlement calculation

forgiveness calculation

authorization rules
```

---

# **78\. Critical Hash Test**

Fixture:

```
agreement payload X
```

must always produce:

```
same expected hash
```

on:

```
local

CI

production
```

Never change canonicalization rules silently.

---

# **79\. Property-Based Financial Tests**

Using something like:

```
fast-check
```

verify:

```
remaining balance never negative

repayment cannot increase debt

forgiveness cannot increase debt

settled agreement always has zero balance

unconfirmed repayment never changes balance
```

---

# **80\. Integration Tests**

Against test Postgres:

```
create agreement

create version

approve

request change

version approvals invalidated

witness attestation

finalization

repayment confirmation

settlement
```

---

# **81\. RLS Security Tests**

Create:

```
User A
User B
User C
```

Agreement belongs to A+B.

Verify C cannot:

```
read agreement

read PDF

read repayments

read witness names

submit changes
```

This test suite is essential.

---

# **82\. E2E Tests**

Playwright:

### **Flow 1**

```
Lender
↓
Create
↓
Borrower Accept
↓
Witnesses Attest
↓
Finalize
```

### **Flow 2**

```
Borrower requests changes
↓
Lender updates
↓
old approval invalid
↓
new approval
```

### **Flow 3**

```
Record repayment
↓
confirm
↓
balance updates
```

### **Flow 4**

```
final payment
↓
settle
↓
certificate
```

---

# **83\. Security Tests**

Test:

```
expired invite

replayed invite

replayed OTP session

stale version approval

forged participant ID

IDOR attacks

modified PDF

modified manifest

incorrect KMS signature

duplicate payment request
```

---

# **84\. Deployment**

## **Application**

```
Vercel
```

Deploy:

```
Next.js UI
Route handlers
Inngest endpoint
webhooks
```

---

## **Database**

```
Supabase PostgreSQL
```

Environments:

```
Development

Preview/Staging

Production
```

Never use production database for preview branches.

---

# **85\. CI/CD**

```
Feature Branch

↓ Pull Request

ESLint
TypeScript
Unit Tests
DB Tests
RLS Tests

↓

Build

↓

Vercel Preview

↓

Playwright E2E

↓

Manual approval

↓

Merge

↓

Production
```

---

# **86\. Database Migrations**

Never modify production schema manually.

Use:

```
supabase/migrations/
```

Example:

```
20261008_create_agreements.sql

20261009_create_agreement_versions.sql

20261010_create_audit_events.sql
```

Migrations live in Git.

---

# **87\. Backups**

For real deployment:

```
managed database backups

point-in-time recovery

periodic encrypted logical backup

immutable finalized artifacts separately archived
```

Database backup and evidence archive solve different problems.

---

# **88\. Architecture Decision Records**

For a portfolio project, add:

```
docs/adr/
```

Examples:

```
001-postgres-over-document-db.md

002-append-only-agreement-versions.md

003-no-blockchain.md

004-otp-step-up-signature-flow.md

005-kms-platform-seal.md

006-worm-evidence-archive.md

007-modular-monolith.md
```

Each ADR:

```
Context

Decision

Alternatives

Trade-offs

Consequences
```

This will make Ahd much stronger as a portfolio case study.

---

# **89\. MVP vs Production Architecture**

## **Portfolio / MVP**

Use:

```
Next.js

Vercel

Supabase Auth

Supabase PostgreSQL

Supabase Storage

Resend

Inngest

@react-pdf/renderer

Node crypto SHA-256

PostHog

Sentry
```

Build:

```
agreement versioning

hashes

append-only audit events

OTP approvals

witness attestations

PDF

repayments

settlement
```

This is enough to demonstrate the complete architecture.

---

# **90\. Production-Hardening Layer**

Before inviting the public to rely on Ahd as an evidentiary system, add:

```
AWS KMS asymmetric signing

S3 Object Lock

formal retention policy

stronger fraud controls

step-up authentication everywhere

identity verification where justified

security audit

penetration testing

disaster recovery plan

legal contract review

Nigerian data-protection review

qualified Islamic scholarly review
```

The architecture should support this progression rather than requiring a rewrite.

---

# **91\. Recommended Build Order**

## **Phase 1 — Foundation**

```
Next.js

Supabase

Auth

RLS

Core schema

Design system
```

---

## **Phase 2 — Agreement Engine**

```
Agreement creation

Participants

Agreement versions

Canonical hashes

State machine

Audit events
```

---

## **Phase 3 — Mutual Consent**

```
Borrower invitation

OTP

Review

Request changes

Approvals

Version invalidation
```

---

## **Phase 4 — Witness System**

```
Witness invitation

Witness education

Witness types

Attestation

OTP confirmation
```

---

## **Phase 5 — Finalization**

```
Validation

Atomic finalization

Evidence manifest

Agreement ID

PDF
```

---

## **Phase 6 — Repayments**

```
Record payment

Confirm payment

Dispute payment

Receipts

Balance
```

---

## **Phase 7 — Settlement**

```
Final balance

Settlement confirmation

Settlement certificate
```

---

## **Phase 8 — Reliability**

```
Inngest

Outbox

Email delivery

Retries

Reminder engine
```

---

## **Phase 9 — Evidence Hardening**

```
KMS

Signed manifests

S3 Object Lock

Public integrity verifier
```

---

# **92\. Final Recommended Stack**

The stack I would actually use to build Ahd today is:

```
FRONTEND
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod

BACKEND
Next.js Route Handlers
TypeScript domain modules

DATABASE
Supabase PostgreSQL
Postgres transactions
Postgres RLS

AUTH
Supabase Auth
Phone OTP
Email OTP
Step-up verification

PRIMARY FILE STORAGE
Supabase Storage

BACKGROUND WORK
Inngest

EMAIL
Resend

SMS / OTP
Supabase-supported SMS provider / Twilio

PDF
@react-pdf/renderer

CRYPTOGRAPHY
SHA-256
RFC-style canonical JSON
AWS KMS for production signing

IMMUTABLE ARCHIVE
AWS S3 Object Lock

ANALYTICS
PostHog

ERROR MONITORING
Sentry

TESTING
Vitest
Playwright
fast-check

HOSTING
Vercel

SOURCE CONTROL / CI
GitHub
GitHub Actions
Vercel Preview Deployments
```

---

# **93\. Most Important Architecture Decision**

The central design should be:

```
Ahd does not store "the contract."

Ahd stores:

Agreement
+
Immutable Versions
+
Identity Evidence
+
Approvals
+
Witness Attestations
+
Audit Events
+
Cryptographic Proof
+
Repayment Events
+
Amendments
+
Settlement
```

and from those records it can construct:

> **Exactly what happened.**

That is the system Ahd actually needs to be.

The UI is simply a human-friendly interface over that evidence model.

