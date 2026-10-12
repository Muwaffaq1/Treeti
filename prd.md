# **Ahd — Product Requirements Document**

## **Product Summary**

**Ahd** is a mobile-first web application for documenting private interest-free debt agreements between individuals.

The product enables a lender and borrower to:

* define the terms of a debt,  
* explicitly review and approve those terms,  
* invite witnesses,  
* capture witness attestations,  
* preserve an immutable history of what was agreed,  
* generate a downloadable agreement,  
* record repayments,  
* acknowledge settlement,  
* and maintain a private evidence trail.

The product is inspired by the principles described in Surah Al-Baqarah 2:282 around documenting debts, establishing clarity, involving witnesses, and reducing future disputes. The source concept also explicitly distinguishes a **witness** from a **guarantor**, and distinguishes witnessing the original agreement from merely reviewing or acknowledging an already-existing debt.

Ahd is **not**:

* a lender,  
* a bank,  
* a credit marketplace,  
* a collections company,  
* a public credit bureau,  
* or a money-transfer platform.

The MVP does not move money.

Its purpose is to create a trustworthy record of what people agreed to.

---

# **1\. Problem Definition**

## **Problem Statement**

Informal loans between friends, relatives, colleagues, and members of a community are often based on trust.

The problem is that trust alone does not preserve the details of an agreement.

Months after money changes hands, disagreements can emerge around:

* the amount originally borrowed,  
* when repayment was due,  
* whether repayment was meant to happen once or in installments,  
* whether part of the debt was already repaid,  
* whether the lender granted an extension,  
* whether a third party witnessed the agreement,  
* whether someone actually agreed to a later amendment,  
* or whether a screenshot or WhatsApp message accurately represents the original arrangement.

The underlying problem is therefore not necessarily dishonesty.

It is **memory, ambiguity, evidence, consent, and changing circumstances**.

Ahd should make it easy for two people to create a clear record while the agreement is fresh, then preserve that record in a way that cannot be silently rewritten later.

The fundamental product promise is:

> **Make an agreement. Make it clear. Preserve what everyone agreed to.**

---

## **Core Product Thesis**

The strongest version of Ahd is not:

> “An Islamic loan app.”

It is:

> **A trusted agreement system for people who want to protect relationships from financial misunderstandings.**

Islamic principles shape the behavior of the product, but the product should avoid making unsupported claims such as:

> “This agreement is automatically Sharia-compliant.”

or:

> “This agreement is automatically legally enforceable.”

The source concept explicitly calls for qualified Islamic and Nigerian legal review before making those claims.

---

## **Why Now**

Several factors make this product viable.

### **Informal financial relationships are already digital**

People increasingly coordinate personal loans through:

* WhatsApp,  
* SMS,  
* bank-transfer screenshots,  
* voice notes,  
* email,  
* and messaging applications.

These tools record fragments of a transaction but do not create a coherent agreement.

Ahd can turn those fragments into one structured record.

---

### **Electronic consent is familiar**

Users are already accustomed to:

* OTP verification,  
* digital signatures,  
* email confirmations,  
* shareable links,  
* electronic receipts.

Ahd can use these familiar interactions without requiring users to understand complex legal software.

---

### **The workflow can be implemented without becoming a financial institution**

The source concept deliberately avoids moving money, underwriting borrowers, public reputation scoring, or lending directly.

That keeps the initial product focused on:

**agreement creation \+ consent \+ witnessing \+ record preservation \+ repayment evidence.**

---

## **Who Is Affected**

### **Primary User — Lender**

Someone lending money privately.

Examples:

* sibling lending to sibling,  
* friend lending to friend,  
* parent lending to child,  
* business owner helping an employee,  
* community member supporting another person.

The lender wants:

* clarity,  
* evidence,  
* reduced awkwardness,  
* reliable repayment records.

---

### **Primary User — Borrower**

Someone receiving an interest-free private loan.

The borrower wants:

* confidence that the lender cannot secretly change the terms,  
* visibility into the exact amount owed,  
* a record of repayments,  
* a way to request amendments or extensions,  
* proof when the debt is fully settled.

The borrower must not be treated as a passive object in the workflow.

The source concept emphasizes that the borrower should explicitly review and acknowledge the debt rather than allowing the lender to unilaterally create a binding-looking record.

---

### **Secondary User — Witness**

A person invited to attest to what they personally witnessed.

A witness is not automatically:

* a guarantor,  
* a co-borrower,  
* a backup payer.

The UI must repeatedly reinforce this distinction.

---

### **Secondary User — Mediator**

Potential V2 user.

A trusted third party helping lender and borrower resolve:

* misunderstanding,  
* hardship,  
* repayment extensions,  
* disputed payment records.

---

### **Secondary User — Scholar / Legal Reviewer**

Not necessarily an application user.

However, product flows, agreement language, witnessing terminology, identity processes, and evidence design should be reviewable by qualified experts.

---

## **Current Workarounds**

Users currently rely on:

* verbal agreements,  
* WhatsApp conversations,  
* bank-transfer descriptions,  
* screenshots,  
* handwritten notes,  
* informal witness recollection,  
* spreadsheets,  
* Google Docs,  
* generic electronic-signature platforms.

These approaches fail because information is fragmented.

Example:

A lender may have:

* one WhatsApp message showing ₦300,000,  
* a bank transfer showing ₦300,000,  
* another message saying “pay me in six months,”  
* a voice note describing different terms.

The borrower may have a different interpretation.

Ahd should reduce the number of sources of truth to **one agreed record**.

---

## **Product Principles**

### **1\. Mutual Consent Over Unilateral Creation**

A lender can propose an agreement.

They cannot finalize it alone.

The borrower must explicitly approve the exact version.

---

### **2\. Immutable History**

Once someone approves a version, that version must never silently change.

Any amendment creates:

* a new version,  
* a timestamp,  
* a reason,  
* renewed consent.

---

### **3\. Witnessing Must Be Truthful**

A witness should only attest to what they actually witnessed.

The product must distinguish:

* witnessing formation of the agreement,  
* witnessing acknowledgment of an existing debt,  
* reviewing an agreement,  
* guaranteeing repayment.

These are not equivalent.

---

### **4\. Privacy by Default**

Debt information is sensitive.

The product should never publicly expose:

* debt amount,  
* missed payments,  
* identity details,  
* repayment history,  
* witness identities.

---

### **5\. No Public Borrower Score**

Ahd should not create a public reputation or credit score based on private hardship or repayment history.

The source concept explicitly rejects that direction.

---

### **6\. Hardship Must Be Supported**

The product should not only optimize for demanding payment.

It should support:

* repayment extensions,  
* revised schedules,  
* partial forgiveness,  
* full forgiveness,  
* mutually agreed amendments.

---

## **Product Scope**

### **V1**

Ahd V1 should allow users to:

1. create an interest-free loan agreement,  
2. invite the borrower,  
3. allow the borrower to approve or request changes,  
4. invite witnesses,  
5. capture witness attestations,  
6. digitally sign/confirm the final agreement,  
7. create a tamper-evident final record,  
8. generate a PDF,  
9. record repayments,  
10. confirm repayments,  
11. mark the debt settled.

---

### **V2**

Potential additions:

* installment schedules,  
* automated reminders,  
* extensions,  
* partial forgiveness,  
* mediation,  
* dispute workflow,  
* evidence export,  
* WhatsApp notifications,  
* Hausa audio explanations,  
* additional Islamic agreement types after expert review.

---

## **Explicit Non-Goals for V1**

Ahd V1 will not:

* lend money,  
* hold money,  
* transfer money,  
* collect repayments automatically,  
* calculate interest,  
* charge late-payment interest,  
* score borrowers,  
* publicly list unpaid debts,  
* guarantee repayment,  
* provide automated legal judgments,  
* provide automated Sharia rulings,  
* act as a debt-collection agency,  
* support business lending marketplaces.

---

# **2\. Job Stories**

* When I lend money to someone I trust  
  I want us to record the amount, repayment terms, and our agreement clearly  
  So I can protect the relationship from future misunderstanding  
* When someone creates a debt agreement naming me as the borrower  
  I want to review the exact terms and reject or correct anything inaccurate  
  So nobody can create a false obligation in my name  
* When both parties agree on a debt  
  I want trusted witnesses to attest to what they actually observed  
  So there is independent evidence of the agreement  
* When I am invited as a witness  
  I want the app to clearly explain what I am attesting to  
  So I do not accidentally agree to guarantee someone else's debt  
* When part of a loan is repaid  
  I want both parties to record and confirm the payment  
  So the remaining balance cannot later be disputed  
* When repayment terms need to change  
  I want the amendment to require mutual approval  
  So neither side can silently alter the original agreement  
* When the borrower faces genuine hardship  
  I want to extend, restructure, partially forgive, or fully forgive the debt  
  So the product supports compassion as well as accountability  
* When the debt is fully repaid  
  I want a final settlement record  
  So both parties have proof that nothing remains outstanding  
* When I need evidence later  
  I want to export the entire agreement history  
  So I can show what was agreed, changed, witnessed, and repaid

---

# **3\. Risk & Complexity Breakdown**

## **Functional Requirements**

### **FR-001 — Account Creation**

Users should be able to register using:

* phone number,  
* email.

Potential future methods:

* Google,  
* Apple.

For Nigeria, phone-based verification should be strongly considered.

---

### **FR-002 — Identity Profile**

Each registered user should have:

* full name,  
* verified phone/email,  
* optional profile photo,  
* optional address,  
* optional government-ID verification later.

Identity verification depth should be proportional to the legal/evidentiary requirements determined during legal review.

---

### **FR-003 — Create Agreement**

The lender initiates an agreement.

Required fields:

* currency,  
* principal amount,  
* borrower,  
* agreement date,  
* repayment due date,  
* repayment structure,  
* purpose optional,  
* additional agreed terms optional.

Default currency:

**NGN**

Future currencies may be supported.

---

### **FR-004 — Interest-Free Requirement**

V1 agreement template should explicitly state:

* principal,  
* interest rate: 0%,  
* contractual interest: ₦0.

The interface should not permit the lender to add interest to the qard template.

---

### **FR-005 — Agreement Drafting**

Agreement remains:

**Draft**

until sent.

The lender may edit freely while it remains Draft.

---

### **FR-006 — Invite Borrower**

Borrower invitation options:

* WhatsApp share,  
* copied link,  
* SMS,  
* email.

Invite should show:

> Abdullah Musa has invited you to review a loan agreement.

Avoid language like:

> Abdullah Musa says you owe ₦300,000.

before the borrower has acknowledged the obligation.

---

### **FR-007 — Borrower Review**

Borrower must see:

* lender identity,  
* principal,  
* repayment deadline,  
* repayment structure,  
* full agreement wording,  
* witness arrangement,  
* any additional terms.

Primary actions:

**Accept Terms**

**Request Changes**

**Decline**

---

### **FR-008 — Request Changes**

Borrower may flag:

* incorrect amount,  
* incorrect due date,  
* repayment terms,  
* name/identity error,  
* additional terms.

They may add a note.

Example:

> We agreed on 30 June, not 1 June.

Agreement status changes to:

**Changes Requested**

---

### **FR-009 — Versioning**

Every material change creates a new version.

Example:

```
Version 1
₦300,000
Due: 1 June

Version 2
₦300,000
Due: 30 June
```

Store:

* who changed it,  
* what changed,  
* when,  
* why.

Previous versions remain readable.

---

### **FR-010 — Mutual Approval**

Final terms require:

* lender approval,  
* borrower approval.

The product should show:

```
Lender — Approved
Borrower — Approved
```

If the agreement changes after approval, previous approval must no longer finalize the new version.

---

### **FR-011 — Witness Configuration**

The product should allow the parties to choose the witnessing arrangement appropriate to the reviewed product policy.

Because the source concept references specific witnessing arrangements derived from Qur'an 2:282, this area must undergo qualified scholarly review before launch.

Do not hard-code religious/legal claims until validated.

---

### **FR-012 — Witness Invitation**

Witness receives:

* private link,  
* explanation of role,  
* agreement summary,  
* full agreement,  
* attestation statement.

---

### **FR-013 — Witness Role Education**

Before a witness can continue:

> **You are being invited as a witness.**

> You are not agreeing to repay this debt if the borrower cannot.

> Your role is to attest only to what you personally witnessed.

Require acknowledgment:

☐ I understand that I am not acting as a guarantor.

---

### **FR-014 — Witness Type**

The witness must specify what they witnessed.

Possible options:

**I witnessed the parties form this agreement.**

**I witnessed the borrower acknowledge an existing debt.**

**I only reviewed the record.**

The third option should not count as the same type of attestation as direct witnessing.

---

### **FR-015 — Witness Presence**

Ahd must capture context around witnessing.

Possible modes subject to scholarly/legal validation:

* physically present,  
* live remote session,  
* subsequent acknowledgment.

Store the selected mode.

---

### **FR-016 — Live Confirmation Session**

Potential V1.1 feature.

A lender, borrower, and witness can join a synchronized confirmation session.

The interface displays:

* agreement version,  
* participants present,  
* consent status.

Participants individually confirm.

This could create stronger evidence than asynchronous signing alone.

---

### **FR-017 — Digital Confirmation**

Each participant confirmation should include:

* participant identity,  
* role,  
* timestamp,  
* agreement version hash,  
* verification method,  
* IP/device metadata where lawful,  
* confirmation text.

---

### **FR-018 — Electronic Signature**

Signature mechanisms may include:

* drawn signature,  
* typed signature,  
* OTP-confirmed signature.

The legal design should be reviewed before determining which method provides adequate evidentiary value.

---

### **FR-019 — Agreement Finalization**

An agreement may only be marked:

**Finalized**

when all required approvals and attestations for that workflow have been completed.

Before then:

**Pending Completion**

---

### **FR-020 — Tamper-Evident Record**

Finalized agreement must generate a cryptographic hash.

Conceptually:

```
Agreement content
+
Version
+
Participant identities
+
Timestamps
+
Attestations

↓

SHA-256 hash
```

Store the hash.

If the document later changes, the hash should no longer match.

---

### **FR-021 — Agreement Identifier**

Each finalized agreement gets a unique ID.

Example:

**AHD-2026-00128**

This ID appears on:

* agreement screen,  
* PDF,  
* repayment receipts,  
* settlement certificate.

---

### **FR-022 — Agreement PDF**

Generate a final PDF containing:

* agreement ID,  
* lender,  
* borrower,  
* principal,  
* 0% interest,  
* due date,  
* repayment structure,  
* agreement wording,  
* signatures,  
* witness attestations,  
* timestamps,  
* version,  
* verification/hash information.

All participants should be able to download it.

---

### **FR-023 — Agreement Timeline**

Each agreement should include a chronological history.

Example:

```
2 Oct, 10:32
Agreement created

2 Oct, 10:40
Borrower invited

2 Oct, 11:05
Borrower requested correction

2 Oct, 11:18
Due date updated

2 Oct, 11:22
Borrower approved

2 Oct, 11:25
Lender approved

2 Oct, 14:10
Witness 1 attested

2 Oct, 14:24
Witness 2 attested

2 Oct, 14:25
Agreement finalized
```

This history must be immutable.

---

### **FR-024 — Repayment Recording**

Either lender or borrower may propose a repayment record.

Fields:

* amount,  
* date,  
* payment method,  
* note,  
* proof optional.

Example:

**₦50,000 paid via bank transfer.**

---

### **FR-025 — Repayment Confirmation**

Repayment should not reduce the official balance merely because one party entered it.

Other party confirms:

**Confirm Payment**

**Dispute Payment**

---

### **FR-026 — Balance Calculation**

```
Remaining Balance =
Principal
− Confirmed Repayments
− Confirmed Forgiveness
```

No interest calculations.

---

### **FR-027 — Repayment Receipt**

Confirmed repayment generates a receipt.

Example:

```
Agreement: AHD-2026-00128

Payment:
₦50,000

Date:
12 December 2026

Remaining:
₦250,000
```

---

### **FR-028 — Settlement**

When confirmed balance reaches zero:

Agreement status becomes:

**Eligible for Settlement**

Both parties confirm:

**Debt Fully Settled**

Then:

**Settled**

---

### **FR-029 — Settlement Certificate**

Generate:

**Debt Settlement Record**

Containing:

* agreement ID,  
* original principal,  
* repayment history,  
* forgiveness if any,  
* settlement date,  
* lender acknowledgment,  
* borrower acknowledgment.

---

### **FR-030 — Repayment Extension**

V1.1 or V2.

Borrower can request:

> Extend due date.

Lender may:

* approve,  
* counter,  
* decline.

Approved change creates a new amendment version.

Original agreement remains preserved.

---

### **FR-031 — Debt Forgiveness**

Lender may offer:

* partial forgiveness,  
* full forgiveness.

Borrower confirms receipt of the change.

Example:

```
Original balance:
₦100,000

Lender forgives:
₦40,000

New balance:
₦60,000
```

---

### **FR-032 — Agreement Statuses**

Recommended state machine:

```
DRAFT
↓
AWAITING_BORROWER
↓
CHANGES_REQUESTED
↓
AWAITING_APPROVAL
↓
AWAITING_WITNESSES
↓
FINALIZED
↓
ACTIVE
↓
SETTLED
```

Additional states:

```
DECLINED
CANCELLED
DISPUTED
OVERDUE
```

---

### **FR-033 — Dashboard**

Home dashboard should show:

**Needs Your Attention**

* agreements awaiting approval,  
* witness invitations,  
* repayment confirmations,  
* amendments.

**Your Agreements**

Tabs:

* Active  
* Settled  
* Drafts

---

### **FR-034 — Agreement Card**

Example:

```
Ahmad Ibrahim

₦300,000

Due 8 April 2027

ACTIVE

₦250,000 remaining
```

---

### **FR-035 — Agreement Detail Screen**

Sections:

1. status,  
2. remaining balance,  
3. participants,  
4. terms,  
5. repayment progress,  
6. repayments,  
7. agreement timeline,  
8. documents,  
9. actions.

---

### **FR-036 — Search**

Users should search by:

* participant,  
* agreement ID.

Future:

* amount,  
* date.

---

### **FR-037 — Notifications**

V1:

* email,  
* in-app.

High-priority events:

* borrower invited,  
* agreement changed,  
* approval required,  
* witness invited,  
* witness completed,  
* agreement finalized,  
* repayment proposed,  
* repayment confirmed,  
* due date approaching,  
* agreement settled.

Future:

* WhatsApp,  
* SMS.

---

### **FR-038 — Reminder Behavior**

Reminder language must avoid humiliation.

Avoid:

> Ahmad has failed to pay his debt.

Prefer:

> Agreement AHD-2026-00128 is due in 7 days.

---

### **FR-039 — Localization**

Initial:

**English**

High-value follow-up:

**Hausa**

The source concept specifically identifies English/Hausa support as valuable.

Later possibilities:

* Yoruba,  
* Arabic.

---

### **FR-040 — Audio Explanation**

Potential accessibility feature.

Participants can listen to simplified explanations of:

* lender role,  
* borrower role,  
* witness role,  
* agreement terms.

Audio explanation must never replace the actual agreement text.

---

## **Functional Edge Cases**

### **Incorrect Borrower**

Lender sends agreement to wrong phone number.

Mitigation:

Borrower can select:

**This agreement is not for me.**

Agreement cannot proceed.

---

### **Borrower Disagrees With Amount**

Borrower sees:

> ₦500,000

but believes:

> ₦300,000

They request change.

Witness invitations cannot proceed until mutual agreement exists.

---

### **Lender Changes Terms After Borrower Approval**

Borrower approval becomes invalid for the new version.

Status returns to:

**Awaiting Borrower Approval**

---

### **Witness Added After Agreement Occurred**

Witness cannot falsely claim:

> I witnessed the original transaction.

They may be able to attest:

> I witnessed the borrower acknowledge the existing obligation.

Subject to expert validation.

---

### **Witness Declines**

Agreement status remains:

**Awaiting Witnesses**

Parties may invite another eligible witness.

---

### **Witness Does Not Understand Terms**

Witness should be able to:

* pause,  
* request explanation,  
* decline.

No pressure to complete.

---

### **One Participant Has No Account**

Ahd should allow secure guest participation through:

* invitation token,  
* OTP verification.

An account may be created after completion.

This is particularly important for witnesses.

---

### **Payment Proposed But Disputed**

Example:

Borrower says:

> I paid ₦50,000.

Lender says:

> I only received ₦30,000.

Balance must remain unchanged until resolved.

Event becomes:

**Repayment Disputed**

---

### **Overpayment**

System should prevent confirmed repayment from exceeding the remaining balance unless explicit handling exists.

---

### **Duplicate Payment**

If the same transfer/reference appears twice, warn users.

---

### **Borrower Pays Early**

Allowed.

Agreement may settle before the contractual deadline.

---

### **Borrower Requests Extension After Due Date**

Allowed.

Extension history must preserve that the original due date passed.

---

### **Lender Forgives Entire Remaining Balance**

After borrower acknowledgment:

**Settled by Forgiveness**

rather than:

**Fully Repaid**

This distinction matters.

---

### **Participant Dies**

Future policy required.

The system should preserve records without improvising succession rules.

---

### **Account Deleted**

Legal/record-retention requirements may prevent simple deletion of finalized agreements.

Privacy policy must distinguish:

* account deletion,  
* record retention.

---

## **UX Confusion Points**

### **Witness vs Guarantor**

This is the highest-risk conceptual confusion.

Ahd must explicitly say:

> A witness confirms what they observed. A witness does not automatically promise to repay the debt.

---

### **Proposal vs Accepted Obligation**

Before borrower approval:

Use:

**Proposed Amount**

After approval:

Use:

**Agreed Principal**

Avoid presenting lender-entered information as established fact prematurely.

---

### **Signing vs Witnessing**

A digital signature can mean different things depending on role.

Lender:

> I agree to these terms.

Borrower:

> I acknowledge and agree to these terms.

Witness:

> I attest to the event described above.

These should not share identical button copy.

---

### **Editing After Finalization**

Users may expect an “Edit” button.

Finalized agreements should instead show:

**Propose Amendment**

---

### **Due vs Overdue**

Overdue should be factual, not accusatory.

Example:

> Due date passed 4 days ago.

Not:

> Borrower defaulted.

unless legally and contractually established.

---

### **Settlement**

Lender and borrower should clearly understand that:

**Settled**

means the system recognizes no remaining balance under the recorded agreement.

---

## **System Risks**

### **Identity Fraud**

Risk:

Someone signs using another person's link.

Mitigations:

* OTP,  
* device/session metadata,  
* optional stronger identity verification,  
* invitation expiration,  
* activity logging.

---

### **Link Forwarding**

Private invitation link may be forwarded.

Require identity verification after opening.

Possessing a link must not itself grant signing authority.

---

### **Tampering**

Risk:

Database operator or attacker changes agreement content.

Mitigations:

* append-only event history,  
* version hashes,  
* signed audit events,  
* backups,  
* restricted administrative access.

---

### **Cross-Agreement Data Leakage**

Users must only access agreements in which they participate.

Authorization should check role membership server-side.

---

### **PDF Divergence**

Generated PDF must correspond exactly to the finalized agreement version.

PDF should reference the version/hash.

---

### **Timestamp Reliability**

System-generated timestamps should come from the server.

Never trust client clock for official agreement events.

---

### **Notification Failure**

Notification delivery failure must not change legal/product state.

Example:

Witness invitation email fails.

Agreement remains pending.

User can resend.

---

### **Sensitive Data Exposure**

Avoid exposing:

* agreement details in public URLs,  
* full amount in push notifications unless opted in,  
* participant identity in analytics.

---

### **Religious Misrepresentation**

The product must not imply that:

* every digitally created agreement automatically fulfills every religious requirement,  
* witnesses are always mandatory for validity,  
* a specific interpretation is universally accepted.

The source concept itself highlights scholarly disagreement and recommends careful wording.

---

### **Legal Misrepresentation**

Do not promise:

> Legally enforceable.

until properly reviewed.

Safer:

> Ahd preserves a structured record of the agreement and participant actions.

The source concept explicitly calls for Nigerian legal review around electronic evidence, signatures, identity, and enforceability.

---

## **Failure States**

### **Borrower Cannot Verify**

Show:

> We couldn't verify this phone number.

Actions:

* Retry  
* Use email  
* Contact inviter

Blocking.

---

### **Agreement Changed During Review**

If borrower has an old tab open:

> This agreement has changed since you opened it.

Require reload before approval.

Blocking.

---

### **Signing Request Fails**

Do not show completion.

Display:

> Your confirmation was not recorded.

Retry.

---

### **Witness Link Expired**

Show:

> This invitation is no longer active.

Contact lender/borrower.

---

### **PDF Generation Fails**

Agreement remains valid in-app if finalization succeeded.

Show:

> PDF temporarily unavailable.

Retry generation.

---

### **Payment Confirmation Fails**

Do not modify balance.

Show retry.

---

### **Notification Provider Fails**

Keep event state unchanged.

Queue notification retry.

---

### **Network Dies During Signature**

Client must check server state before assuming success.

Never infer success from button press.

---

# **4\. User Flows**

## **Primary Flow — Create and Finalize Agreement**

### **Step 1 — Lender Starts Agreement**

User taps:

**New Agreement**

Select:

**Interest-Free Loan**

---

### **Step 2 — Enter Principal**

Screen:

> How much are you lending?

Input:

**₦300,000**

Display:

> Interest: ₦0

---

### **Step 3 — Add Borrower**

Enter:

* name,  
* phone/email.

If borrower already uses Ahd, show verified profile.

---

### **Step 4 — Define Repayment Terms**

Select:

**Single repayment**

or eventually:

**Installments**

Enter:

**8 April 2027**

Optional:

> Add a note.

---

### **Step 5 — Review Draft**

Summary:

```
Lender
Abdullah Musa

Borrower
Ahmad Ibrahim

Principal
₦300,000

Interest
₦0

Due
8 April 2027
```

CTA:

**Send to Borrower**

---

### **Step 6 — Borrower Receives Invite**

Message:

> Abdullah Musa invited you to review a proposed agreement on Ahd.

Borrower opens link.

---

### **Step 7 — Borrower Verifies Identity**

OTP sent.

Borrower enters OTP.

---

### **Step 8 — Borrower Reviews Terms**

Show:

**This agreement has not been finalized.**

Borrower reads everything.

Actions:

**Accept**

**Request Change**

**Decline**

---

### **Step 9 — Borrower Accepts**

Confirmation:

> I acknowledge that these terms accurately reflect the obligation I am agreeing to.

Borrower confirms.

---

### **Step 10 — Lender Confirms Final Version**

If borrower made no changes:

Lender's previously proposed terms remain.

If borrower requested changes and lender accepted:

Both reapprove final version.

---

### **Step 11 — Witnesses Invited**

Witness receives:

> You have been invited to witness an agreement between Abdullah Musa and Ahmad Ibrahim.

---

### **Step 12 — Witness Education**

Before seeing attestation controls:

> You are not being asked to guarantee repayment.

> You should only attest to what you personally witnessed.

Witness confirms understanding.

---

### **Step 13 — Witness Reviews**

Witness sees:

* parties,  
* principal,  
* due date,  
* terms,  
* agreement version.

---

### **Step 14 — Witness Selects Attestation**

Example:

> I witnessed both parties confirm this agreement.

Witness signs/confirms.

---

### **Step 15 — Required Witnesses Complete**

Progress:

```
Borrower ✓
Lender ✓
Witness 1 ✓
Witness 2 ✓
```

---

### **Step 16 — Agreement Finalizes**

System creates:

* final version,  
* final hash,  
* agreement number,  
* finalized timestamp,  
* PDF.

Status:

**ACTIVE**

---

### **Step 17 — All Participants Receive Record**

Everyone can:

* view,  
* download,  
* preserve copy.

---

## **Alternate Flow — Borrower Requests Changes**

1. Lender sends agreement.  
2. Borrower reviews.  
3. Borrower taps **Request Changes**.  
4. Borrower selects:  
   * due date.  
5. Adds:  
   We agreed on 30 June.  
6. Agreement status changes.  
7. Lender receives notification.  
8. Lender edits due date.  
9. New version generated.  
10. Borrower reviews new version.  
11. Both approve.  
12. Witness process begins.

---

## **Alternate Flow — Witness Declines**

1. Witness opens invitation.  
2. Reads terms.  
3. Selects:  
   **I cannot truthfully witness this agreement.**  
4. Attestation not created.  
5. Parties notified.  
6. Parties may invite replacement witness.

---

## **Primary Repayment Flow**

1. Borrower makes payment externally.  
2. Borrower opens agreement.  
3. Taps **Record Payment**.  
4. Enters:  
   **₦50,000**  
5. Optional:  
   * transfer reference,  
   * proof.  
6. Lender receives request.  
7. Lender taps:  
   **Confirm Received**  
8. Payment status:  
   **Confirmed**  
9. Balance updates:  
   ₦300,000 → ₦250,000.  
10. Receipt generated.

---

## **Alternate Repayment Flow — Lender Records Payment**

1. Lender taps **Record Payment**.  
2. Enters amount.  
3. Borrower receives confirmation request.  
4. Borrower confirms.  
5. Balance updates.

---

## **Failure Flow — Disputed Repayment**

1. Borrower records ₦50,000.  
2. Lender selects:  
   **Dispute**  
3. Adds:  
   I received ₦30,000.  
4. Payment remains:  
   **Disputed**  
5. Official balance unchanged.  
6. Parties resolve manually or through future mediation flow.  
7. Once resolved, both confirm corrected amount.

---

## **Settlement Flow**

1. Final repayment confirmed.  
2. Balance becomes ₦0.  
3. System displays:  
   All recorded obligations have been fulfilled.  
4. Lender confirms:  
   **Debt Fully Settled**  
5. Borrower acknowledges.  
6. Agreement status:  
   **SETTLED**  
7. Settlement record generated.  
8. Agreement becomes read-only except for evidence/history access.

---

## **Extension Flow**

1. Borrower taps:  
   **Request More Time**  
2. Proposes:  
   **New date: 1 August**  
3. Adds optional reason.  
4. Lender reviews.  
5. Lender:  
   * accepts,  
   * counters,  
   * declines.  
6. If accepted:  
   * amendment created,  
   * both approve,  
   * history preserved.  
7. New due date becomes active.

---

## **Forgiveness Flow**

1. Lender selects:  
   **Forgive Part of Debt**  
2. Enters:  
   **₦100,000**  
3. System explains:  
   This permanently reduces the recorded amount owed once confirmed.  
4. Lender confirms.  
5. Borrower receives notice.  
6. Borrower acknowledges.  
7. Balance reduced.  
8. Timeline records:  
   **₦100,000 forgiven by lender.**

---

# **Key Metrics to Track**

## **Activation**

**Agreement Completion Rate**

```
Agreement Created
→ Borrower Reviewed
→ Borrower Approved
→ Witnesses Completed
→ Agreement Finalized
```

Track drop-off at every step.

---

## **Core Success Metric**

**Number of successfully finalized agreements**

More useful than total signups.

---

## **Time to Agreement**

Measure:

> Median time from creation to finalization.

---

## **Borrower Review Rate**

Percentage of borrower invitations resulting in:

* accept,  
* request change,  
* decline.

---

## **Witness Completion Rate**

Percentage of invitations resulting in valid attestation.

---

## **Amendment Rate**

Percentage of agreements requiring changes before finalization.

This could reveal whether the system is successfully catching misunderstandings.

---

## **Repayment Recording**

Track:

* payments proposed,  
* payments confirmed,  
* payments disputed.

---

## **Settlement Rate**

Percentage of active agreements eventually marked settled.

This should not become a public borrower-quality metric.

---

## **Reliability Metrics**

Track:

* OTP failures,  
* signature failures,  
* PDF failures,  
* notification failures,  
* agreement version conflicts,  
* repayment confirmation failures.

---

# **Open Questions**

## **Islamic Review**

1. What witnessing workflows should Ahd formally support?  
2. Under what circumstances can remote participation count as witnessing?  
3. How should acknowledgment of an existing debt differ from witnessing the original transaction?  
4. What exact terminology should be used for witness roles?  
5. Should the product encode specific witness combinations or merely explain recommended arrangements?  
6. How should hardship, extensions, and forgiveness be framed?  
7. What claims about Islamic compliance are appropriate?

These questions require qualified scholarly review before production claims are made.

---

## **Nigerian Legal Review**

1. What electronic-signature mechanism is appropriate?  
2. What evidence should be retained?  
3. What identity verification is required?  
4. What metadata may legally be collected?  
5. What retention period applies?  
6. How should user deletion interact with agreement preservation?  
7. Can witness attestations be collected remotely?  
8. How should amendment histories be structured?  
9. What terms must appear in a legally robust loan acknowledgment?  
10. How should generated PDFs be presented as evidence?

---

## **Product**

1. Should either party be able to initiate the agreement?  
2. Should borrowers be able to initiate acknowledgment of money already received?  
3. Should witnesses require accounts?  
4. Should agreement creation be free?  
5. Should Ahd monetize exports, storage, or premium workflows?  
6. Should reminders be lender-controlled or mutually configured?  
7. Should repayment proof attachments be mandatory?  
8. Should installment plans enter V1 or V1.1?  
9. Is Hausa necessary at launch?  
10. Should live witnessing be part of V1?

---

## **Trust**

1. What makes users believe the record has not been modified?  
2. Should agreement hashes be independently verifiable?  
3. Do users understand the difference between Ahd and a bank?  
4. What information would make a witness comfortable signing?  
5. Does formal documentation make family lending feel safer or more awkward?

---

# **Recommended MVP Boundary**

The MVP should prove one thing extremely well:

> **Can two people create an interest-free debt agreement, mutually confirm it, have it properly witnessed, and preserve a trustworthy record without the process feeling hostile or complicated?**

Therefore the true MVP is:

```
Create Agreement
↓
Borrower Review
↓
Mutual Approval
↓
Witness Attestation
↓
Finalized Record
↓
PDF
↓
Repayment Recording
↓
Settlement
```

Everything else is secondary.

The key experience is not the dashboard.

It is not the PDF.

It is not even the digital signature.

The product succeeds if it makes a potentially uncomfortable conversation feel clear, fair, respectful, and trustworthy.

That should remain the central design constraint for Ahd.

