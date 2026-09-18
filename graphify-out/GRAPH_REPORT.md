# Graph Report - StoicWealthSociety  (2026-09-18)

## Corpus Check
- 489 files · ~438,023 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2395 nodes · 5300 edges · 196 communities (152 shown, 44 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `be400094`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- access.ts
- SearchOverlay.tsx
- community-settings/model.ts
- CreatorCourseManagerV2.tsx
- tokenize.ts
- EventsView.tsx
- AccountSettingsWorkspace.tsx
- compilerOptions
- Content safety
- What You Must Do When Invoked
- CreatorOverviewView.tsx
- components.json
- claude-fable-5.md
- EventsDirectoryPage.tsx
- dependencies
- devDependencies
- constants.ts
- EmojiPicker.tsx
- Influencer Implementation Plan
- AutomodSection.tsx
- createClient
- alert-dialog.tsx
- Graphify Workflow
- Product Requirements Document
- Stoicverse Design System
- @dnd-kit/sortable
- design_md.md
- Implementation Plan and Delivery Status
- CreatorAnalyticsView.tsx
- package.json
- App Flow
- graphify reference: extra exports and benchmark
- Stoicverse Product Context
- Technical Requirements Document
- Database Schema
- Client Screen Inventory
- graphify reference: query, path, explain
- CRITICAL BROWSER STORAGE RESTRICTION
- signup/confirm/page.tsx
- workspace.ts
- rls.integration.mjs
- UI/UX Standards
- Row Level Security
- Memberships
- Do NOT use artifacts for
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- Gifted Membership
- README.md
- Learning Path
- Live Sessions
- index.ts
- MVP Launch Gaps
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- Stoic Methodology
- next.config.ts
- Production Security Checklist
- Advanced Position Sizing Lesson
- Login
- Institutional Mentorship
- Learning Roadmap
- AskStoic Design System
- AGENTS.md
- CLAUDE.md
- .claude/CLAUDE.md
- extraction-spec.md
- CreatorRevenueView.tsx
- Cairn Design System Reference
- eslint.config.mjs
- MemberRegistry.tsx
- RolesSection.tsx
- CreatorEventsView.tsx
- button.tsx
- postcss.config.mjs
- Skeletons.tsx
- AuditLogSection.tsx
- checkout/page.tsx
- StructureForm.tsx
- DeletionPendingScreen.tsx
- login-bypass.ts
- checkout.contract.mjs
- useToast
- SetPasswordForm.tsx
- Premium Account Registration
- Billing Interval Toggle
- security/README.md
- Single-community Model
- Next.js Agent Rules
- File Icon
- Globe Icon
- Next.js Logo
- Vercel Logo
- Window Icon
- Mobile Checkout Screen
- Desktop Dashboard with Discord Sidebar
- Mobile Member Dashboard
- Community Selection
- Sign-up Form
- Subscription Commitment
- Super Admin Dashboard
- Video Lesson Player
- Medium
- Creator Analytics and Revenue Plan
- Stoicverse project and branch status
- AuthForm.tsx
- withRouteBase
- community-settings/permissions.ts
- AppRail.tsx
- proxy.ts
- login/route.ts
- ChannelPermissionsTab.tsx
- Migrations — how this project actually deploys
- member-avatar.tsx
- cn
- requireActiveMembership
- overlay.tsx
- messages.ts
- next
- LandingScreen.tsx
- field.tsx
- public-chrome.contract.mjs
- message-actions.ts
- utils.ts
- sections.ts
- VideoPage.tsx
- design-tokens.contract.mjs
- viewer.ts
- ChannelView.tsx
- VoiceRecorder.tsx
- react-dom
- @dnd-kit/utilities
- menu-parts.tsx
- StructureList.tsx
- @supabase/supabase-js
- community-migrations.contract.mjs
- requireInfluencerWorkspace
- app/master/page.tsx
- @dnd-kit/core
- AppShell.tsx
- CourseCatalogPage.tsx
- dashboard/settings/page.tsx
- plans.ts
- channels.contract.mjs
- MemberList.tsx
- createAdminClient
- presence.ts
- CommunityProvider.tsx
- auth/actions.ts
- toggle-group.tsx
- lucide-react
- MessageMenu.tsx
- app/mentorship/page.tsx
- combobox.tsx
- @supabase/ssr
- EmojiSection.tsx
- auth-recovery.contract.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 183 edges
2. `createClient` - 76 edges
3. `postgresMessage()` - 54 edges
4. `buttonVariants()` - 40 edges
5. `revalidateCommunity()` - 40 edges
6. `Button()` - 37 edges
7. `isUuid()` - 37 edges
8. `useToast()` - 36 edges
9. `createClient()` - 36 edges
10. `requireInfluencerWorkspace()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `Cairn Design System Reference` --semantically_similar_to--> `Cairn Pricing Page Reference`  [INFERRED] [semantically similar]
  cover.webp → preview-desktop.png
- `parseEmojiName()` --references--> `name`  [EXTRACTED]
  src/lib/community/emojis.ts → package.json
- `ChannelView()` --indirect_call--> `message()`  [INFERRED]
  src/components/channels/ChannelView.tsx → tests/channels-message-actions.test.mjs
- `buildRevenue()` --indirect_call--> `row()`  [INFERRED]
  src/lib/revenue/model.ts → tests/community-settings-order.test.mjs
- `useComboboxAnchor()` --references--> `react`  [EXTRACTED]
  src/components/ui/combobox.tsx → package.json

## Import Cycles
- 2-file cycle: `src/components/dashboard/DashboardView.tsx -> src/components/dashboard/TerminalDashboard.tsx -> src/components/dashboard/DashboardView.tsx`
- 2-file cycle: `src/components/courses/CourseCatalog.tsx -> src/components/courses/LearningPathCatalog.tsx -> src/components/courses/CourseCatalog.tsx`

## Hyperedges (group relationships)
- **Member Value Flow** — 01_prd_membership_activation, 01_prd_curriculum_progression, 01_prd_mentorship [EXTRACTED 1.00]
- **Protected Access Model** — 04_database_schema_profiles, 04_database_schema_memberships, 04_database_schema_course_video_assets [EXTRACTED 1.00]
- **Checkout Screen Variants** — stitch_screens_ask_stoic___checkout_checkout_screen, stitch_screens_ask_stoic___checkout_desktop_checkout_desktop_screen, stitch_screens_ask_stoic___checkout_mobile_checkout_mobile_screen [INFERRED 0.85]
- **Dashboard Screen Variants** — stitch_screens_ask_stoic___dashboard_desktop_dashboard_desktop_screen, stitch_screens_ask_stoic___dashboard_desktop__discord_sidebar_dashboard_discord_sidebar_screen, stitch_screens_ask_stoic___dashboard_mobile_dashboard_mobile_screen [INFERRED 0.85]
- **Trading Education Learning Flow** — stitch_screens_ask_stoic___trading_education_platform_trading_education_platform, stitch_screens_ask_stoic___trading_education_platform_learning_roadmap, stitch_screens_ask_stoic___trading_education_platform_progression_model [EXTRACTED 1.00]

## Communities (196 total, 44 thin omitted)

### Community 0 - "access.ts"
Cohesion: 0.22
Nodes (10): AdminPage(), BlockedPage(), dynamic, ChannelsIndexPage(), dynamic, AdminScreen(), membershipState, requireCommunityAccess() (+2 more)

### Community 1 - "SearchOverlay.tsx"
Cohesion: 0.09
Nodes (30): Hit, KIND_LABEL, KIND_ORDER, Row, SearchOverlay(), LOCAL_RESULTS_PER_KIND, localCandidates(), RankedResult (+22 more)

### Community 2 - "community-settings/model.ts"
Cohesion: 0.06
Nodes (47): AccentField(), IdentityPreview(), IdentitySection(), RoleColorField(), SafetySection(), when(), Checkbox(), Input() (+39 more)

### Community 3 - "CreatorCourseManagerV2.tsx"
Cohesion: 0.09
Nodes (38): ActionResult, addCourseVideo(), addLesson(), createCourse(), deleteCourse(), deleteCourseVideo(), driveId(), enrollInCourse() (+30 more)

### Community 4 - "tokenize.ts"
Cohesion: 0.18
Nodes (14): collectMentions(), Cursor, ENTITY_PATTERNS, INLINE_DELIMITERS, isWordChar(), JUMBO_EMOJI_LIMIT, MAX_DEPTH, MentionKind (+6 more)

### Community 5 - "EventsView.tsx"
Cohesion: 0.24
Nodes (11): duration(), EventCard(), EventDetails(), EventsView(), formatter, label(), state(), STATE_LABEL (+3 more)

### Community 6 - "AccountSettingsWorkspace.tsx"
Cohesion: 0.17
Nodes (19): authenticatedMember(), avatarTypes, rateLimit(), removeAvatar(), requestAccountDeletion(), revokeOtherSessions(), saveNotificationPreferences(), updateDisplayName() (+11 more)

### Community 7 - "compilerOptions"
Cohesion: 0.06
Nodes (34): dom, dom.iterable, esnext, **/*.mts, .next-build/dev/types/**/*.ts, .next-build/types/**/*.ts, .next/dev/types/**/*.ts, next-env.d.ts (+26 more)

### Community 8 - "Content safety"
Cohesion: 0.07
Nodes (28): ask_user_input_v0, bash_tool, Content safety, conversation_search, create_file, Critical NEVER search for images in following categories (blocked):, Examples of when **NOT** to use image search:, fetch_sports_data (+20 more)

### Community 9 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 10 - "CreatorOverviewView.tsx"
Cohesion: 0.11
Nodes (16): CalendarDay(), CreatorOverviewView(), currency, DateRange, DateRangeFilter(), delta(), eventTime(), FilterOption (+8 more)

### Community 11 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "claude-fable-5.md"
Cohesion: 0.11
Nodes (18): After search, Connector directory first, Data Scope, Design guidance, Error Handling, Explicit triggers, Key Design Pattern, Limitations (+10 more)

### Community 13 - "EventsDirectoryPage.tsx"
Cohesion: 0.60
Nodes (3): DashboardEventsPage(), renderEventsPage(), EventRecord

### Community 14 - "dependencies"
Cohesion: 0.12
Nodes (17): @base-ui/react, class-variance-authority, clsx, emojibase-data, dependencies, @base-ui/react, class-variance-authority, clsx (+9 more)

### Community 15 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 16 - "constants.ts"
Cohesion: 0.13
Nodes (20): ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES, ATTACHMENTS_PER_MESSAGE, ChannelNotificationLevel, CUSTOM_EMOJI_TOKEN, formatBytes(), FORWARD_CHANNEL_LIMIT, isAllowedAttachmentType() (+12 more)

### Community 17 - "EmojiPicker.tsx"
Cohesion: 0.07
Nodes (50): generate(), OUTPUT, require, root, applySkinTone(), buildIndex(), CompactEmojiInput, EMOJI_GROUPS (+42 more)

### Community 18 - "Influencer Implementation Plan"
Cohesion: 0.12
Nodes (15): 1. Permission model — two independent axes, 2.1 Home / Analytics, 2.2 Members, 2.3 Learning (Tiers), 2.4 Events, 2. Influencer Dashboard — surfaces, 3. Gifting membership — rules, 4. Membership lapse behavior (+7 more)

### Community 19 - "AutomodSection.tsx"
Cohesion: 0.08
Nodes (37): geist, jetbrainsMono, metadata, viewport, RuleDraft, RuleEditor(), AutomodSection(), draftFor() (+29 more)

### Community 20 - "createClient"
Cohesion: 0.05
Nodes (92): RFC-4122, POST(), runtime, POST(), GET(), POST(), GET(), runtime (+84 more)

### Community 21 - "alert-dialog.tsx"
Cohesion: 0.15
Nodes (9): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+1 more)

### Community 22 - "Graphify Workflow"
Cohesion: 0.14
Nodes (14): Graphify, Incremental Update, Graph Exports, Extraction Schema, Multi-repository Merge, Post-commit Rebuild, Graph Query, Transcription (+6 more)

### Community 23 - "Product Requirements Document"
Cohesion: 0.15
Nodes (12): Authorization Boundary, Creator Workspace, Curriculum Progression, Membership Activation, Mentorship, Non-goals and deferred behaviour, Product, Product Requirements Document (+4 more)

### Community 24 - "Stoicverse Design System"
Cohesion: 0.15
Nodes (12): Accessible Interaction, Direction, Identity Command Center, Interaction and accessibility, Layout and components, Mobile, Notification Inbox, Palette (+4 more)

### Community 26 - "design_md.md"
Cohesion: 0.15
Nodes (12): Brand & Style, Buttons, Cards, Chips & Status Indicators, Colors, Components, Data Visualization, Elevation & Depth (+4 more)

### Community 27 - "Implementation Plan and Delivery Status"
Cohesion: 0.18
Nodes (10): Access and data safety, Community and curriculum, Documentation maintenance rule, Existing extra or unapproved behaviour, Implementation Plan and Delivery Status, Implemented foundation, Must complete before MVP launch, Payments and account lifecycle (+2 more)

### Community 28 - "CreatorAnalyticsView.tsx"
Cohesion: 0.07
Nodes (44): GET(), CreatorAnalyticsPage(), Cell, Courses(), CreatorAnalyticsView(), date(), delta(), Events() (+36 more)

### Community 29 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, test:security (+1 more)

### Community 30 - "App Flow"
Cohesion: 0.25
Nodes (8): App Flow, In-app Notifications, Member Journey, Notifications, Public and onboarding, Public Onboarding, Staff Journey, Stoicverse single-community flow

### Community 31 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 32 - "Stoicverse Product Context"
Cohesion: 0.22
Nodes (8): Explicit non-goals, Global Roles, Principles, Product purpose, Scope, Stoicverse Product Context, Structured Learning Path, Users

### Community 33 - "Technical Requirements Document"
Cohesion: 0.25
Nodes (7): Architecture, Data and authorization model, Explicitly absent today, Required service interfaces, Security and operational requirements, Stoicverse, Technical Requirements Document

### Community 34 - "Database Schema"
Cohesion: 0.25
Nodes (7): Automation, Core records, Database Schema, Identity and access, Required RLS invariants, Scope, Stoicverse single-community model

### Community 35 - "Client Screen Inventory"
Cohesion: 0.29
Nodes (6): Client Screen Inventory, Notes, Desktop Checkout Screen, Master Zone Community Feed, Desktop Member Dashboard, Events Directory Screen

### Community 36 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 37 - "CRITICAL BROWSER STORAGE RESTRICTION"
Cohesion: 0.40
Nodes (5): CRITICAL BROWSER STORAGE RESTRICTION, Step 0 — Does the request need a visual at all?, Step 1 — Is a connected MCP tool a fit?, Step 2 — Did the person ask for a file?, Step 3 — Visualizer (default inline visual)

### Community 38 - "signup/confirm/page.tsx"
Cohesion: 0.27
Nodes (8): takePendingEmail(), metadata, SignupConfirmPage(), AddressChip(), AuthHeading(), AuthShell(), MailGlyph(), SIGNUP_ACK

### Community 39 - "workspace.ts"
Cohesion: 0.14
Nodes (23): CreatorSettingsPage(), SettingsPageShell(), AUDIT_PAGE_SIZE, AuditEvent, AUTOMOD_ALERT_PAGE_SIZE, AutomodAlertRow, AutomodRuleRow, loadAuditPage() (+15 more)

### Community 41 - "UI/UX Standards"
Cohesion: 0.40
Nodes (4): Information design, Interaction, Responsive and accessible behaviour, UI/UX Standards

### Community 42 - "Row Level Security"
Cohesion: 0.50
Nodes (4): Application Stack, Google Drive Preview, Row Level Security, Stripe Webhook

### Community 43 - "Memberships"
Cohesion: 0.50
Nodes (4): Atomic Progression, Course Video Assets, Memberships, Profiles

### Community 44 - "Do NOT use artifacts for"
Cohesion: 0.50
Nodes (4): Do NOT use artifacts for, HTML, Markdown, React

### Community 45 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 46 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 47 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 48 - "Gifted Membership"
Cohesion: 0.50
Nodes (4): Gifted Membership, Membership Lapse Preservation, Role and Tier Access Model, Influencer Dashboard Screen

### Community 49 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 50 - "Learning Path"
Cohesion: 0.50
Nodes (4): Learning Path with Discord Sidebar, Learning Path, Learning Path Mobile, Member Dashboard

### Community 51 - "Live Sessions"
Cohesion: 0.50
Nodes (4): Live Sessions with Discord Sidebar, Live Sessions, Live Sessions Mobile, Master Zone Dashboard

### Community 53 - "MVP Launch Gaps"
Cohesion: 0.67
Nodes (3): Data Safety, MVP Launch Gaps, Payments and Account Lifecycle

### Community 56 - "Stoic Methodology"
Cohesion: 0.67
Nodes (3): Stoic Methodology, Stoic Landing Page Screen, Trading Learning Roadmap

### Community 57 - "next.config.ts"
Cohesion: 0.50
Nodes (3): contentSecurityPolicy, nextConfig, supabaseSocketOrigin

### Community 59 - "Advanced Position Sizing Lesson"
Cohesion: 0.67
Nodes (3): Advanced Position Sizing Lesson with Discord Sidebar, Advanced Position Sizing Lesson, Lesson Page Mobile

### Community 60 - "Login"
Cohesion: 0.67
Nodes (3): Return to Silence Login, Login, Login Mobile

### Community 61 - "Institutional Mentorship"
Cohesion: 0.67
Nodes (3): Institutional Mentorship, Institutional Mentors Mobile, Institutional Mentorship with Discord Sidebar

### Community 62 - "Learning Roadmap"
Cohesion: 0.67
Nodes (3): Learning Roadmap, Learn Apply Master Progression, Trading Education Platform

### Community 63 - "AskStoic Design System"
Cohesion: 0.67
Nodes (3): AskStoic Design System, Institutional Stoic Methodical Brand, Terminal Dark Design

### Community 68 - "CreatorRevenueView.tsx"
Cohesion: 0.09
Nodes (36): GET(), headers, CreatorRevenuePage(), change(), CreatorRevenueView(), date(), decimal(), MemberCredits() (+28 more)

### Community 71 - "MemberRegistry.tsx"
Cohesion: 0.05
Nodes (60): GET(), GET(), platformRoles, statuses, currentIsoWeekStart(), giftMemberSubscription(), moderateMember(), refreshMemberOperations() (+52 more)

### Community 72 - "RolesSection.tsx"
Cohesion: 0.07
Nodes (36): Candidate, MemberRow, RoleEditor(), RoleForm(), Tab, TABS, RolePermissionGrid(), CreateRoleButton() (+28 more)

### Community 73 - "CreatorEventsView.tsx"
Cohesion: 0.11
Nodes (22): ActionResult, cancelEvent(), enrollInEvent(), isApprovedZoomUrl(), isoDate(), publishEvent(), revalidateEvents(), saveCreatorEvent() (+14 more)

### Community 74 - "button.tsx"
Cohesion: 0.19
Nodes (15): CourseCard, CourseFilter, CourseRow(), duration(), filters, LearningPathCatalog(), ActiveMentorship(), BENEFITS (+7 more)

### Community 79 - "Skeletons.tsx"
Cohesion: 0.06
Nodes (6): CardGridSkeleton(), ChartWorkspaceSkeleton(), FeedSkeleton(), OverviewSkeleton(), SettingsSkeleton(), TableSkeleton()

### Community 82 - "AuditLogSection.tsx"
Cohesion: 0.23
Nodes (13): ACTION_COPY, ACTIONS, Column, DataTable(), EmptyState(), Table(), TableBody(), TableCaption() (+5 more)

### Community 86 - "checkout/page.tsx"
Cohesion: 0.26
Nodes (11): CheckoutPage(), isMembershipPlan(), Purchase, Entry, fetchPrice(), format(), isConfigured(), memo (+3 more)

### Community 91 - "StructureForm.tsx"
Cohesion: 0.13
Nodes (23): access(), creatorSupabase(), deleteChannelOverride(), deleteCommunityStructure(), Result, saveCategory(), saveChannel(), setChannelSlowMode() (+15 more)

### Community 92 - "DeletionPendingScreen.tsx"
Cohesion: 0.31
Nodes (6): DeletionPendingPage(), cancelAccountDeletion(), logoutAction(), EMPTY_SETTINGS_ACTION_STATE, SettingsActionState, DeletionPendingScreen()

### Community 93 - "login-bypass.ts"
Cohesion: 0.36
Nodes (5): DevLoginPanel(), DEV_PERSONA_EMAIL, DEV_PERSONA_LABELS, DEV_PERSONAS, devLoginBlockers()

### Community 95 - "useToast"
Cohesion: 0.16
Nodes (15): ChannelNav(), ChannelsShell(), InlineEditor(), useCommunity(), Composer(), ForwardDialog(), RulesGateNotice(), MembersTab() (+7 more)

### Community 96 - "SetPasswordForm.tsx"
Cohesion: 0.23
Nodes (8): setPasswordAction(), metadata, ErrorNote(), PasswordField(), SubmitButton(), TextField(), ResetRequestForm(), SetPasswordForm()

### Community 123 - "Medium"
Cohesion: 0.08
Nodes (23): C1 — A failed Stripe webhook is never retried, so a paid member never gets access, C2 — Any member can rewrite every other member's course progress, Critical, H1 — The service-role client silently falls back to a fake key, H2 — `npm run test:security` exits 0 having run nothing, H3 — 10 high-severity dependency advisories, H4 — The migration directory can no longer reproduce the database, H5 — No CI exists (+15 more)

### Community 124 - "Creator Analytics and Revenue Plan"
Cohesion: 0.10
Nodes (19): Analytics implementation, Confirmed product rules, Courses, /creator/analytics, Creator Analytics and Revenue Plan, /creator/revenue, Credit correctness and data requirements, Delivery sequence (+11 more)

### Community 126 - "Stoicverse project and branch status"
Cohesion: 0.15
Nodes (12): Branch inventory, Concrete unfinished work and risks, Documentation and maintenance, Executive assessment, Feature gaps, Implemented in committed history, Integration history, Recommended next steps (+4 more)

### Community 127 - "AuthForm.tsx"
Cohesion: 0.20
Nodes (6): ARRIVAL_NOTICES, AuthForm(), AuthState, initialState, SIGNUP_STEPS, PASSWORD_MIN_LENGTH

### Community 128 - "withRouteBase"
Cohesion: 0.11
Nodes (22): CourseRow, CourseVideoRow, DirectoryRow, Embedded, firstOf(), GET(), MemberRow, roleName() (+14 more)

### Community 130 - "community-settings/permissions.ts"
Cohesion: 0.14
Nodes (20): ALL_KEY_SET, canGrant(), canManageRole(), CHANNEL_KEY_SET, CHANNEL_PERMISSION_KEYS, diffPermissions(), ESCALATING_PERMISSIONS, isChannelPermissionKey() (+12 more)

### Community 131 - "AppRail.tsx"
Cohesion: 0.10
Nodes (22): AppRail(), AppRailProps, ICONS, RailVariant, WorkspaceChrome(), Tooltip(), TooltipContent(), TooltipProvider() (+14 more)

### Community 132 - "proxy.ts"
Cohesion: 0.22
Nodes (13): adminRoutes, authRoutes, communityRoutes, config, copyResponseState(), creatorRoutes, isRouteMatch(), memberRoutes (+5 more)

### Community 134 - "login/route.ts"
Cohesion: 0.25
Nodes (11): adoptOwner(), isLocalRequest(), LOCAL_HOSTS, POST(), secretMatches(), seedPersona(), GET(), DevPersona (+3 more)

### Community 136 - "ChannelPermissionsTab.tsx"
Cohesion: 0.17
Nodes (13): setChannelOverrides(), setChannelPermissionSync(), ChannelPermissionsTab(), Grid, gridFrom(), isNeutral(), SlowModeField(), ViewAsRolePreview() (+5 more)

### Community 137 - "Migrations — how this project actually deploys"
Cohesion: 0.40
Nodes (4): Known ledger facts (2026-09-10), Migrations — how this project actually deploys, The workflow, Why

### Community 139 - "member-avatar.tsx"
Cohesion: 0.19
Nodes (11): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), DOT, LABEL (+3 more)

### Community 142 - "cn"
Cohesion: 0.10
Nodes (28): AccessFields(), Card(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), Density (+20 more)

### Community 143 - "requireActiveMembership"
Cohesion: 0.23
Nodes (9): LessonPage(), LessonPageOptions, renderLessonPage(), CreatorLessonPage(), CreatorNotificationsPage(), NotificationsPage(), renderNotifications(), LessonPlayer() (+1 more)

### Community 144 - "overlay.tsx"
Cohesion: 0.17
Nodes (21): ForwardOutcome, Stage, StructureEditorProps, Density, DensityContext, Overlay(), OverlayBackdrop(), OverlayBody() (+13 more)

### Community 145 - "messages.ts"
Cohesion: 0.13
Nodes (16): ChannelsLayout(), ForwardedOrigin, toForwardedOrigin(), toClientMessage(), ChannelThread, DirectoryMember, loadCustomEmojis(), loadMemberDirectory() (+8 more)

### Community 147 - "LandingScreen.tsx"
Cohesion: 0.09
Nodes (17): Home(), metadata, metadata, SECTIONS, metadata, SECTIONS, PublicFooter(), PublicHeader() (+9 more)

### Community 148 - "field.tsx"
Cohesion: 0.15
Nodes (13): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+5 more)

### Community 150 - "message-actions.ts"
Cohesion: 0.26
Nodes (10): deriveMessageActions(), JUMP_PAGE_BUDGET, MessageAbilities, MessageActions, messagePermalink(), MessageSubject, NOTHING, abilities() (+2 more)

### Community 151 - "utils.ts"
Cohesion: 0.12
Nodes (9): Density, PageHeader(), Density, Section(), Skeleton(), Slider(), Switch(), MONOLITH_FONT_SIZES (+1 more)

### Community 152 - "sections.ts"
Cohesion: 0.13
Nodes (24): AuditLogSection(), SECTION_ICONS, SettingsOverlayShell(), SettingsRail(), SettingsSectionBody(), SettingsTarget, useOpenSettings(), StructureEditor() (+16 more)

### Community 153 - "VideoPage.tsx"
Cohesion: 0.27
Nodes (7): VideoPage(), renderVideoPage(), DashboardVideoPage(), formatDuration(), LessonWorkspacePlayer(), PlaylistVideo, QueueItem()

### Community 154 - "design-tokens.contract.mjs"
Cohesion: 0.70
Nodes (4): countAcross(), read(), sourceFiles(), stripComments()

### Community 155 - "viewer.ts"
Cohesion: 0.27
Nodes (13): metadata, ResetConfirmPage(), CheckoutSuccessPage(), CreatorWorkspaceLayout(), MemberWorkspaceLayout(), accessGranted(), currentIsMaster, currentProfile (+5 more)

### Community 157 - "ChannelView.tsx"
Cohesion: 0.10
Nodes (24): ChannelView(), dayOf(), MessageRow(), Reactions(), timeOf(), continuesGroup(), firstUnreadIndex(), GROUP_WINDOW_MS (+16 more)

### Community 158 - "VoiceRecorder.tsx"
Cohesion: 0.17
Nodes (20): clock(), decodeQueue, measure(), measureOnce(), peakCache, SPEEDS, VoicePlayer(), clock() (+12 more)

### Community 162 - "StructureList.tsx"
Cohesion: 0.15
Nodes (17): reorderCommunityStructure(), channelMeta(), useRoleOrder(), StructurePanes(), StructureList(), StructureSelection, OrderState, useStructureOrder() (+9 more)

### Community 167 - "requireInfluencerWorkspace"
Cohesion: 0.18
Nodes (11): CreatorCourseManagerPageV2(), CreatorDashboardPage(), CreatorEventsPage(), CreatorMemberTurnoverPage(), DashboardPage(), DashboardPageOptions, renderDashboardPage(), ManagedCourse (+3 more)

### Community 169 - "app/master/page.tsx"
Cohesion: 0.36
Nodes (7): CreatorMasterPage(), AttachmentRow, MasterPage(), MasterPageOptions, renderMasterPage(), requireInfluencerMasterWorkspace(), requireMasterMembership()

### Community 171 - "AppShell.tsx"
Cohesion: 0.11
Nodes (18): DashboardData, Event, TierProgressDetail, currency, eventDate(), TerminalDashboard(), AppShellProps, ChromeMounted (+10 more)

### Community 172 - "CourseCatalogPage.tsx"
Cohesion: 0.33
Nodes (5): CourseEnrollment, CoursesPage(), CourseVideo, renderCoursesPage(), DashboardCoursesPage()

### Community 174 - "dashboard/settings/page.tsx"
Cohesion: 0.36
Nodes (6): CreatorAccountPage(), AccountSettingsOptions, renderAccountSettings(), SettingsPage(), validSections, SettingsSection

### Community 179 - "plans.ts"
Cohesion: 0.21
Nodes (10): confirmAccess(), CheckoutScreen(), COPY, PLAN_LABEL, PlanOffer, CheckoutSuccessScreen(), DESTINATION, isProduct() (+2 more)

### Community 181 - "MemberList.tsx"
Cohesion: 0.05
Nodes (44): CHANNEL_ICONS, ChannelLink(), LEVEL_LABEL, ShellSkeleton(), CONTEXT_PARTS, DROPDOWN_PARTS, Pending, GIFT_OPTIONS (+36 more)

### Community 184 - "createAdminClient"
Cohesion: 0.29
Nodes (8): POST(), runtime, StripeEvent, verifiedEvent(), membershipTermMonths(), Email, sendTransactionalEmail(), createAdminClient()

### Community 185 - "presence.ts"
Cohesion: 0.26
Nodes (10): TypingPayload, useCommunityLive(), activeTypists(), groupMembers(), MemberLike, MemberSection, onlineIdsFrom(), TYPING_TTL_MS (+2 more)

### Community 186 - "CommunityProvider.tsx"
Cohesion: 0.15
Nodes (21): ChannelPage(), dynamic, ChannelRow, CommunityContext, CommunityProvider(), CommunityValue, mergeMessage(), MobilePane (+13 more)

### Community 187 - "auth/actions.ts"
Cohesion: 0.35
Nodes (9): appOrigin(), AuthActionState, clientKey(), loginAction(), rememberPendingEmail(), requestPasswordResetAction(), signupAction(), DEFAULT_NEXT_PATH (+1 more)

### Community 188 - "toggle-group.tsx"
Cohesion: 0.27
Nodes (8): react, react, useComboboxAnchor(), ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 193 - "MessageMenu.tsx"
Cohesion: 0.18
Nodes (14): Pinned, PinsPopover(), Thread, ThreadListPopover(), useLazyRows(), PendingAttachment, Dialog, MenuItemType (+6 more)

### Community 194 - "app/mentorship/page.tsx"
Cohesion: 0.39
Nodes (6): CreatorMentorshipPage(), DashboardMentorshipPage(), MentorshipPage(), MentorshipPageOptions, renderMentorshipPage(), findPurchase()

### Community 196 - "combobox.tsx"
Cohesion: 0.09
Nodes (22): ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty(), ComboboxGroup(), ComboboxInput() (+14 more)

### Community 201 - "EmojiSection.tsx"
Cohesion: 0.29
Nodes (8): EmojiSection(), ConfirmDialog(), ConfirmTone, CUSTOM_EMOJI_LIMITS, CustomEmoji, emojiToken(), isAllowedEmojiType(), parseEmojiName()

## Knowledge Gaps
- **682 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+677 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `withRouteBase`, `community-settings/model.ts`, `AppRail.tsx`, `ChannelPermissionsTab.tsx`, `member-avatar.tsx`, `overlay.tsx`, `AutomodSection.tsx`, `field.tsx`, `alert-dialog.tsx`, `utils.ts`, `sections.ts`, `CreatorAnalyticsView.tsx`, `MemberList.tsx`, `toggle-group.tsx`, `MessageMenu.tsx`, `combobox.tsx`, `MemberRegistry.tsx`, `EmojiSection.tsx`, `button.tsx`, `AuditLogSection.tsx`, `StructureForm.tsx`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `createClient` connect `createClient` to `withRouteBase`, `SetPasswordForm.tsx`, `access.ts`, `CreatorCourseManagerV2.tsx`, `AccountSettingsWorkspace.tsx`, `MemberRegistry.tsx`, `requireInfluencerWorkspace`, `CreatorEventsView.tsx`, `viewer.ts`, `requireActiveMembership`, `LandingScreen.tsx`, `plans.ts`, `checkout/page.tsx`, `auth/actions.ts`, `DeletionPendingScreen.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `Button()` connect `button.tsx` to `community-settings/model.ts`, `CreatorCourseManagerV2.tsx`, `EventsView.tsx`, `AccountSettingsWorkspace.tsx`, `ChannelPermissionsTab.tsx`, `CreatorOverviewView.tsx`, `overlay.tsx`, `AutomodSection.tsx`, `createClient`, `alert-dialog.tsx`, `CreatorAnalyticsView.tsx`, `StructureList.tsx`, `plans.ts`, `CreatorRevenueView.tsx`, `combobox.tsx`, `MemberRegistry.tsx`, `RolesSection.tsx`, `EmojiSection.tsx`, `CreatorEventsView.tsx`, `AuditLogSection.tsx`, `StructureForm.tsx`, `DeletionPendingScreen.tsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _682 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SearchOverlay.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08819345661450925 - nodes in this community are weakly interconnected._
- **Should `community-settings/model.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06490384615384616 - nodes in this community are weakly interconnected._
- **Should `CreatorCourseManagerV2.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08821548821548822 - nodes in this community are weakly interconnected._