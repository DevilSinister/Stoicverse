# Graph Report - StoicWealthSociety  (2026-09-14)

## Corpus Check
- 487 files · ~426,715 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2377 nodes · 4960 edges · 201 communities (158 shown, 43 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `44a44a51`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AskStoicScreens.tsx
- app/mentorship/page.tsx
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
- DashboardView.tsx
- dependencies
- devDependencies
- constants.ts
- EmojiPicker.tsx
- Influencer Implementation Plan
- channels/actions.ts
- VideoPage.tsx
- createClient
- Graphify Workflow
- Product Requirements Document
- Stoicverse Design System
- Composer.tsx
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
- useToast
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
- plans.ts
- creator/settings/actions.ts
- card.tsx
- auth/actions.ts
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
- supabase/server.ts
- Stoicverse project and branch status
- channels-helpers.test.mjs
- search/route.ts
- role-model.ts
- AppRail.tsx
- proxy.ts
- isUuid
- requireActiveMembership
- RolesSection.tsx
- Migrations — how this project actually deploys
- member-avatar.tsx
- cn
- utils.ts
- message-actions.ts
- messages.ts
- next
- LandingScreen.tsx
- [channelId]/page.tsx
- public-chrome.contract.mjs
- SearchOverlay.tsx
- ChannelsShell.tsx
- SettingsPageShell.tsx
- NotificationCenter.tsx
- design-tokens.contract.mjs
- access.ts
- withRouteBase
- ChannelView.tsx
- VoiceRecorder.tsx
- community-settings/permissions.ts
- @dnd-kit/utilities
- menu-parts.tsx
- react-dom
- @supabase/supabase-js
- community-migrations.contract.mjs
- requireInfluencerWorkspace
- viewer.ts
- emoji-actions.ts
- status-badge.tsx
- AppShell.tsx
- dashboard/settings/page.tsx
- tabs.tsx
- MemberProfileDialog.tsx
- channels.contract.mjs
- MessageMenu.tsx
- sections.ts
- presence.ts
- isRateLimited
- CommunityProvider.tsx
- toggle-group.tsx
- roles.ts
- @supabase/ssr
- lucide-react
- CourseCatalogPage.tsx
- use-community-branding.ts
- @dnd-kit/core
- combobox.tsx
- dashboard/notifications/page.tsx
- @base-ui/react
- auth-recovery.contract.mjs

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

## Communities (201 total, 43 thin omitted)

### Community 0 - "AskStoicScreens.tsx"
Cohesion: 0.15
Nodes (6): ButtonLink(), CommunityChannel, CommunityPost, cx(), FeedScreen(), Panel()

### Community 1 - "app/mentorship/page.tsx"
Cohesion: 0.31
Nodes (6): CreatorMentorshipPage(), MentorshipPage(), MentorshipPageOptions, renderMentorshipPage(), MentorshipView(), MentorshipViewProps

### Community 2 - "community-settings/model.ts"
Cohesion: 0.10
Nodes (25): bounded(), CASE_KIND_LABELS, CASE_KINDS, channelLuminance(), CommunityIdentity, CommunitySafety, DEFAULT_COMMUNITY_IDENTITY, DEFAULT_COMMUNITY_SAFETY (+17 more)

### Community 3 - "requireInfluencer"
Cohesion: 0.10
Nodes (37): GET(), runtime, ActionResult, addCourseVideo(), addLesson(), createCourse(), deleteCourse(), deleteCourseVideo() (+29 more)

### Community 4 - "AuthForm.tsx"
Cohesion: 0.13
Nodes (17): setPasswordAction(), metadata, ResetConfirmPage(), metadata, ErrorNote(), PasswordField(), SubmitButton(), TextField() (+9 more)

### Community 5 - "CreatorEventsView.tsx"
Cohesion: 0.10
Nodes (27): ActionResult, cancelEvent(), enrollInEvent(), isApprovedZoomUrl(), isoDate(), publishEvent(), revalidateEvents(), saveCreatorEvent() (+19 more)

### Community 6 - "AccountSettingsWorkspace.tsx"
Cohesion: 0.06
Nodes (47): DeletionPendingPage(), GET(), POST(), runtime, adoptOwner(), isLocalRequest(), LOCAL_HOSTS, POST() (+39 more)

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

### Community 13 - "DashboardView.tsx"
Cohesion: 0.15
Nodes (10): DashboardData, Event, eventDate(), LegacyDashboardView(), roleName(), TierProgressDetail, currency, eventDate() (+2 more)

### Community 14 - "dependencies"
Cohesion: 0.12
Nodes (17): class-variance-authority, clsx, @dnd-kit/sortable, emojibase-data, dependencies, class-variance-authority, clsx, @dnd-kit/sortable (+9 more)

### Community 15 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 16 - "constants.ts"
Cohesion: 0.12
Nodes (21): ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES, ATTACHMENTS_PER_MESSAGE, CHANNEL_NOTIFICATION_LEVELS, ChannelNotificationLevel, CUSTOM_EMOJI_TOKEN, formatBytes(), FORWARD_CHANNEL_LIMIT (+13 more)

### Community 17 - "EmojiPicker.tsx"
Cohesion: 0.07
Nodes (50): generate(), OUTPUT, require, root, applySkinTone(), buildIndex(), CompactEmojiInput, EMOJI_GROUPS (+42 more)

### Community 18 - "Influencer Implementation Plan"
Cohesion: 0.12
Nodes (15): 1. Permission model — two independent axes, 2.1 Home / Analytics, 2.2 Members, 2.3 Learning (Tiers), 2.4 Events, 2. Influencer Dashboard — surfaces, 3. Gifting membership — rules, 4. Membership lapse behavior (+7 more)

### Community 19 - "channels/actions.ts"
Cohesion: 0.10
Nodes (29): access(), creatorSupabase(), deleteChannelOverride(), deleteCommunityStructure(), reorderCommunityStructure(), Result, saveCategory(), saveChannel() (+21 more)

### Community 20 - "VideoPage.tsx"
Cohesion: 0.21
Nodes (10): VideoPage(), renderVideoPage(), DashboardVideoPage(), formatDuration(), LegacyCourseVideoPlayer(), PlaylistVideo, formatDuration(), LessonWorkspacePlayer() (+2 more)

### Community 21 - "createClient"
Cohesion: 0.13
Nodes (31): RFC-4122, POST(), dynamic, GET(), PERIODS, acceptRules(), createThread(), deleteMessage() (+23 more)

### Community 22 - "Graphify Workflow"
Cohesion: 0.14
Nodes (14): Graphify, Incremental Update, Graph Exports, Extraction Schema, Multi-repository Merge, Post-commit Rebuild, Graph Query, Transcription (+6 more)

### Community 23 - "Product Requirements Document"
Cohesion: 0.15
Nodes (12): Authorization Boundary, Creator Workspace, Curriculum Progression, Membership Activation, Mentorship, Non-goals and deferred behaviour, Product, Product Requirements Document (+4 more)

### Community 24 - "Stoicverse Design System"
Cohesion: 0.15
Nodes (12): Accessible Interaction, Direction, Identity Command Center, Interaction and accessibility, Layout and components, Mobile, Notification Inbox, Palette (+4 more)

### Community 25 - "Composer.tsx"
Cohesion: 0.18
Nodes (14): Pinned, PinsPopover(), Thread, ThreadListPopover(), useLazyRows(), PendingAttachment, Recording, Popover() (+6 more)

### Community 26 - "design_md.md"
Cohesion: 0.15
Nodes (12): Brand & Style, Buttons, Cards, Chips & Status Indicators, Colors, Components, Data Visualization, Elevation & Depth (+4 more)

### Community 27 - "Implementation Plan and Delivery Status"
Cohesion: 0.18
Nodes (10): Access and data safety, Community and curriculum, Documentation maintenance rule, Existing extra or unapproved behaviour, Implementation Plan and Delivery Status, Implemented foundation, Must complete before MVP launch, Payments and account lifecycle (+2 more)

### Community 28 - "CreatorAnalyticsView.tsx"
Cohesion: 0.07
Nodes (43): GET(), Cell, Courses(), CreatorAnalyticsView(), date(), delta(), Events(), money() (+35 more)

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

### Community 38 - "useToast"
Cohesion: 0.13
Nodes (12): geist, jetbrainsMono, metadata, viewport, InlineEditor(), ForwardDialog(), DURATION_MS, Toast (+4 more)

### Community 39 - "workspace.ts"
Cohesion: 0.10
Nodes (30): ACTION_COPY, ACTIONS, AuditLogSection(), AutomodPreset, AUDIT_PAGE_SIZE, AuditEvent, AUTOMOD_ALERT_PAGE_SIZE, AutomodAlertRow (+22 more)

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
Cohesion: 0.06
Nodes (47): GET(), GET(), platformRoles, statuses, currentIsoWeekStart(), giftMemberSubscription(), moderateMember(), refreshMemberOperations() (+39 more)

### Community 72 - "automod.ts"
Cohesion: 0.12
Nodes (32): deleteAutomodRule(), Result, saveAutomodRule(), setAutomodExemptions(), testAutomodBody(), toggleAutomodRule(), RuleDraft, RuleEditor() (+24 more)

### Community 73 - "alert-dialog.tsx"
Cohesion: 0.12
Nodes (13): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+5 more)

### Community 74 - "tokenize.ts"
Cohesion: 0.14
Nodes (18): EMPTY, MarkdownBody(), MentionResolvers, renderTokens(), collectMentions(), Cursor, ENTITY_PATTERNS, INLINE_DELIMITERS (+10 more)

### Community 79 - "Skeletons.tsx"
Cohesion: 0.06
Nodes (6): CardGridSkeleton(), ChartWorkspaceSkeleton(), FeedSkeleton(), OverviewSkeleton(), SettingsSkeleton(), TableSkeleton()

### Community 82 - "data-table.tsx"
Cohesion: 0.22
Nodes (11): Column, DataTable(), EmptyState(), Table(), TableBody(), TableCaption(), TableCell(), TableFooter() (+3 more)

### Community 86 - "plans.ts"
Cohesion: 0.10
Nodes (27): POST(), runtime, CheckoutPage(), confirmAccess(), CheckoutScreen(), COPY, PLAN_LABEL, PlanOffer (+19 more)

### Community 91 - "creator/settings/actions.ts"
Cohesion: 0.13
Nodes (19): clearLockdown(), Result, saveCommunitySafety(), saveRole(), setRoleMembers(), value(), Candidate, MemberRow (+11 more)

### Community 95 - "card.tsx"
Cohesion: 0.22
Nodes (8): Card(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), Density, PAD

### Community 96 - "auth/actions.ts"
Cohesion: 0.22
Nodes (13): appOrigin(), AuthActionState, clientKey(), loginAction(), rememberPendingEmail(), requestPasswordResetAction(), signupAction(), takePendingEmail() (+5 more)

### Community 123 - "Medium"
Cohesion: 0.08
Nodes (23): C1 — A failed Stripe webhook is never retried, so a paid member never gets access, C2 — Any member can rewrite every other member's course progress, Critical, H1 — The service-role client silently falls back to a fake key, H2 — `npm run test:security` exits 0 having run nothing, H3 — 10 high-severity dependency advisories, H4 — The migration directory can no longer reproduce the database, H5 — No CI exists (+15 more)

### Community 124 - "Creator Analytics and Revenue Plan"
Cohesion: 0.10
Nodes (19): Analytics implementation, Confirmed product rules, Courses, /creator/analytics, Creator Analytics and Revenue Plan, /creator/revenue, Credit correctness and data requirements, Delivery sequence (+11 more)

### Community 125 - "supabase/server.ts"
Cohesion: 0.21
Nodes (8): GET(), Home(), metadata, AuthForm(), DEFAULT_NEXT_PATH, safeNextPath(), getSupabaseConfig(), hasSupabaseConfig()

### Community 126 - "Stoicverse project and branch status"
Cohesion: 0.15
Nodes (12): Branch inventory, Concrete unfinished work and risks, Documentation and maintenance, Executive assessment, Feature gaps, Implemented in committed history, Integration history, Recommended next steps (+4 more)

### Community 127 - "channels-helpers.test.mjs"
Cohesion: 0.13
Nodes (14): GROUP_WINDOW_MS, activeMentionQuery(), decodeMentions(), EMPTY, encodeMentions(), MentionDictionary, MentionTarget, AffordanceInput (+6 more)

### Community 128 - "search/route.ts"
Cohesion: 0.21
Nodes (12): CourseRow, CourseVideoRow, DirectoryRow, Embedded, firstOf(), GET(), MemberRow, roleName() (+4 more)

### Community 130 - "role-model.ts"
Cohesion: 0.13
Nodes (22): saveCommunityIdentity(), AccentField(), IdentityPreview(), IdentitySection(), RoleColorField(), ACCENT_SWATCHES, contrastRatio(), formatContrast() (+14 more)

### Community 131 - "AppRail.tsx"
Cohesion: 0.13
Nodes (17): AppRail(), AppRailProps, ICONS, RailVariant, WorkspaceChrome(), Tooltip(), TooltipContent(), TooltipProvider() (+9 more)

### Community 132 - "proxy.ts"
Cohesion: 0.22
Nodes (13): adminRoutes, authRoutes, communityRoutes, config, copyResponseState(), creatorRoutes, isRouteMatch(), memberRoutes (+5 more)

### Community 134 - "isUuid"
Cohesion: 0.30
Nodes (16): banMember(), bulkDeleteMessages(), reportMessage(), resolveReport(), Result, timeoutMember(), unbanMember(), untimeoutMember() (+8 more)

### Community 135 - "requireActiveMembership"
Cohesion: 0.26
Nodes (8): renderCourseDetailPage(), DashboardCoursePage(), DashboardEventsPage(), DashboardPage(), DashboardPageOptions, renderDashboardPage(), renderEventsPage(), requireActiveMembership()

### Community 136 - "RolesSection.tsx"
Cohesion: 0.12
Nodes (23): deleteRole(), RoleEditor(), DeleteRoleCard(), RolesSection(), useRoleOrder(), StructureEditor(), StructureEditorProps, StructurePanes() (+15 more)

### Community 137 - "Migrations — how this project actually deploys"
Cohesion: 0.40
Nodes (4): Known ledger facts (2026-09-10), Migrations — how this project actually deploys, The workflow, Why

### Community 139 - "member-avatar.tsx"
Cohesion: 0.19
Nodes (11): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), DOT, LABEL (+3 more)

### Community 142 - "cn"
Cohesion: 0.11
Nodes (29): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+21 more)

### Community 143 - "utils.ts"
Cohesion: 0.11
Nodes (10): Checkbox(), Density, PageHeader(), Density, Section(), Skeleton(), Slider(), Switch() (+2 more)

### Community 144 - "message-actions.ts"
Cohesion: 0.26
Nodes (10): deriveMessageActions(), JUMP_PAGE_BUDGET, MessageAbilities, MessageActions, messagePermalink(), MessageSubject, NOTHING, abilities() (+2 more)

### Community 145 - "messages.ts"
Cohesion: 0.13
Nodes (17): ChannelsLayout(), ForwardedOrigin, toForwardedOrigin(), toClientMessage(), ChannelMessage, ChannelThread, DirectoryMember, loadCustomEmojis() (+9 more)

### Community 147 - "LandingScreen.tsx"
Cohesion: 0.10
Nodes (14): metadata, SECTIONS, metadata, SECTIONS, PublicFooter(), PublicHeader(), SECTIONS, LegalPage() (+6 more)

### Community 148 - "[channelId]/page.tsx"
Cohesion: 0.21
Nodes (13): ChannelPage(), dynamic, CreatorMasterPage(), AttachmentRow, MasterPage(), MasterPageOptions, renderMasterPage(), ATTACHMENT_URL_TTL_SECONDS (+5 more)

### Community 150 - "SearchOverlay.tsx"
Cohesion: 0.06
Nodes (50): ForwardOutcome, Stage, Hit, KIND_LABEL, KIND_ORDER, Row, SearchOverlay(), Density (+42 more)

### Community 151 - "ChannelsShell.tsx"
Cohesion: 0.18
Nodes (12): CHANNEL_ICONS, ChannelLink(), ChannelNav(), ChannelsShell(), LEVEL_LABEL, ShellSkeleton(), useCommunity(), isTypingTarget() (+4 more)

### Community 152 - "SettingsPageShell.tsx"
Cohesion: 0.18
Nodes (16): SECTION_ICONS, NoticeContext, NoticeContextValue, SettingsNoticeProvider(), useSettingsNotice(), SettingsOverlayShell(), SettingsPageShell(), SettingsRail() (+8 more)

### Community 153 - "NotificationCenter.tsx"
Cohesion: 0.25
Nodes (12): GET(), FeedResponse, groupLabel(), iconFor(), NotificationCenter(), relativeTime, timeAgo(), views (+4 more)

### Community 154 - "design-tokens.contract.mjs"
Cohesion: 0.60
Nodes (3): countAcross(), read(), sourceFiles()

### Community 155 - "access.ts"
Cohesion: 0.20
Nodes (11): AdminPage(), BlockedPage(), dynamic, ChannelsIndexPage(), dynamic, AdminScreen(), membershipState, requireCommunityAccess() (+3 more)

### Community 156 - "withRouteBase"
Cohesion: 0.20
Nodes (12): CourseCard, CourseFilter, CourseRow(), duration(), filters, LearningPathCatalog(), FilterType, LearningPathData (+4 more)

### Community 157 - "ChannelView.tsx"
Cohesion: 0.21
Nodes (12): ChannelView(), dayOf(), MessageRow(), Reactions(), timeOf(), useChannelLive(), MobilePaneDrawer(), continuesGroup() (+4 more)

### Community 158 - "VoiceRecorder.tsx"
Cohesion: 0.21
Nodes (17): clock(), decodeQueue, measure(), measureOnce(), peakCache, SPEEDS, VoicePlayer(), clock() (+9 more)

### Community 159 - "community-settings/permissions.ts"
Cohesion: 0.09
Nodes (30): ChannelPermissionsTab(), Grid, gridFrom(), isNeutral(), ViewAsRolePreview(), SLOW_MODE_STOPS, ALL_KEY_SET, canGrant() (+22 more)

### Community 167 - "requireInfluencerWorkspace"
Cohesion: 0.14
Nodes (15): LessonPage(), LessonPageOptions, renderLessonPage(), CreatorAnalyticsPage(), CreatorCourseManagerPageV2(), CreatorLessonPage(), CreatorDashboardPage(), CreatorEventsPage() (+7 more)

### Community 169 - "viewer.ts"
Cohesion: 0.40
Nodes (10): CheckoutSuccessPage(), CreatorWorkspaceLayout(), MemberWorkspaceLayout(), AppShell(), currentIsMaster, currentProfile, currentViewer, unreadNotificationCount (+2 more)

### Community 170 - "emoji-actions.ts"
Cohesion: 0.32
Nodes (10): createEmoji(), deleteEmoji(), renameEmoji(), Result, EmojiSection(), CUSTOM_EMOJI_LIMITS, CustomEmoji, emojiToken() (+2 more)

### Community 171 - "status-badge.tsx"
Cohesion: 0.38
Nodes (5): Badge(), badgeVariants, StatusBadge(), StatusTone, TONE

### Community 172 - "AppShell.tsx"
Cohesion: 0.16
Nodes (11): AppShellProps, ChromeMounted, EMPTY_NOTIFICATIONS, eventDate(), NotificationBell(), NotificationResponse, SEARCH_GROUPS, SearchKind (+3 more)

### Community 174 - "dashboard/settings/page.tsx"
Cohesion: 0.31
Nodes (7): CreatorAccountPage(), AccountSettingsOptions, renderAccountSettings(), SettingsPage(), validSections, AccountSettingsWorkspace(), SettingsSection

### Community 178 - "tabs.tsx"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 179 - "MemberProfileDialog.tsx"
Cohesion: 0.19
Nodes (10): GIFT_OPTIONS, GiftOption, MemberMenuContext, memberMenuItems(), MenuParts, ACCOUNT_LABEL, Detail, Pending (+2 more)

### Community 181 - "MessageMenu.tsx"
Cohesion: 0.08
Nodes (32): CONTEXT_PARTS, DROPDOWN_PARTS, Pending, Dialog, MenuItemType, MenuSeparatorType, MessageMenu(), ContextMenu() (+24 more)

### Community 184 - "sections.ts"
Cohesion: 0.23
Nodes (11): PermissionKey, DEFAULT_SETTINGS_SECTION, first(), isSettingsSection(), LEGACY_SECTION_ALIASES, parseSettingsQuery(), SECTION_IDS, SettingsGroup (+3 more)

### Community 185 - "presence.ts"
Cohesion: 0.26
Nodes (10): TypingPayload, useCommunityLive(), activeTypists(), groupMembers(), MemberLike, MemberSection, onlineIdsFrom(), TYPING_TTL_MS (+2 more)

### Community 186 - "isRateLimited"
Cohesion: 0.32
Nodes (8): POST(), GET(), PATCH(), GET(), hasTrustedOrigin(), isRateLimited(), rejectUntrustedOrigin(), windows

### Community 187 - "CommunityProvider.tsx"
Cohesion: 0.30
Nodes (11): ChannelRow, CommunityContext, CommunityProvider(), CommunityValue, mergeMessage(), MobilePane, useThreadLive(), Composer() (+3 more)

### Community 188 - "toggle-group.tsx"
Cohesion: 0.27
Nodes (8): react, react, useComboboxAnchor(), ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 189 - "roles.ts"
Cohesion: 0.18
Nodes (10): CommunityRole, isSystemRoleKey(), SystemRoleKey, loadCommunityRoles(), ROLE_ICON_BUCKET, ROLE_MEMBER_PAGE_SIZE, RoleMemberQueryRow, RoleMemberRow (+2 more)

### Community 193 - "CourseCatalogPage.tsx"
Cohesion: 0.33
Nodes (5): CourseEnrollment, CoursesPage(), CourseVideo, renderCoursesPage(), DashboardCoursesPage()

### Community 194 - "use-community-branding.ts"
Cohesion: 0.47
Nodes (5): CommunityBranding, FALLBACK, readCache(), useCommunityBranding(), writeCache()

### Community 196 - "combobox.tsx"
Cohesion: 0.09
Nodes (23): ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty(), ComboboxGroup(), ComboboxInput() (+15 more)

### Community 197 - "dashboard/notifications/page.tsx"
Cohesion: 0.70
Nodes (3): CreatorNotificationsPage(), NotificationsPage(), renderNotifications()

## Knowledge Gaps
- **676 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+671 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `AppRail.tsx`, `combobox.tsx`, `alert-dialog.tsx`, `member-avatar.tsx`, `status-badge.tsx`, `utils.ts`, `data-table.tsx`, `tabs.tsx`, `MessageMenu.tsx`, `SearchOverlay.tsx`, `Composer.tsx`, `toggle-group.tsx`, `card.tsx`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `createClient` connect `createClient` to `search/route.ts`, `auth/actions.ts`, `requireInfluencer`, `AuthForm.tsx`, `CreatorEventsView.tsx`, `AccountSettingsWorkspace.tsx`, `isUuid`, `member-operations/server.ts`, `requireActiveMembership`, `emoji-actions.ts`, `requireInfluencerWorkspace`, `viewer.ts`, `plans.ts`, `NotificationCenter.tsx`, `isRateLimited`, `access.ts`, `supabase/server.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `createClient()` connect `CommunityProvider.tsx` to `role-model.ts`, `presence.ts`, `AppRail.tsx`, `NotificationCenter.tsx`, `isUuid`, `use-community-branding.ts`, `emoji-actions.ts`, `AppShell.tsx`, `MemberProfileDialog.tsx`, `supabase/server.ts`, `SearchOverlay.tsx`, `Composer.tsx`, `creator/settings/actions.ts`, `ChannelView.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _676 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `community-settings/model.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0967741935483871 - nodes in this community are weakly interconnected._
- **Should `requireInfluencer` be split into smaller, more focused modules?**
  _Cohesion score 0.10459183673469388 - nodes in this community are weakly interconnected._
- **Should `AuthForm.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13054187192118227 - nodes in this community are weakly interconnected._