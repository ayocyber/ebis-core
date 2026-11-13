# EBIS Core — Design Enhancement Plan

> **Status:** Draft 1 · **Date:** 2026-11-05
> **Principle:** *Keep what we have.* The client (boss) reviewed and **liked our design and
> structure**, so this is **not a redesign** — it's a short list of **targeted tweaks** that borrow
> the *qualities* we admired in the REA-NEP reference portal, applied to **our** supplier-side app.

---

## 0. Ground rules

1. **Do not change** our visual design language (colours, type, layout, component kit) or our
   **10-stage supplier structure**. The boss signed off on both.
2. **We stay supplier-side.** EBIS Core helps a UK SME *win* tenders. We are **not** adding
   buyer-side features (publishing notices, vendor registration desks, running evaluations). See §5.
3. Every tweak below names the **actual file/page** it touches and is **optional** ("if needed").
4. Where we're already **ahead** of the reference, we protect that — don't regress it (see §4).

---

## 1. What the boss loved — leave alone ✋

- The **10-stage bid pipeline**: `intake → extraction → requirements → eligibility → gaps →
  decision → compliance → drafting → validation → submitted`
  (`resources/js/types/ebis.ts`, `components/ebis/stage-stepper.tsx`).
- The clean component kit: `StageStepper`, `StatusBadge`, `CategoryBadge`, `SeverityBadge`,
  `MethodBadge` (`components/ebis/*`, `components/ui/*`).
- The page structure under `pages/tenders/*`, `pages/vault`, `pages/company`, `pages/onboarding`,
  `pages/dashboard`.
- UK framing: GBP, Procurement Act 2023, buyer types (central/local/nhs/education/devolved…).

> These are **keepers**. Tweaks must fit *inside* this design, not replace it.

---

## 2. What we admired in REA-NEP (the qualities to borrow)

The reference portal felt sharp for reasons that are **design/UX qualities, not features**:

- **"A board you can read."** A single scannable status board — `REF · ACTIVITY · PHASE · CLOSES ·
  STATUS` — with colour-coded status pills (`ON PLAN`, `HELD`, `LATE`, `DONE`).
- **A legible phase stepper** showing *where you are* ("Phase 5 of 7 · 8/18 complete") with planned
  dates and a current-step highlight.
- **"Logged against a name."** Every action attributable — owner/approver, decision + timestamp,
  a **signature** stamped on sign-offs; an **append-only audit trail**.
- **Working-day rigour.** Deadlines computed in working days; **slippage** shown bluntly
  (`DELAYED +10d`); "server time is authoritative."
- **Trust cues & honest empty states.** "Nothing closes this week." Clear "what to do next" copy.
- **A tidy "key facts" summary card** ("Particulars / The bones") on each case.
- **Compliance with teeth:** document **validity + expiry** tracking, states
  (`verified / under review / needs attention`), and a **mandatory n/n** gate.

None of these change *what our app is for* — they just make it read as crisply as his did.

---

## 3. The tweaks (concrete, mapped to our code)

Priority: **P1** = high value / low effort, **P2** = worthwhile, **P3** = nice-to-have.

### P1 — Dashboard: add a "pipeline board you can read"
- **Where:** `pages/dashboard.tsx` (+ maybe a new `components/dashboard/pipeline-board.tsx`).
- **What:** alongside our win/loss history, add a scannable **active-tenders board**:
  `REF · TITLE · BUYER · STAGE · DEADLINE · STATUS`, using our existing `StatusBadge` + stage chips.
- **Borrowed from:** REA-NEP "live board." **Ours stays supplier-framed** (our tenders, our stages).

### P1 — Deadlines in working days + urgency tone
- **Where:** `lib/ebis.ts` (`deadlineLabel`, `deadlineTone`), `lib/decision.ts`
  (`workingDaysBetween` already exists ✅).
- **What:** show "closes in N working days" and a slippage-style urgency colour as the deadline
  nears; surface it on the board (P1) and tender header (`components/ebis/tender-header.tsx`).

### P1 — Phase stepper: show progress count + current label
- **Where:** `components/ebis/stage-stepper.tsx`.
- **What:** add a small "Stage 6 of 10 · <label>" caption and a completed-count, matching REA-NEP's
  "Phase 5 of 7 · 8/18 complete" legibility. Pure polish on the component we already have.

### P1 — "Key facts" summary card on tender detail
- **Where:** `pages/tenders/index.tsx` / tender detail header (`components/ebis/tender-header.tsx`).
- **What:** a compact key-value panel: `Reference · Buyer · Est. value · Deadline · Sector · Lots ·
  Owner`. (Their "Particulars" card, our fields.) Likely a light refactor of what's already there.

### P2 — Compliance matrix: mandatory gate + validation states
- **Where:** `pages/tenders/[tender]/compliance.tsx`, `pages/tenders/[tender]/requirements.tsx`,
  `data/mock-checklist.ts`, `data/mock-requirements.ts`.
- **What:** add a headline **"Mandatory n/n satisfied"** gate and per-row states
  (`met / not met / needs clarification / pending`) — we already have `RequirementCategory`
  (`mandatory | scored | informational`) and `StatusBadge`; this extends them.

### P2 — Evidence vault: validity, expiry & "satisfies requirement X"
- **Where:** `pages/vault/index.tsx`, `data/mock-vault.ts`, `data/evidence-slots.ts`.
- **What:** show document **validity/expiry** and a **"needs attention"** state (REA-NEP's compliance
  discipline), and link each evidence item to the requirement(s) it satisfies. A **compliance %**
  ring on the vault or dashboard.

### P2 — Decision & submission as recorded, attributable events
- **Where:** `pages/tenders/[tender]/decision.tsx`, `pages/tenders/[tender]/validation.tsx`,
  `pages/activity/index.tsx`, `data/mock-dashboard.ts` (note: "Activity now comes from the audit log").
- **What:** make the **go/no-go decision** and the **final sign-off** render as stamped events —
  *"Decided by <name> · <timestamp>"* — and feed them into the **activity/audit log**. Optional
  **signature** flourish at stage 10 (sign-off & submission), echoing their signed approvals.
  At submission, produce a **timestamped confirmation / receipt** (their `RCP-…` idea, our framing).

### P3 — Editorial voice on landing + honest empty states
- **Where:** `components/marketing/*`, `pages/welcome.tsx`, empty states across `pages/tenders/*`.
- **What:** adopt confident, plain copy and instructive empty states ("No tenders closing this
  week," "Upload a tender pack to begin"). Light copy pass, no layout change.

### P3 — Trust cues
- **Where:** app chrome / footer (`layouts/app/*`).
- **What:** small, honest cues — working-day basis for dates, "last saved" / "server time"
  style reassurance. Tiny, but it's part of why the reference felt trustworthy.

---

## 4. Where WE are already ahead — protect these 🛡️

- **Requirement → source traceability.** Our `Requirement.source` carries
  `{ documentId, page, section, quote }` — we cite *where in the pack* a requirement comes from.
  The reference had nothing like it. **Keep front-and-centre.**
- **Eligibility scoring + gap analysis + go/no-go gate** — a genuine supplier decision engine the
  buyer-side app simply doesn't have.
- **Evidence/profile-fact model** (`ProfileFact` from certificate / financial_statement / case_study
  / cv / policy) — richer than their flat document list.
- **AI-vs-rules method transparency** (`MethodBadge`, `AI_REVIEW_THRESHOLD`) — deterministic rules
  shown as such; AI judgements show confidence and ask for review. A real trust feature.

A tweak that would dilute any of these is **rejected**.

---

## 5. What we will NOT copy (out of scope) 🚫

These are **buyer-side** and belong to the boss's product, not ours:
- Publishing tender notices to a public board.
- Vendor registration / verification desk.
- Receiving, sealing and opening bids from multiple companies.
- Blind committee scoring, award, standstill, contract administration.
- Admin config engine for stages/methods/approval gates.

If the boss ever wants the buyer side, that's a **separate product**, documented elsewhere — not a
tweak to this app.

---

## 6. Suggested rollout order

1. **P1 batch** (one sprint): pipeline board, working-day deadlines, stepper caption, key-facts card.
   → biggest "feels as sharp as his" jump, lowest risk, zero structural change.
2. **P2 batch**: compliance mandatory-gate, vault validity/expiry + linking, decision/submission as
   audit events.
3. **P3 polish**: editorial copy, empty states, trust cues.

Each item is independent — we can cherry-pick. All of them live **inside** the current design.

---

## 7. Reconciliation with the authoritative spec

✅ **Reconciled against `EBIS_Core_Workflow_and_Requirements.docx` (2026-11-05).** The docx confirms
EBIS Core is a supplier-side SME tool with exactly our 10-stage workflow, so every tweak here fits.
Mapping of tweaks → spec requirement IDs (so nothing conflicts):

- Working-day deadlines / urgency → supports `GAP-04` (time-to-close vs deadline), `VAL-04`.
- Compliance mandatory gate + validation states → `BID-01`, `VAL-01`/`VAL-02`/`VAL-06`.
- Vault validity/expiry + "satisfies requirement X" → `PRF-03`, `PRF-05`, `EVD-01`, `EVD-02`.
- Decision/sign-off as recorded, attributable events → `DEC-02`, `VAL-08`, audit log `EVD-05`.
- Pipeline board / key-facts card / stepper caption → pure presentation; no new behaviour.

**Nothing in this plan adds scope beyond the docx** — it only makes existing, specified behaviour
read more crisply.

### Remaining checks
- [ ] Confirm with the boss that "match the new one" = **this polish**, not buyer-side features.
- [x] **Product naming resolved.** EBIS is the contractor; **REA-NEP** is the client. Product name
  is **"REA-NEP eProcurement"** (verbatim from the client's reference portal). Applied across the
  app UI, `.env` (`APP_NAME`), and README on 2026-11-05.
- [x] **Currency kept in GBP (£) for now** (decided 2026-11-09). An NGN/`en-NG` switch was tried and
  reverted; `Money.currency` is `'GBP' | 'EUR' | 'USD'` and formatters use `en-GB`.
- [ ] **Still UK-framed (next pass):** mock amounts are the old GBP figures now labelled ₦ (small for
  NGN contracts); the sample scenario (Bluewave, Sheffield) and buyer types (NHS/council/devolved)
  are still UK; procurement rules still cite the UK Procurement Act 2023. Localise these to
  Nigeria / World-Bank when ready.
- [ ] Decide which P1 items to do first (recommend: pipeline board + key-facts card).
```
