# Graph Report - StoicWealthSociety  (2026-09-14)

## Corpus Check
- 487 files · ~426,803 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2366 nodes · 4949 edges · 211 communities (161 shown, 50 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f7668477`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AskStoicScreens.tsx
- login/route.ts
- community-settings/model.ts
- requireInfluencer
- AuthForm.tsx
- CreatorEventsView.tsx
- AccountSettingsWorkspace.tsx
- compilerOptions
- Content safety
- What You Must Do When Invoked
- CreatorOverviewView.tsx
- components.json
- claude-fable-5.md
- TerminalDashboard.tsx
- dependencies
- devDependencies
- constants.ts
- EmojiPicker.tsx
- Influencer Implementation Plan
- requireActiveMembership
- CourseVideoPlayer.tsx
- postgresMessage
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
- toast.tsx
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
- member-operations/server.ts
- automod.ts
- alert-dialog.tsx
- tokenize.ts
- postcss.config.mjs
- Skeletons.tsx
- data-table.tsx
- checkout/page.tsx
- @base-ui/react
- card.tsx
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
- createClient
- Stoicverse project and branch status
- ChannelView.tsx
- search/route.ts
- role-model.ts
- AppRail.tsx
- proxy.ts
- community-settings/permissions.ts
- MemberProfileDialog.tsx
- StructureForm.tsx
- Migrations — how this project actually deploys
- member-avatar.tsx
- cn
- utils.ts
- ForwardDialog.tsx
- messages.ts
- next
- LandingScreen.tsx
- RolesSection.tsx
- public-chrome.contract.mjs
- SearchOverlay.tsx
- ChannelsShell.tsx
- SettingsSectionBody.tsx
- NotificationCenter.tsx
- design-tokens.contract.mjs
- access.ts
- plans.ts
- CommunityProvider.tsx
- VoiceRecorder.tsx
- ChannelPermissionsTab.tsx
- @dnd-kit/utilities
- menu-parts.tsx
- channels/actions.ts
- @supabase/supabase-js
- community-migrations.contract.mjs
- requireInfluencerWorkspace
- member-operations/types.ts
- members/actions.ts
- emoji-actions.ts
- AppShell.tsx
- dashboard/settings/page.tsx
- tabs.tsx
- createAdminClient
- channels.contract.mjs
- MessageMenu.tsx
- sections.ts
- presence.ts
- auth/actions.ts
- Composer.tsx
- toggle-group.tsx
- viewer.ts
- MemberRegistry.tsx
- lucide-react
- CourseCatalogPage.tsx
- message-actions.ts
- @dnd-kit/core
- combobox.tsx
- tiers/actions.ts
- notifications/route.ts
- SettingsSkeleton
- FeedSkeleton
- auth-recovery.contract.mjs
- stream/route.ts
- analytics/loading.tsx
- creator/loading.tsx
- members/loading.tsx
- env.ts
- AuditLogSection.tsx
- SafetySection.tsx
- @supabase/ssr

## God Nodes (most connected - your core abstractions)
1. `cn()` - 165 edges
2. `createClient` - 76 edges
3. `postgresMessage()` - 54 edges
4. `revalidateCommunity()` - 40 edges
5. `isUuid()` - 37 edges
6. `requireInfluencerWorkspace()` - 37 edges
7. `createClient()` - 36 edges
8. `profileRow` - 35 edges
9. `requireInfluencer()` - 28 edges
10. `Content safety` - 28 edges

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

## Communities (211 total, 50 thin omitted)

### Community 0 - "AskStoicScreens.tsx"
Cohesion: 0.15
Nodes (13): CreatorMasterPage(), AttachmentRow, MasterPage(), MasterPageOptions, renderMasterPage(), AdminScreen(), CommunityChannel, CommunityPost (+5 more)

### Community 1 - "login/route.ts"
Cohesion: 0.19
Nodes (14): adoptOwner(), isLocalRequest(), LOCAL_HOSTS, POST(), secretMatches(), seedPersona(), DevLoginPanel(), DEV_PERSONA_EMAIL (+6 more)

### Community 2 - "community-settings/model.ts"
Cohesion: 0.09
Nodes (37): saveCommunityIdentity(), AccentField(), IdentityPreview(), IdentitySection(), RoleColorField(), ACCENT_SWATCHES, bounded(), CASE_KIND_LABELS (+29 more)

### Community 3 - "requireInfluencer"
Cohesion: 0.17
Nodes (26): ActionResult, addCourseVideo(), addLesson(), createCourse(), deleteCourse(), deleteCourseVideo(), driveId(), enrollInCourse() (+18 more)

### Community 4 - "AuthForm.tsx"
Cohesion: 0.14
Nodes (11): metadata, ErrorNote(), PasswordField(), SubmitButton(), TextField(), ARRIVAL_NOTICES, AuthForm(), AuthState (+3 more)

### Community 5 - "CreatorEventsView.tsx"
Cohesion: 0.10
Nodes (27): ActionResult, cancelEvent(), enrollInEvent(), isApprovedZoomUrl(), isoDate(), publishEvent(), revalidateEvents(), saveCreatorEvent() (+19 more)

### Community 6 - "AccountSettingsWorkspace.tsx"
Cohesion: 0.14
Nodes (23): DeletionPendingPage(), authenticatedMember(), avatarTypes, cancelAccountDeletion(), logoutAction(), rateLimit(), removeAvatar(), requestAccountDeletion() (+15 more)

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
Cohesion: 0.13
Nodes (13): CreatorOverviewView(), currency, delta(), eventTime(), FilterOption, isSameDay(), number, OverviewData (+5 more)

### Community 11 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "claude-fable-5.md"
Cohesion: 0.11
Nodes (18): After search, Connector directory first, Data Scope, Design guidance, Error Handling, Explicit triggers, Key Design Pattern, Limitations (+10 more)

### Community 13 - "TerminalDashboard.tsx"
Cohesion: 0.17
Nodes (10): DashboardPage(), DashboardPageOptions, renderDashboardPage(), DashboardData, Event, TierProgressDetail, currency, eventDate() (+2 more)

### Community 14 - "dependencies"
Cohesion: 0.12
Nodes (17): class-variance-authority, clsx, emojibase-data, dependencies, class-variance-authority, clsx, emojibase-data, react-dom (+9 more)

### Community 15 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 16 - "constants.ts"
Cohesion: 0.16
Nodes (17): ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES, ATTACHMENTS_PER_MESSAGE, CUSTOM_EMOJI_TOKEN, formatBytes(), isAllowedAttachmentType(), isValidReactionToken(), LEGACY_MENTION_TOKENS (+9 more)

### Community 17 - "EmojiPicker.tsx"
Cohesion: 0.07
Nodes (50): generate(), OUTPUT, require, root, applySkinTone(), buildIndex(), CompactEmojiInput, EMOJI_GROUPS (+42 more)

### Community 18 - "Influencer Implementation Plan"
Cohesion: 0.12
Nodes (15): 1. Permission model — two independent axes, 2.1 Home / Analytics, 2.2 Members, 2.3 Learning (Tiers), 2.4 Events, 2. Influencer Dashboard — surfaces, 3. Gifting membership — rules, 4. Membership lapse behavior (+7 more)

### Community 19 - "requireActiveMembership"
Cohesion: 0.24
Nodes (8): LessonPage(), LessonPageOptions, renderLessonPage(), CreatorLessonPage(), DashboardEventsPage(), renderEventsPage(), LessonPlayer(), requireActiveMembership()

### Community 20 - "CourseVideoPlayer.tsx"
Cohesion: 0.31
Nodes (7): formatDuration(), LegacyCourseVideoPlayer(), PlaylistVideo, formatDuration(), LessonWorkspacePlayer(), PlaylistVideo, QueueItem()

### Community 21 - "postgresMessage"
Cohesion: 0.18
Nodes (28): RFC-4122, RestrictionScope, restrictMember(), Result, SCOPES, unrestrictMember(), reportMessage(), warnMember() (+20 more)

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

### Community 38 - "toast.tsx"
Cohesion: 0.17
Nodes (9): geist, jetbrainsMono, metadata, viewport, DURATION_MS, Toast, ToastContext, ToastProvider() (+1 more)

### Community 39 - "workspace.ts"
Cohesion: 0.11
Nodes (27): CreatorSettingsPage(), AUDIT_PAGE_SIZE, AUTOMOD_ALERT_PAGE_SIZE, AutomodAlertRow, AutomodRuleRow, loadAuditPage(), loadAutomodAlerts(), loadAutomodPresets() (+19 more)

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

### Community 71 - "member-operations/server.ts"
Cohesion: 0.18
Nodes (17): GET(), GET(), platformRoles, statuses, decodeMemberCursor(), encodeMemberCursor(), MemberCursor, authorizeInfluencerApi() (+9 more)

### Community 72 - "automod.ts"
Cohesion: 0.14
Nodes (27): RuleDraft, RuleEditor(), AutomodSection(), draftFor(), AUTOMOD_KIND_LABELS, AUTOMOD_KINDS, AUTOMOD_LIMITS, AUTOMOD_MATCH_MODES (+19 more)

### Community 73 - "alert-dialog.tsx"
Cohesion: 0.15
Nodes (9): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+1 more)

### Community 74 - "tokenize.ts"
Cohesion: 0.18
Nodes (14): collectMentions(), Cursor, ENTITY_PATTERNS, INLINE_DELIMITERS, isWordChar(), JUMBO_EMOJI_LIMIT, MAX_DEPTH, MentionKind (+6 more)

### Community 82 - "data-table.tsx"
Cohesion: 0.22
Nodes (11): Column, DataTable(), EmptyState(), Table(), TableBody(), TableCaption(), TableCell(), TableFooter() (+3 more)

### Community 86 - "checkout/page.tsx"
Cohesion: 0.15
Nodes (16): CheckoutPage(), CheckoutScreen(), COPY, PLAN_LABEL, PlanOffer, isMembershipPlan(), MembershipPlan, Purchase (+8 more)

### Community 95 - "card.tsx"
Cohesion: 0.22
Nodes (8): Card(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), Density, PAD

### Community 96 - "SetPasswordForm.tsx"
Cohesion: 0.19
Nodes (13): setPasswordAction(), takePendingEmail(), metadata, ResetConfirmPage(), metadata, SignupConfirmPage(), AddressChip(), AuthHeading() (+5 more)

### Community 123 - "Medium"
Cohesion: 0.08
Nodes (23): C1 — A failed Stripe webhook is never retried, so a paid member never gets access, C2 — Any member can rewrite every other member's course progress, Critical, H1 — The service-role client silently falls back to a fake key, H2 — `npm run test:security` exits 0 having run nothing, H3 — 10 high-severity dependency advisories, H4 — The migration directory can no longer reproduce the database, H5 — No CI exists (+15 more)

### Community 124 - "Creator Analytics and Revenue Plan"
Cohesion: 0.10
Nodes (19): Analytics implementation, Confirmed product rules, Courses, /creator/analytics, Creator Analytics and Revenue Plan, /creator/revenue, Credit correctness and data requirements, Delivery sequence (+11 more)

### Community 125 - "createClient"
Cohesion: 0.21
Nodes (15): POST(), runtime, POST(), GET(), POST(), dynamic, GET(), PERIODS (+7 more)

### Community 126 - "Stoicverse project and branch status"
Cohesion: 0.15
Nodes (12): Branch inventory, Concrete unfinished work and risks, Documentation and maintenance, Executive assessment, Feature gaps, Implemented in committed history, Integration history, Recommended next steps (+4 more)

### Community 127 - "ChannelView.tsx"
Cohesion: 0.10
Nodes (21): MessageRow(), timeOf(), continuesGroup(), firstUnreadIndex(), GROUP_WINDOW_MS, GroupableMessage, startsNewDay(), activeMentionQuery() (+13 more)

### Community 128 - "search/route.ts"
Cohesion: 0.21
Nodes (12): CourseRow, CourseVideoRow, DirectoryRow, Embedded, firstOf(), GET(), MemberRow, roleName() (+4 more)

### Community 130 - "role-model.ts"
Cohesion: 0.09
Nodes (18): isSystemRoleKey(), MIN_ROLE_CONTRAST, parseRoleInput(), ROLE_SURFACE_COLOR, ROLE_SWATCHES, RoleInput, SYSTEM_ROLE_KEYS, SystemRoleKey (+10 more)

### Community 131 - "AppRail.tsx"
Cohesion: 0.10
Nodes (22): AppRail(), AppRailProps, ICONS, RailVariant, WorkspaceChrome(), Tooltip(), TooltipContent(), TooltipProvider() (+14 more)

### Community 132 - "proxy.ts"
Cohesion: 0.17
Nodes (17): adminRoutes, authRoutes, communityRoutes, config, copyResponseState(), creatorRoutes, isRouteMatch(), memberRoutes (+9 more)

### Community 134 - "community-settings/permissions.ts"
Cohesion: 0.11
Nodes (28): Candidate, MemberRow, MembersTab(), RoleForm(), Tab, TABS, RoleIconField(), RolePermissionGrid() (+20 more)

### Community 135 - "MemberProfileDialog.tsx"
Cohesion: 0.14
Nodes (24): giftMembership(), banMember(), bulkDeleteMessages(), resolveReport(), Result, timeoutMember(), unbanMember(), untimeoutMember() (+16 more)

### Community 136 - "StructureForm.tsx"
Cohesion: 0.13
Nodes (15): channelMeta(), channelSlug(), ChannelTypeMeta, META, AccessFields(), StructureEditorProps, StructureList(), StructureSelection (+7 more)

### Community 137 - "Migrations — how this project actually deploys"
Cohesion: 0.40
Nodes (4): Known ledger facts (2026-09-10), Migrations — how this project actually deploys, The workflow, Why

### Community 139 - "member-avatar.tsx"
Cohesion: 0.19
Nodes (11): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), DOT, LABEL (+3 more)

### Community 142 - "cn"
Cohesion: 0.08
Nodes (35): ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuShortcut(), Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup() (+27 more)

### Community 143 - "utils.ts"
Cohesion: 0.10
Nodes (14): Badge(), badgeVariants, Checkbox(), Density, PageHeader(), Density, Section(), Slider() (+6 more)

### Community 144 - "ForwardDialog.tsx"
Cohesion: 0.17
Nodes (20): ForwardOutcome, Stage, Density, DensityContext, Overlay(), OverlayBackdrop(), OverlayBody(), OverlayClose() (+12 more)

### Community 145 - "messages.ts"
Cohesion: 0.13
Nodes (17): ChannelsLayout(), ForwardedOrigin, toForwardedOrigin(), toClientMessage(), ChannelMessage, ChannelThread, DirectoryMember, loadCustomEmojis() (+9 more)

### Community 147 - "LandingScreen.tsx"
Cohesion: 0.10
Nodes (14): metadata, SECTIONS, metadata, SECTIONS, PublicFooter(), PublicHeader(), SECTIONS, LegalPage() (+6 more)

### Community 148 - "RolesSection.tsx"
Cohesion: 0.17
Nodes (15): RoleEditor(), CreateRoleButton(), DeleteRoleCard(), RolesSection(), useRoleOrder(), StructurePanes(), OrderState, useStructureOrder() (+7 more)

### Community 150 - "SearchOverlay.tsx"
Cohesion: 0.09
Nodes (30): Hit, KIND_LABEL, KIND_ORDER, Row, SearchOverlay(), LOCAL_RESULTS_PER_KIND, localCandidates(), RankedResult (+22 more)

### Community 151 - "ChannelsShell.tsx"
Cohesion: 0.14
Nodes (15): setChannelNotificationLevel(), CHANNEL_ICONS, ChannelLink(), ChannelNav(), ChannelsShell(), LEVEL_LABEL, ShellSkeleton(), MobilePaneDrawer() (+7 more)

### Community 152 - "SettingsSectionBody.tsx"
Cohesion: 0.20
Nodes (15): SECTION_ICONS, NoticeContext, NoticeContextValue, SettingsNoticeProvider(), useSettingsNotice(), SettingsOverlayShell(), SettingsPageShell(), SettingsRail() (+7 more)

### Community 153 - "NotificationCenter.tsx"
Cohesion: 0.22
Nodes (8): FeedResponse, groupLabel(), iconFor(), NotificationCenter(), relativeTime, timeAgo(), views, Skeleton()

### Community 154 - "design-tokens.contract.mjs"
Cohesion: 0.70
Nodes (4): countAcross(), read(), sourceFiles(), stripComments()

### Community 155 - "access.ts"
Cohesion: 0.22
Nodes (10): AdminPage(), BlockedPage(), dynamic, ChannelsIndexPage(), dynamic, membershipState, requireCommunityAccess(), requirePlatformRole() (+2 more)

### Community 156 - "plans.ts"
Cohesion: 0.20
Nodes (9): confirmAccess(), CheckoutSuccessScreen(), DESTINATION, accessGranted(), findPurchase(), isProduct(), membershipTermMonths(), Product (+1 more)

### Community 157 - "CommunityProvider.tsx"
Cohesion: 0.14
Nodes (24): ChannelPage(), dynamic, setThreadState(), ChannelView(), dayOf(), ChannelRow, CommunityContext, CommunityProvider() (+16 more)

### Community 158 - "VoiceRecorder.tsx"
Cohesion: 0.17
Nodes (20): clock(), decodeQueue, measure(), measureOnce(), peakCache, SPEEDS, VoicePlayer(), clock() (+12 more)

### Community 159 - "ChannelPermissionsTab.tsx"
Cohesion: 0.13
Nodes (16): ChannelPermissionsTab(), Grid, gridFrom(), isNeutral(), SlowModeField(), ViewAsRolePreview(), CHANNEL_TYPES, formatSlowMode() (+8 more)

### Community 162 - "channels/actions.ts"
Cohesion: 0.24
Nodes (17): access(), creatorSupabase(), deleteChannelOverride(), deleteCommunityStructure(), reorderCommunityStructure(), Result, saveCategory(), saveChannel() (+9 more)

### Community 167 - "requireInfluencerWorkspace"
Cohesion: 0.14
Nodes (16): CreatorCourseManagerPageV2(), CreatorDashboardPage(), CreatorEventsPage(), CreatorMembersPage(), CreatorMemberTurnoverPage(), CreatorMentorshipPage(), CreatorNotificationsPage(), NotificationsPage() (+8 more)

### Community 169 - "member-operations/types.ts"
Cohesion: 0.16
Nodes (14): isoWeekRange(), money(), statuses, TurnoverDesktopRow(), TurnoverMobileRow(), TurnoverWorkspace(), CosmeticRole, MemberActionResult (+6 more)

### Community 170 - "members/actions.ts"
Cohesion: 0.24
Nodes (10): currentIsoWeekStart(), giftMemberSubscription(), moderateMember(), refreshMemberOperations(), saveWeeklyTurnover(), setMemberPlatformRole(), date(), MemberDetailModal() (+2 more)

### Community 171 - "emoji-actions.ts"
Cohesion: 0.32
Nodes (10): createEmoji(), deleteEmoji(), renameEmoji(), Result, EmojiSection(), CUSTOM_EMOJI_LIMITS, CustomEmoji, emojiToken() (+2 more)

### Community 172 - "AppShell.tsx"
Cohesion: 0.10
Nodes (23): renderCourseDetailPage(), VideoPage(), renderVideoPage(), DashboardCoursePage(), DashboardVideoPage(), FilterType, LearningPathData, LearningPathView() (+15 more)

### Community 174 - "dashboard/settings/page.tsx"
Cohesion: 0.31
Nodes (7): CreatorAccountPage(), AccountSettingsOptions, renderAccountSettings(), SettingsPage(), validSections, AccountSettingsWorkspace(), SettingsSection

### Community 178 - "tabs.tsx"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 179 - "createAdminClient"
Cohesion: 0.22
Nodes (10): GET(), POST(), runtime, POST(), runtime, StripeEvent, verifiedEvent(), Email (+2 more)

### Community 181 - "MessageMenu.tsx"
Cohesion: 0.07
Nodes (35): createThread(), deleteMessage(), toggleMessagePin(), toggleReaction(), Reactions(), CONTEXT_PARTS, DROPDOWN_PARTS, Pending (+27 more)

### Community 184 - "sections.ts"
Cohesion: 0.19
Nodes (13): DEFAULT_SETTINGS_SECTION, first(), isSettingsSection(), LEGACY_SECTION_ALIASES, parseSettingsQuery(), SECTION_IDS, SETTINGS_GROUPS, SETTINGS_SECTIONS (+5 more)

### Community 185 - "presence.ts"
Cohesion: 0.26
Nodes (10): TypingPayload, useCommunityLive(), activeTypists(), groupMembers(), MemberLike, MemberSection, onlineIdsFrom(), TYPING_TTL_MS (+2 more)

### Community 186 - "auth/actions.ts"
Cohesion: 0.46
Nodes (7): appOrigin(), AuthActionState, clientKey(), loginAction(), rememberPendingEmail(), requestPasswordResetAction(), signupAction()

### Community 187 - "Composer.tsx"
Cohesion: 0.13
Nodes (25): acceptRules(), editMessage(), forwardMessage(), markChannelRead(), Result, sendChannelMessage(), Pinned, PinsPopover() (+17 more)

### Community 188 - "toggle-group.tsx"
Cohesion: 0.27
Nodes (8): react, react, useComboboxAnchor(), ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 189 - "viewer.ts"
Cohesion: 0.44
Nodes (9): CheckoutSuccessPage(), CreatorWorkspaceLayout(), MemberWorkspaceLayout(), currentIsMaster, currentProfile, currentViewer, unreadNotificationCount, viewerName() (+1 more)

### Community 191 - "MemberRegistry.tsx"
Cohesion: 0.20
Nodes (7): date(), DesktopTable(), EMPTY_FILTERS, Filters, MemberRegistry(), MobileRows(), statusOptions

### Community 193 - "CourseCatalogPage.tsx"
Cohesion: 0.19
Nodes (11): CourseEnrollment, CoursesPage(), CourseVideo, renderCoursesPage(), DashboardCoursesPage(), CourseCard, CourseFilter, CourseRow() (+3 more)

### Community 194 - "message-actions.ts"
Cohesion: 0.27
Nodes (9): deriveMessageActions(), JUMP_PAGE_BUDGET, MessageAbilities, MessageActions, MessageSubject, NOTHING, abilities(), derive() (+1 more)

### Community 196 - "combobox.tsx"
Cohesion: 0.09
Nodes (25): Button(), buttonVariants, ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty() (+17 more)

### Community 197 - "tiers/actions.ts"
Cohesion: 0.38
Nodes (8): deleteTier(), refresh(), Result, saveTier(), text(), validate(), CreatorTierManager(), ManagedTier

### Community 198 - "notifications/route.ts"
Cohesion: 0.57
Nodes (5): GET(), decodeNotificationCursor(), encodeNotificationCursor(), NotificationItem, notificationView

### Community 203 - "stream/route.ts"
Cohesion: 0.60
Nodes (3): GET(), runtime, getGoogleDriveDownloadUrl()

### Community 207 - "env.ts"
Cohesion: 0.60
Nodes (3): Home(), metadata, hasSupabaseConfig()

### Community 208 - "AuditLogSection.tsx"
Cohesion: 0.40
Nodes (4): ACTION_COPY, ACTIONS, AuditLogSection(), AuditEvent

## Knowledge Gaps
- **676 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+671 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `AppRail.tsx`, `combobox.tsx`, `alert-dialog.tsx`, `member-avatar.tsx`, `utils.ts`, `ForwardDialog.tsx`, `data-table.tsx`, `tabs.tsx`, `MessageMenu.tsx`, `NotificationCenter.tsx`, `Composer.tsx`, `toggle-group.tsx`, `card.tsx`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `createClient` connect `createClient` to `search/route.ts`, `requireInfluencer`, `CreatorEventsView.tsx`, `AccountSettingsWorkspace.tsx`, `MemberProfileDialog.tsx`, `requireActiveMembership`, `postgresMessage`, `ChannelsShell.tsx`, `access.ts`, `plans.ts`, `CommunityProvider.tsx`, `requireInfluencerWorkspace`, `emoji-actions.ts`, `createAdminClient`, `MessageMenu.tsx`, `auth/actions.ts`, `Composer.tsx`, `viewer.ts`, `notifications/route.ts`, `member-operations/server.ts`, `stream/route.ts`, `env.ts`, `checkout/page.tsx`, `SetPasswordForm.tsx`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `createClient()` connect `CommunityProvider.tsx` to `community-settings/model.ts`, `AppRail.tsx`, `NotificationCenter.tsx`, `proxy.ts`, `community-settings/permissions.ts`, `MemberProfileDialog.tsx`, `emoji-actions.ts`, `AppShell.tsx`, `SearchOverlay.tsx`, `presence.ts`, `Composer.tsx`, `ChannelView.tsx`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _676 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `community-settings/model.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08734693877551021 - nodes in this community are weakly interconnected._
- **Should `AuthForm.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1380952380952381 - nodes in this community are weakly interconnected._
- **Should `CreatorEventsView.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09815078236130868 - nodes in this community are weakly interconnected._