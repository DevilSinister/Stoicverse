# Influencer Implementation Plan

## Stoicverse

**Last updated:** July 12, 2026
**Scope:** Influencer-role dashboard and permission model — supplements 05_IMPLEMENTATION_PLAN.md

---

## 1. Permission model — two independent axes

The permission system is **two separate axes**, not one hierarchy. This is the foundational rule everything below depends on.

### Axis 1 — Role (Discord-style, administrative)
`Member → Moderator → Influencer → Super Admin`

- Governs what a user can **do**: moderate content, manage tiers/events, administer the platform.
- A Moderator or Influencer **bypasses tier-gating entirely**, regardless of what tier they personally hold. Role checks short-circuit tier checks.

### Axis 2 — Tier (progression, content-gating)
`Tier 1 → Tier 2 → Tier 3 → Tier 4`

- Governs what content/events a **plain member** can access.
- Mutually exclusive and progressive: a member holds exactly **one** tier at a time. Advancing to Tier 3 replaces Tier 2 — it is an UPDATE on the membership row, never an additional row alongside the old tier.
- Tier advancement is driven only by existing unlock logic (85% watch completion, sequential lesson unlocks). Nothing else should touch `tier_id`.

### RLS implication
Authorization checks should be an **OR**, not nested AND, so the two axes never get tangled:

```
allow if (role IN ('moderator','influencer','super_admin')) OR (tier >= required_tier)
```

### Event access rule
"Which roles can join" is really two filters combined:
- Minimum tier required, **and/or**
- Role override (Moderators/Influencers always allowed regardless of tier)

Example: an event can specify "Tier 3+ members, plus all Moderators/Influencers."

---

## 2. Influencer Dashboard — surfaces

### 2.1 Home / Analytics
- Member count, tier distribution, active vs suspended counts
- Event attendance stats
- Revenue/gifted-vs-paid breakdown (if Stripe data is wired in)
- Recent activity feed

### 2.2 Members
Replaces the generic "mentorship" view — this is the operational hub.

- List of enrolled members: name, current tier, join date, upcoming class/session timings they're enrolled in
- Filters: tier, role, status (active/suspended), search by name
- Row actions:
  - **Promote to Moderator**
  - **Gift membership** (1/3/6/12 months) — see §3
  - **Kick out** (remove/suspend from community)

### 2.3 Learning (Tiers)
- Create / edit / delete tiers
- Per tier:
  - Upload lesson videos
  - Set unlock rules (sequential unlock order, % watch requirement, prerequisite tier)

### 2.4 Events
- Full CRUD: create, edit, delete
- Per event: set access rule per §1 (minimum tier and/or role override)
- Existing delayed Zoom-link publish feature carries over unchanged

---

## 3. Gifting membership — rules

Gifting is a **pure billing-layer action**. It never touches tier or progression state.

| Field | Behavior |
| --- | --- |
| `payments` row | New row created: `amount: 0`, `source: gifted`, `granted_by: <influencer_id>`, `duration_months: N` |
| `membership.expires_at` | Extended by N months |
| `membership.status` | Set/kept `active` |
| `membership.tier_id` | **Untouched** — member stays on whatever tier they currently hold |
| Watch/lesson progress | **Untouched** — no interaction with progression data at all |

- Gifting **only bypasses payment and extends access duration.** It does not advance, reset, or otherwise modify the member's tier.
- A member still has to meet normal unlock criteria (watch %, sequential lessons) to climb tiers, gifted or not.
- Full payment history is preserved (as a $0 transaction) rather than omitted, so gifted access shows up in the same audit trail as paid access.

---

## 4. Membership lapse behavior

- If a **paid** membership expires without renewal, the member's **tier progression is preserved, not reset.**
- On repayment, the member continues from the same tier and progress state they had when access lapsed — no restart.
- This applies identically whether the prior period was paid or gifted — lapse behavior is the same regardless of how the expiring period was funded.

---

## 5. Open questions (not yet resolved)

- **Gift tier selection:** does gifting require the influencer to also pick a tier for members with no prior membership (first-time gift), since duration alone doesn't specify a starting tier?
- **Expiry notifications:** should an expiring gifted membership trigger the same "your access is ending" email as a paid one, given the existing Resend/notification build is already planned?
- **Kick out semantics:** does "kick out" map to the existing suspension flag (reversible, preserves post history) or a hard delete? Recommendation: map to suspension for consistency with the RLS/suspension rules already planned in the main implementation doc.
