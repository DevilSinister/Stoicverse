# Product Requirements Document

## Stoicverse

**Version:** 2.0
**Last updated:** July 12, 2026

## Product

Stoicverse is one paid Stoic learning community. It combines a read-led community feed, a gated curriculum, live events, tier progression, Master review applications, and optional mentorship. It is a single-community product, not a marketplace or a platform with separate community instances.

## Users and permissions

| Role | Capabilities |
| --- | --- |
| Member | Consume eligible community content, complete lessons, react to posts, enrol in eligible events, apply for mentorship and—after Master unlock—review and team applications. |
| Moderator | Member capabilities plus publish, pin, and delete community posts; create and manage events; warn or suspend members. |
| Influencer | Uses the protected `/creator` workspace, which reuses the member UI and sidebar while namespacing the influencer journey under `/creator/*`. One global influencer account is allowed. |
| Super admin | Platform-wide operations: roles, members, payments, settings, and moderation. |

Members cannot create posts, channels, direct messages, or access content, links, or video identifiers above their earned tier.

## Required MVP behaviour

- A verified account purchases one $10 Stoicverse membership through Stripe. A successful, verified webhook activates the membership and Tier 1.
- Members see only active channels, posts, lessons, event links, and Master content allowed by their membership and tier. Restricted content must not be returned to the browser before access is checked.
- The curriculum is managed as named courses such as Basic, Beginner, and Intermediate. Members enrol only when their tier and all configured prerequisite courses qualify; videos unlock in order at 80% watch progress. A finished course awards its configured higher tier after all required videos are complete.
- The influencer may release videos over time and marks the course finished when its completion set is ready. Required videos added later reopen dependent-course access; optional additions do not revoke members who had already completed the course.
- Course videos use authenticated Google Drive preview embeds. Store provider identifiers in a protected asset table, never return them before access is authorized, and never store the original sharing URL.
- Staff can publish community content and events from the same member-facing surface. Event cards remain visible when relevant, but the Zoom link is available only to qualified members.
- Master members can submit a review application. Staff can review it, schedule a call, record the outcome, and unlock a team application after approval.
- Any active member may buy the $1,000 mentorship. Staff can assign a mentor, dates, resources, and a booking link after payment succeeds.
- In-app notifications cover account, payment, tier, event, review, and mentorship status. Event creation, updates, cancellation, and room publication notify active members in-app only; event email is not part of the current workflow.

## Non-goals and deferred behaviour

- Separate communities, community slugs, community discovery, tenant-scoped roles, and creator-owned communities are out of scope because Stoicverse uses one global community.
- Native apps, social login, direct messages, member-to-member interaction, referrals, certificates, an AI assistant, and downloadable resources.
- Annual membership and recurring subscription plans. These are not approved product behaviour; remove the current annual-plan UI until a separate product decision is made.

## Success criteria

- An eligible member can complete the full signup, payment, course, tier-unlock, event, Master-review, and mentorship flows without staff database intervention.
- Role and tier restrictions are enforced by the database and server, not merely hidden in the UI.
- The interface remains quiet, precise, and legible on desktop and mobile.
