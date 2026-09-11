# Creator Analytics and Revenue Plan

Status: Analytics and Revenue reporting pages implemented against existing records. When the server payment reader is not configured, Revenue uses the existing creator-authorized USD aggregate and keeps transaction-level sections explicitly unavailable; turnover reporting continues to load. Credit ledger, referral attribution/rewards, refund/fee syncing, and withdrawal operations remain planned.

## Revenue implementation

- `/creator/revenue` contains Overview, Transactions, Member Credits, and Withdrawals in the established creator shell.
- Overview reports original gross payments, unique paying members, average payment, payments currently marked refunded, product mix, daily/seven-day trends, and paying-member rankings. Currency totals are never combined or converted.
- Filters cover completed UTC date ranges (7/30/90/365-day presets and custom ranges), currency, product, recorded payment status, payment source, current membership/tier, and member name/exact ID. Main filters and section selection are preserved in the URL.
- Payment history supports search, sorting, expandable details, 20-row pagination, and CSV export with stable transaction and member references. Gifts stay separate from income. Unpaid rows use creation date; paid rows use payment date. Missing payment dates are surfaced and excluded from gross totals.
- A refunded status does not establish the actual refund amount. The report labels original values of payments marked refunded and leaves actual refunds, fees, and net proceeds unavailable. Existing webhook handling does not synchronize refund/fee records, so saved statuses may differ from the processor.
- Member Credits reports existing turnover for complete UTC weeks contained in the selected date range, with member/lifetime totals and last-saving staff details. Payment-specific filters do not apply to this USD report. Balances, reservations, and referral rewards are explicitly not connected. A turnover-read failure preserves working payment reporting.
- Withdrawals explains the agreed manual payout flow and missing configuration. It does not fabricate balances or provide controls that claim to send/approve transfers without a ledger.
- `/api/creator/revenue` first authenticates and authorizes a non-suspended influencer. When configured, its server-only data layer uses the existing service-role client for an explicit minimal payment projection because raw payment RLS intentionally does not grant influencers cross-member reads. It never selects processor/customer identifiers or webhook payloads. Without that key, it falls back to `get_creator_overview_metrics` for an unfiltered USD gross total and marks transaction, customer, product, and refund details unavailable. Profiles, tiers, memberships, and turnover retain session-bound RLS. No database policy is broadened and no money is mutated.
- Deployment uses the existing `SUPABASE_SERVICE_ROLE_KEY` server configuration and existing schema migrations; no new migration is required. All source pages are read before returning totals, with a visible failure beyond the current 100,000-row-per-source capacity.
- Validation covers precision, currencies, refunded status vs original values, period boundaries, first-time purchasers, gift/unpaid exclusions, partial weeks, authorization-before-privilege, pagination beyond 1,000 records, and partial source failures. Responsive layout inspected with synthetic records; live account verification requires creator sign-in.

## Analytics implementation

- `/creator/analytics` now contains Overview, Trading, Courses, Events, and Referrals sections within the existing creator shell.
- `/api/creator/analytics` authorizes the influencer and loads session-bound, RLS-protected records. It fetches every page before returning totals, fails visibly on incomplete loads, and refuses sources above 100,000 rows rather than truncating totals. Larger datasets will need database aggregation before exceeding this capacity.
- Date presets cover 4, 12, 26, or 52 completed UTC weeks; custom ranges must span Monday through Sunday. Reports compare the preceding equal-length range.
- Current tier, membership status, access source, and member search filter all report sections. Relevant sections add course, host, event status, minimum turnover, and missing-entry filters. Tables support sorting, 10-row pagination, expandable details, and CSV export. Main filters and active section are preserved in the URL; section filters survive switching tabs.
- Course viewers and accumulated progress hours are explicitly lifetime snapshots. Enrolments, first course completions, and lesson completion timestamps use the selected period. Cohort completion reports current completion among members enrolled during the selected period, observed through the report timestamp.
- Event metrics count retained enrolments by enrolment date and exclude cancelled/draft events. Existing deletions mean historical cancellation reporting cannot be reconstructed.
- Referral rankings, trading-platform breakdowns, daily learning activity, and retention remain explicitly untracked because the corresponding records are unavailable. Turnover reports do not imply that balances have been credited or paid out.
- The page does not change any credit, payout, turnover-write, or membership behavior. No migration is required for this read-only page beyond the project's existing schema migrations.
- Validation: production build, TypeScript, targeted ESLint, and calculation regression tests. Desktop/mobile layout inspected using synthetic records. Live authenticated data verification requires a creator session.

## Confirmed product rules

- One global community and creator workspace.
- Members identify their trading platform and trading email or trader ID. Staff track earnings externally; no broker integration is required.
- Moderators manually credit member turnover. These credits are withdrawable.
- A website referrer earns $5 once after the referred member's first successful membership payment. Signup alone and later payments do not qualify.
- Refund of the qualifying payment reverses the referral reward.
- Member credits are paid out manually through crypto.
- Event participation reporting uses enrolments, not verified attendance.

## /creator/analytics

Purpose: Understand growth, member performance, learning, events, and referral effectiveness.

Tabs: Overview, Trading, Courses, Events, Referrals. Member engagement reports sit in Overview and Courses.

### Overview

- Up to six headline metrics: active members, new members, trading credits recorded, active learners, course completions, and event enrolments.
- Previous-period comparisons, growth/activity trends, and compact previews of the leading trader, course, event, and referrer.
- Member retention by joining cohort, tier distribution/progression, and inactivity segments.
- Define active members through recorded meaningful activity. Until dated activity is available, do not substitute active membership status for activity.

### Trading

- Top members by selected-period turnover, lifetime turnover, and period-over-period change.
- Weekly trend, totals by trading platform, contributing-member count, median contribution, and contribution share.
- Table: member, platform, selected-period turnover, previous-period turnover, change, lifetime total, and last credited date.
- Distinguish missing entries from recorded zero. Rank using all matching records, not only the visible table page.
- Link to authorized credit operations and member detail; do not make a report view an implicit balance mutation.

### Courses

- Most watched defaults to unique viewers; allow ranking by watch hours, starts, and completions.
- Per course: enrolments, unique viewers, recorded watch hours, starts, completions, completion rate, average progress, and time to completion where supported.
- Lesson breakdown identifies where learners stop progressing.
- Learner rankings: courses completed, lessons completed, recorded watch time, and active learning days. Default to courses completed, then lessons completed.
- Define completion rate as completions among the selected starter cohort, with its observation window stated. Separate period completions from cohort completion rate.
- Course progress snapshots cannot reconstruct historical viewing sessions. Add dated playback events before presenting period watch-time or lesson drop-off claims that require them.

### Events

- Most enrolled events, enrolment counts, distinct enrollees, capacity filled when a capacity exists, and repeat enrollees across events.
- Event table: title, host, event date, status, enrolments, capacity, and fill rate.
- Event-date range is distinct from enrolment-date range. Exclude cancelled enrolments from current enrolment totals while preserving cancellation history.
- Do not label enrolments as attendance, or report no-shows or attendance duration without new tracking.

### Referrals

- Referred signups, first-time paying referrals, signup-to-paid conversion, rewards earned/reversed, and referred-member engagement.
- Top referrer defaults to qualifying paid referrals remaining after reversals. Show gross qualifying and reversed counts separately.
- Referral funnel: attributed signup to first successful membership payment to reward to reversal, if applicable.
- Show conversion by signup cohort with a stated observation window; do not divide unrelated period payment and signup totals.

## /creator/revenue

Purpose: Understand business receipts, credits owed to members, and crypto payout operations.

Tabs: Overview, Transactions, Member Credits, Withdrawals.

### Overview

- Business receipts: membership sales, mentorship sales, refunds, net sales, and known processing fees.
- Member obligations: trading credits issued, referral rewards issued/reversed, available balances, and funds reserved for withdrawals.
- Payouts: requested, processing, completed, rejected, and failed; show counts and amounts.
- Separate business receipts, member credit issuance, and payout cash movements. A payout settles an existing balance and must not count credit expense a second time.
- Do not label a computed figure profit without the required cost/funding data. No recurring-revenue metrics unless recurring billing is approved.

### Transactions

- Searchable membership/mentorship payment records: member, product, date, amount, refund amount, status, referrer, and transaction reference.
- Gifted access is a zero-value grant, not a paid conversion or referral-qualifying payment.

### Member Credits

- Proposed one USD-denominated member balance with distinct Trading credit, Referral reward, Adjustment, Reversal, and Withdrawal entries.
- Table: member, credit source, trading platform where relevant, amount, effective period, created date, issuing staff member, reason, and linked source record.
- Member detail shows available balance, reserved funds, lifetime credits by source, reversals, and completed withdrawals.
- Moderators may issue trading credits as confirmed. Payout approval permissions remain an explicit configuration decision; do not infer them from credit permission.

### Withdrawals

- Member requests an amount and configured crypto destination; reserve the amount immediately to prevent concurrent spending.
- Proposed manual flow: Requested -> Processing -> Paid. Rejected or confirmed failed requests release the reservation once.
- Authorized staff inspect the request, send crypto externally, and record asset, network, actual crypto amount, fees, transaction reference, and paid timestamp.
- An uncertain transfer stays under review; do not release funds or send again merely because confirmation is delayed.
- Never mark a request paid before the external transfer is verified. Report internal credit currency and actual crypto payout amount separately.

## Shared filters and interaction

- Shared: date range, previous equal-length period, member search, tier, membership status, paid/gifted access, and referring member.
- Trading: ISO week range, platform, credit amount range, recorded/missing, and ranking metric. Preserve existing UTC week boundaries; do not prorate weekly totals into invented daily values.
- Courses: course, lesson, cohort, and progress/completion status.
- Events: event, host, status, event-date range, and enrolment-date range.
- Revenue: product, credit source, platform, payment/refund status, withdrawal status, and payout network where relevant.
- Apply only relevant filters in each section. Label unsupported filters instead of silently ignoring them.
- Preserve filters in navigation, expose active filters and Reset, and provide sortable paginated tables and authorized CSV exports.
- Show reporting timezone, definitions, and last update. Prior-period zero shows New/no comparable baseline rather than infinite percentage growth.
- Show loading, retryable error, empty, filtered-empty, partial-data, and Not tracked yet states distinctly. Never represent unavailable tracking as zero.
- Desktop uses dense readable tables; mobile retains the same fields through compact rows and details. Preserve the existing dark/emerald design system.

## Credit correctness and data requirements

- Use an append-only balance ledger. Corrections create linked adjustments rather than rewriting posted credit history.
- Reuse each confirmed turnover source record as a unique credit source. Editing a credited weekly amount posts only the difference; saving unchanged data posts nothing.
- If a correction reduces already withdrawn credit, preserve the debt/adjustment trail and flag it for resolution. The negative-balance handling policy must be configured before launch.
- Make first-payment referral awards and refund reversals idempotent, including duplicate payment notifications. One referred member cannot earn multiple first-payment awards.
- Store the attributed referrer before payment, block self-referrals, and preserve attribution after award. Multiple-link attribution and partial-refund treatment remain open policy decisions.
- Track trading platform/account mapping alongside credits. Do not assume historical turnover has platform attribution if it was never captured.
- Historical turnover is not automatically a new wallet credit: reconcile prior credits and payouts before setting opening balances.
- Add dated referral, learning, enrolment, payment, credit, and payout records as needed for truthful period reporting.
- Enforce reporting, credit issuance, and withdrawal permissions server-side. Trading identifiers and payout destinations belong in authorized detail views and exports.

## Delivery sequence

1. Reconcile existing records and finalize ledger, attribution, permission, and withdrawal policies.
2. Build Analytics with available trading/course/event data and explicit tracking gaps; add dated measurement where needed.
3. Build Revenue payment reporting and member credit ledger; connect manual turnover to idempotent ledger credits.
4. Add first-payment referral awards and refund reversals, then referral reports.
5. Add the manual crypto withdrawal request/review/history flow and reconcile balances.
6. Verify aggregate accuracy, filters and exports, role boundaries, duplicate saves/webhooks, refunds after withdrawal, concurrent withdrawal requests, rejected requests, and historical opening balances.

## Remaining configuration before payout implementation

- Supported crypto asset/network, minimum withdrawal, fees, and any conversion rule.
- Staff allowed to approve/record payouts and whether approval must differ from the credit issuer.
- Handling of reversals exceeding available balance; proposed default is a visible debt balance that blocks further withdrawal until resolved.
- Whether partial membership refunds reverse the whole $5 reward or a proportional amount.
- Multiple-referral-link attribution policy; proposed default is the referrer recorded at signup, locked for the first payment.

These open settings do not block page planning. They must not be silently invented for payout implementation.
