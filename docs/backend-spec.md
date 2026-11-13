# EBIS Core — Backend Specification

> **Status:** Draft 2 — **rewritten to align with the authoritative spec**
> `EBIS_Core_Workflow_and_Requirements.docx`. (Draft 1 was mistakenly modelled on a buyer-side
> reference portal; that has been corrected — see §0.)
> **Date:** 2026-11-05
> **Stack:** Laravel 12 · Inertia.js · React · multi-tenant (Tenant / TenantMember / User).

---

## 0. Correction note

An earlier draft of this document modelled a **buyer-side** procurement engine, derived from the
REA-NEP reference portal we studied. **That was the wrong side.** The authoritative docx is clear:

> *"EBIS Core lets an **SME** upload or find a tender, see whether the company qualifies, inspect the
> evidence behind that assessment, understand any gaps, and … prepare and validate its bid."*

EBIS Core is a **supplier-side** tool. The reference portal was useful only for **UX polish** ideas,
captured separately in `docs/design-enhancement-plan.md`. This document now follows the docx.

**Out of scope per the docx:** submission to buyer portals, pricing strategy, legal advice.

**Not in the docx at all** (our own scoping, pending confirmation from the client): publishing tender
notices, vendor registration desks, receiving/evaluating other companies' bids. These are the main
features of the REA-NEP portal; the docx neither asks for nor excludes them.

---

## 1. Purpose, actors, design principle

**Purpose:** take an SME from **tender intake → pre-submission validation**.

**Actors**
- **SME user** — uploads tenders, maintains the company profile, makes the go/no-go decision, edits
  and signs off the bid.
- **EBIS engine** — parses tenders, assesses eligibility, links evidence, analyses gaps, drafts and
  validates.
- **Profile & evidence store** — the company facts and documents every assessment and draft rely on.

**Design principle (the spine of the whole system):** every conclusion must trace back through a
chain — **tender requirement → profile fact → source document**. Where no evidence exists, the
result is **`Unknown`**, never a guess. The data model is built around this chain.

---

## 2. The 10-stage workflow

| # | Stage | Actor | Input | Output |
|---|---|---|---|---|
| 1 | **Ingest** | SME | Tender file(s) / search query | Stored tender + metadata, text extracted |
| 2 | **Understand tender** | EBIS | Extracted text | Structured requirements + clause refs + confidence |
| 3 | **Eligibility check** | EBIS | Requirements + profile | Status per requirement (Met / Partially / Not met / Unknown) |
| 4 | **Evidence & verdict** | EBIS | Statuses + facts | Overall verdict + evidence trail (clause → document) |
| 5 | **Gap analysis** | EBIS | Non-Met statuses + deadline | Gap list: severity, remedy, time-to-close |
| 6 | **Go / no-go** | SME | Verdict, gaps, effort | Recorded decision to proceed or decline |
| 7 | **Prepare bid** | EBIS | Requirements, evidence, templates | Compliance matrix, checklist, grounded drafts |
| 8 | **Review & edit** | SME | Drafts + checklist | Completed, versioned bid content |
| 9 | **Validate** | EBIS | Bid content + tender rules | Readiness score + prioritised issues |
| 10 | **Submit** | SME | Validated bid | Final sign-off (submission happens outside EBIS) |

**Workflow rules (must enforce in the backend):**
- Hard criteria (turnover, certifications, insurance limits, years trading) → **deterministic rules**.
  LLM only for **judgement** criteria, always **flagged + confidence-scored**.
- Go/no-go is a real gate: a mandatory **`Not met`** raises a **blocker**; the user may **override**,
  and the override is **logged** (user, time, reason).
- Stages 8↔9 **loop** until readiness ≥ threshold. Each validation issue links to its draft section
  / missing document.
- Adding evidence **re-runs only the affected requirements**; verdict updates.
- **Profile changes never alter past assessments** — each assessment records the **tender version**
  and **profile version** it used. (Immutability + versioning.)

---

## 3. Data model → Laravel

Entities from the docx (§4), all **tenant-scoped** (`tenant_id`), building on the existing
Tenant / TenantMember / User:

| Entity | Key fields | Links |
|---|---|---|
| **Tender** | reference, buyer, deadline, value, lots, **version** | Documents, Requirements |
| **Document** | name, kind, role, pages, hash, uploadedAt | Tender / ProfileFact |
| **Requirement** | text, category, source{page,clause,quote}, confidence | Tender, Assessment |
| **ProfileFact** | type, value, issue date, **expiry date**, verification status | Document, Evidence |
| **Assessment** | status, reason, **method (rule\|AI)**, confidence, **versions used** | Requirement, Evidence, Override |
| **Evidence** | clause quote, fact ref, document ref | Assessment, ProfileFact |
| **Override** | status, reason, user, time | Assessment |
| **Gap** | severity, remedy, time-to-close, status | Assessment |
| **Bid** | sections, compliance matrix, checklist, readiness score, sign-off | Tender, Requirements, Evidence |
| **AuditEvent** | actor, action, target, before/after, time (append-only) | all |

**Evidence chain:** `Requirement → Assessment → Evidence → ProfileFact → Document`.

**PHP enums** (mirror `resources/js/types/ebis.ts` so API props line up):
`TenderStage` (intake…submitted), `RequirementCategory` (mandatory|scored|informational),
`RequirementTopic`, `AssessmentStatus` (met|partially_met|not_met|unknown),
`AssessmentMethod` (rule|ai), `GapSeverity` (blocker|fixable|minor), `GapStatus` (open|in_progress|closed),
`ProfileFactSource`, `VerificationStatus` (verified|unverified|expired), `DocumentKind` (pdf|docx|zip|xlsx).

> The frontend types are the contract. Where this spec and `types/ebis.ts` differ, **the frontend wins**;
> reconcile names rather than inventing new ones.

---

## 4. Requirements → implementation notes

Grouped by stage; docx IDs in brackets. **Must** = required for usable release, **Should** = can follow.

**Ingest (ING)**
- Accept PDF/DOCX/ZIP ≤ 50 MB; reject others with a clear message `[ING-01]`.
- Text extraction incl. **OCR** for scanned pages (≥95% accuracy; report failed pages) `[ING-02]`.
- Multi-doc pack = **one tender record** `[ING-03]`. Metadata: buyer, reference, deadline, value,
  lots — deadline required before assessment `[ING-04]`. **Duplicate detection** by reference/hash `[ING-05]`.
- *Should:* search public feeds (**Find a Tender, TED**) by keyword/CPV/value/deadline `[ING-06]`.
  → use a **queued job** for parsing/OCR; store original + extracted text.

**Understand tender (TUN)**
- Extract requirements as structured records (text, category, source doc/page/clause); ≥95% recall on
  mandatory `[TUN-01]`. Confidence per requirement; below threshold → flag for review `[TUN-02]`.
- User can add/edit/delete requirements, **all versioned + audit-logged** `[TUN-03]`.
- Extract **submission rules** (page limits, file types, naming) for the validation stage `[TUN-04]`.
- *Should:* extract scoring criteria/weightings `[TUN-05]`. **Surface parse failures**, never skip
  silently `[TUN-06]`.

**SME profile (PRF)**
- Core company data (legal name, reg no, size, turnover, employees, sectors), **versioned** `[PRF-01]`.
- Supporting docs (accreditations, insurance, financials, case studies, CVs), each **linked to ≥1
  profile fact** `[PRF-02]`.
- Every fact records **source doc, issue date, expiry date, verification status**; no source → unverified `[PRF-03]`.
- *Should:* suggest facts from uploaded docs for user confirmation; nothing saved verified without
  confirmation `[PRF-04]`. **Expiry alerts at 90 and 30 days** `[PRF-05]` → scheduled job.

**Eligibility (ELG)**
- Hard criteria via **deterministic rules**, same inputs → same result `[ELG-01]`.
- One status per requirement; none left unstatused `[ELG-02]`. Missing data → **Unknown**, never
  assume `[ELG-03]`. Overall verdict derived; any mandatory **Not met** blocks "Qualifies" `[ELG-04]`.
- *Should:* LLM only for judgement criteria, flagged AI + confidence, below-threshold → review `[ELG-05]`.
- **Override** any status with a mandatory reason, stored with user/time/reason, visible on verdict `[ELG-06]`.

**Evidence (EVD)**
- Link every status to tender **clause (doc, page, quote)** + supporting **profile fact**; both
  openable from the verdict `[EVD-01]`.
- **Stale evidence** (expires before deadline) downgrades to **Partially met** + shows expiry `[EVD-02]`.
- Plain-language explanation per verdict (requirement, fact used, why) `[EVD-03]`.
- *Should:* version every assessment for reproducibility `[EVD-04]`. **Append-only, exportable,
  user-uneditable audit log** of assessments, overrides, profile edits `[EVD-05]`.

**Gap analysis (GAP)**
- A gap record for every non-Met requirement; count = Partially + Not met + Unknown `[GAP-01]`.
- Classify **blocker | fixable | minor** (blocker = can't realistically close before deadline) `[GAP-02]`.
- ≥1 **remedy** per gap (certificate / evidence / partner-subcontractor / ask buyer) `[GAP-03]`.
- Estimate **time-to-close** vs days-to-deadline; flag the un-closable `[GAP-04]`.
- *Should:* track status open/in-progress/closed with date+user `[GAP-05]`. Adding evidence
  **re-assesses only affected requirements**, verdict updates < 1 min `[GAP-06]`.

**Go/no-go (DEC)**
- Decision summary: verdict, counts by status, blockers, deadline, estimated effort `[DEC-01]`.
- Record proceed/decline (+ optional reason) to the **audit log** `[DEC-02]`.
- *Should:* win-fit indicators (weightings, value vs turnover), labelled guidance not prediction `[DEC-03]`.
- Proceeding **creates a bid workspace** carrying requirements/evidence/gaps over without re-entry `[DEC-04]`.

**Bid preparation (BID)**
- **Compliance matrix**: every requirement → response section → evidence; all mandatory present `[BID-01]`.
- **Checklist** of required forms/documents with status, updating as docs are added `[BID-02]`.
- Draft text from **only** profile facts/evidence, **each claim cited** `[BID-03]`.
- *Should:* flag unsupported statements `[BID-04]`. Draft editing with **version history / restore** `[BID-05]`.
- *Should:* templates for standard forms (e.g. selection questionnaires), pre-filled from profile `[BID-06]`;
  export in buyer's required format/naming (per TUN-04) `[BID-07]`.

**Validation (VAL)**
- Every mandatory requirement has a response + evidence; else **blocking issue** `[VAL-01]`.
- Required forms complete, documents attached; missing listed with location `[VAL-02]`.
- Check page/word limits, formats, naming vs tender rules; each breach names rule + file `[VAL-03]`.
- No evidence expiring before deadline `[VAL-04]`. *Should:* detect cross-section contradictions `[VAL-05]`.
- **Readiness score** + prioritised, location-linked issues; blockers rank above advisory `[VAL-06]`.
- Re-run after edits, keep **score history** `[VAL-07]`. Record **final sign-off** (user+time);
  **EBIS does not submit** `[VAL-08]`.

---

## 5. Non-functional

- **Tenant isolation** — no cross-tenant access (pen-tested) `[SEC-01]`. Build on existing tenancy;
  scope every query, enforce via global scopes + policies.
- **GDPR** — DPA, retention limits, export + **deletion within 30 days** `[SEC-02]`.
- **Encryption** in transit + at rest, **RBAC** on edit/sign-off `[SEC-03]`.
- **AI guardrails** — LLM outputs must **match a schema and cite a source**; malformed/uncited →
  retry then flag `[AI-01]`. **No customer data used for training** (provider agreement) `[AI-02]`.
- **Performance** — assess a typical 100-page tender in **< 5 min** (p95) `[PRF-NFR]`.
- **Availability** — target **99.5%** monthly `[AVL-01]`.
- **Errors visible** — failed parses/extractions/timeouts reported with a recovery option; no silent
  failures `[ERR-01]`.

**Laravel fit:** Queues (parsing/OCR/LLM), Scheduler (expiry alerts PRF-05, re-validation),
Policies + global scopes (RBAC + tenancy), Form Requests (validation), Events→Listeners (append-only
AuditEvent), model versioning (assessment/profile versions), structured-output validation around the
LLM client (AI-01).

---

## 6. Build order (aligned to the workflow)

1. **M1 — Tenancy + Profile store.** Company profile + documents + ProfileFacts with expiry/verification
   (PRF-*), audit log skeleton (EVD-05). *Foundation the whole chain hangs off.*
2. **M2 — Ingest.** Upload/parse/OCR, metadata, dedupe, multi-doc packs (ING-*).
3. **M3 — Understand.** Requirement extraction + confidence + user edits (TUN-*).
4. **M4 — Eligibility + Evidence.** Deterministic rules, statuses, Unknown rule, overrides, evidence
   links, stale-evidence, versioned assessments (ELG-*, EVD-*).
5. **M5 — Gaps + Decision.** Gap records, severity/remedy/time, go/no-go, bid workspace (GAP-*, DEC-*).
6. **M6 — Prepare + Review.** Compliance matrix, checklist, grounded drafts + citations, versions (BID-*).
7. **M7 — Validate + Submit.** Readiness score, issues, sign-off, score history (VAL-*).
8. **M8 — Non-functional hardening.** GDPR delete/export, pen-test isolation, perf, availability (SEC/AI/PRF-NFR).

---

## 7. Open decisions (from docx §5 — need product input)

- [ ] Confidence threshold for user review (TUN-02, ELG-05).
- [ ] Can several "Partially met" still "Qualify", or add a **"Qualifies with conditions"** verdict?
- [ ] Readiness-score threshold at which validation passes (VAL-06).
- [ ] Data residency (EU/UK-only hosting) for customers who require it.
- [ ] ID strategy (ULID recommended) + reconcile all names against `resources/js/types/ebis.ts`.
```
