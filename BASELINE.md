# STABLE BASELINE — ProDigital v44.0.0

> **This document describes the official stable baseline and the rules around it.**
> **Read it before doing any development on this repository.**

---

## 1. Source commit (DO NOT CHANGE)

```
8f148077ea1ae58b78f8741100e97893ef2e93ce
```

This is the **last known stable commit** of ProDigital. Any new development MUST
branch from this commit, never from `v54-dev`.

---

## 2. Branch layout

| Branch                | Status             | Purpose                                                                 | Protection                           |
| --------------------- | ------------------ | ----------------------------------------------------------------------- | ------------------------------------ |
| `v55-stable-dev`      | **Active dev line** | New development. Branched directly from the stable commit.              | None (work happens here)             |
| `final-2026-08-25`    | Frozen snapshot    | Historical snapshot of the stable commit. Will not receive new commits.  | None                                 |
| `v54-dev`             | **FROZEN**         | Old broken line. Kept for archive / reference only. No merges from here. | PR review required, no force-push, no delete |

---

## 3. Tag layout

| Tag                    | Points to                              | Meaning                                                |
| ---------------------- | -------------------------------------- | ------------------------------------------------------ |
| `v44.0.0-stable`       | `8f148077ea1ae58b78f8741100e97893ef2e93ce` | **STABLE BASELINE** — the only tag safe to deploy.  |
| `v1.0-final-2026-08-25` | `0c55450` (parent commit)              | Historical tag from the original "Final Release" commit. **Do not deploy from this tag.** |

---

## 4. Why we rolled back from v54-dev

`v54-dev` introduced Read Models and read-mode logic that caused:

- Slow data loading on first paint
- Inconsistent financial numbers during data hydration
- Dashboard vs Modal balance mismatches
- Today / Yesterday calculation errors
- Edit / Delete issues
- Read Model synchronization bugs
- Page-dependent result differences

The cost was unacceptable. We returned to the last known good code state.

---

## 5. What this baseline PRESERVES (do not change)

The following accounting behaviors are part of the stable contract and MUST NOT
be changed without explicit user sign-off and independent QA:

- **PAM** (Profit Allocation Model)
- **Capital snapshots** and capital history
- **Investor allocation** rules
- **Manager profit distribution** (including the legacy 30% / 20% / 10% / 40% history)
- **Treasury** accounting
- **Client balances** and client debt
- **Historical accounting rules** (back-dated values must stay back-dated)
- **Manager fee history** (`getManagerFeeAt` and the historical effective dates)

---

## 6. What this baseline EXCLUDES

The following features from `v54-dev` are **not** part of the stable baseline and
must NOT be re-introduced as a bulk merge:

- `query-plan` architecture
- `stale read model` logic
- `dashboard_summary` read dependency
- partial / full history switching
- mutation delta architecture
- "Transfert de solde entre clients" (will be re-implemented cleanly on `v55-stable-dev` when needed)

---

## 7. How to develop

1. Branch from `v55-stable-dev` (or from the exact commit `8f14807`).
2. Make focused, single-feature commits.
3. Before adding a feature, write or update tests that compare its output
   against the stable baseline behavior.
4. Never run database migrations, schema rebuilds, or data cleanups from this
   branch — that work is explicitly forbidden (see §8).

---

## 8. Strictly forbidden (no exceptions without user approval)

- ❌ Firebase migration
- ❌ Read Model rebuild
- ❌ Accounting migration
- ❌ Database cleanup
- ❌ Delete old data
- ❌ Reset user data
- ❌ Bulk merge from `v54-dev`
- ❌ Cherry-pick from `v54-dev` without independent review

The rollback is a **code rollback only**. The Firebase database is untouched.

---

## 9. Production deployment

- Production deploys must point to the exact commit `8f14807…`, not to a moving HEAD.
- A **Preview deployment** must be created first and signed off by the user
  before any production promotion.
- The preview must be tested against the checklist in §10.

---

## 10. Preview checklist (mandatory before production)

- [ ] Dashboard numbers match the user's last known good values
- [ ] Caisse / Treasury totals match
- [ ] BaridiMob totals match
- [ ] Portfolio numbers match
- [ ] Clients list and balances match
- [ ] Investors list and allocations match
- [ ] Personal expenses totals match
- [ ] Today profit is correct
- [ ] Yesterday profit is correct
- [ ] Navigation between pages works
- [ ] Refresh (full reload) does not change displayed numbers
- [ ] Login works
- [ ] Create transaction works
- [ ] Edit transaction works
- [ ] Delete transaction works
