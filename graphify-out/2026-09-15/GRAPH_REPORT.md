# Graph Report - StoicWealthSociety  (2026-09-15)

## Corpus Check
- 492 files · ~432,363 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2405 nodes · 5191 edges · 199 communities (155 shown, 44 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `144d9098`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- access.ts
- login/route.ts
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
- requireActiveMembership
- dependencies
- devDependencies
- constants.ts
- EmojiPicker.tsx
- Influencer Implementation Plan
- automod.ts
- postgresMessage
- SearchOverlay.tsx
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
- MemberRegistry.tsx
- role-model.ts
- CreatorEventsView.tsx
- buttonVariants
- postcss.config.mjs
- Skeletons.tsx
- AuditLogSection.tsx
- supabase/server.ts
- ChannelPermissionsTab.tsx
- MemberProfileDialog.tsx
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
- AuthForm.tsx
- LearningPathCatalog.tsx
- community-settings/permissions.ts
- AppRail.tsx
- proxy.ts
- MessageMenu.tsx
- card.tsx
- RoleEditor.tsx
- Migrations — how this project actually deploys
- member-avatar.tsx
- cn
- AppShell
- overlay.tsx
- messages.ts
- next
- LandingScreen.tsx
- field.tsx
- public-chrome.contract.mjs
- moderation.ts
- utils.ts
- sections.ts
- VideoPage.tsx
- design-tokens.contract.mjs
- requireInfluencerWorkspace
- reset/page.tsx
- ChannelView.tsx
- VoiceRecorder.tsx
- react-dom
- @dnd-kit/utilities
- menu-parts.tsx
- StructureForm.tsx
- @supabase/supabase-js
- community-migrations.contract.mjs
- profileRow
- AskStoicScreens.tsx
- @base-ui/react
- AppShell.tsx
- CourseCatalogPage.tsx
- dashboard/settings/page.tsx
- tabs.tsx
- channels.contract.mjs
- MemberList.tsx
- presence.ts
- CommunityProvider.tsx
- toggle-group.tsx
- auth/actions.ts
- lucide-react
- Composer.tsx
- combobox.tsx
- @supabase/ssr
- channels-helpers.test.mjs
- EmojiSection.tsx
- auth-recovery.contract.mjs
- isUuid

## God Nodes (most connected - your core abstractions)
1. `cn()` - 167 edges
2. `createClient` - 76 edges
3. `postgresMessage()` - 54 edges
4. `revalidateCommunity()` - 40 edges
5. `isUuid()` - 37 edges
6. `buttonVariants()` - 36 edges
7. `createClient()` - 36 edges
8. `requireInfluencerWorkspace()` - 35 edges
9. `profileRow` - 33 edges
10. `useToast()` - 28 edges

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

## Communities (199 total, 44 thin omitted)

### Community 0 - "access.ts"
Cohesion: 0.24
Nodes (9): AdminPage(), BlockedPage(), dynamic, ChannelsIndexPage(), dynamic, membershipState, requireCommunityAccess(), requirePlatformRole() (+1 more)

### Community 1 - "login/route.ts"
Cohesion: 0.19
Nodes (14): adoptOwner(), isLocalRequest(), LOCAL_HOSTS, POST(), secretMatches(), seedPersona(), DevLoginPanel(), DEV_PERSONA_EMAIL (+6 more)

### Community 2 - "community-settings/model.ts"
Cohesion: 0.09
Nodes (28): ACCENT_SWATCHES, bounded(), CASE_KIND_LABELS, CASE_KINDS, channelLuminance(), CommunityIdentity, CommunitySafety, DEFAULT_COMMUNITY_IDENTITY (+20 more)

### Community 3 - "CreatorCourseManagerV2.tsx"
Cohesion: 0.08
Nodes (40): GET(), runtime, ActionResult, addCourseVideo(), addLesson(), createCourse(), deleteCourse(), deleteCourseVideo() (+32 more)

### Community 4 - "tokenize.ts"
Cohesion: 0.14
Nodes (18): EMPTY, MarkdownBody(), MentionResolvers, renderTokens(), collectMentions(), Cursor, ENTITY_PATTERNS, INLINE_DELIMITERS (+10 more)

### Community 5 - "EventsView.tsx"
Cohesion: 0.17
Nodes (15): duration(), EventCard(), EventDetails(), EventRecord, EventsView(), formatter, label(), state() (+7 more)

### Community 6 - "AccountSettingsWorkspace.tsx"
Cohesion: 0.09
Nodes (35): DeletionPendingPage(), GET(), POST(), runtime, POST(), runtime, StripeEvent, verifiedEvent() (+27 more)

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

### Community 13 - "requireActiveMembership"
Cohesion: 0.18
Nodes (11): LessonPage(), LessonPageOptions, renderLessonPage(), CreatorLessonPage(), DashboardEventsPage(), DashboardPage(), DashboardPageOptions, renderDashboardPage() (+3 more)

### Community 14 - "dependencies"
Cohesion: 0.12
Nodes (17): class-variance-authority, clsx, @dnd-kit/core, emojibase-data, dependencies, class-variance-authority, clsx, @dnd-kit/core (+9 more)

### Community 15 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 16 - "constants.ts"
Cohesion: 0.15
Nodes (18): ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES, ATTACHMENTS_PER_MESSAGE, ChannelNotificationLevel, CUSTOM_EMOJI_TOKEN, formatBytes(), FORWARD_CHANNEL_LIMIT, isAllowedAttachmentType() (+10 more)

### Community 17 - "EmojiPicker.tsx"
Cohesion: 0.07
Nodes (50): generate(), OUTPUT, require, root, applySkinTone(), buildIndex(), CompactEmojiInput, EMOJI_GROUPS (+42 more)

### Community 18 - "Influencer Implementation Plan"
Cohesion: 0.12
Nodes (15): 1. Permission model — two independent axes, 2.1 Home / Analytics, 2.2 Members, 2.3 Learning (Tiers), 2.4 Events, 2. Influencer Dashboard — surfaces, 3. Gifting membership — rules, 4. Membership lapse behavior (+7 more)

### Community 19 - "automod.ts"
Cohesion: 0.13
Nodes (27): RuleDraft, RuleEditor(), AutomodSection(), draftFor(), Notify, AUTOMOD_KIND_LABELS, AUTOMOD_KINDS, AUTOMOD_LIMITS (+19 more)

### Community 20 - "postgresMessage"
Cohesion: 0.19
Nodes (24): editMessage(), setThreadState(), clearLockdown(), deleteRole(), reorderRoles(), Result, saveCommunityIdentity(), saveCommunitySafety() (+16 more)

### Community 21 - "SearchOverlay.tsx"
Cohesion: 0.09
Nodes (29): Hit, KIND_LABEL, KIND_ORDER, Row, LOCAL_RESULTS_PER_KIND, localCandidates(), RankedResult, rankLocal() (+21 more)

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
Cohesion: 0.14
Nodes (23): CreatorSettingsPage(), SettingsPageShell(), AutomodPreset, AUDIT_PAGE_SIZE, AuditEvent, AUTOMOD_ALERT_PAGE_SIZE, AutomodAlertRow, AutomodRuleRow (+15 more)

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
Nodes (35): GET(), headers, change(), CreatorRevenueView(), date(), decimal(), MemberCredits(), money() (+27 more)

### Community 71 - "MemberRegistry.tsx"
Cohesion: 0.06
Nodes (53): GET(), GET(), platformRoles, statuses, currentIsoWeekStart(), giftMemberSubscription(), moderateMember(), refreshMemberOperations() (+45 more)

### Community 72 - "role-model.ts"
Cohesion: 0.13
Nodes (21): AccentField(), IdentityPreview(), IdentitySection(), RoleColorField(), RoleIconField(), RolePermissionGrid(), Input(), contrastRatio() (+13 more)

### Community 73 - "CreatorEventsView.tsx"
Cohesion: 0.11
Nodes (23): ActionResult, cancelEvent(), enrollInEvent(), isApprovedZoomUrl(), isoDate(), publishEvent(), revalidateEvents(), saveCreatorEvent() (+15 more)

### Community 74 - "buttonVariants"
Cohesion: 0.19
Nodes (13): formatDuration(), LessonWorkspacePlayer(), PlaylistVideo, QueueItem(), ActiveMentorship(), BENEFITS, day(), MentorshipOffer() (+5 more)

### Community 79 - "Skeletons.tsx"
Cohesion: 0.06
Nodes (6): CardGridSkeleton(), ChartWorkspaceSkeleton(), FeedSkeleton(), OverviewSkeleton(), SettingsSkeleton(), TableSkeleton()

### Community 82 - "AuditLogSection.tsx"
Cohesion: 0.23
Nodes (13): ACTION_COPY, ACTIONS, Column, DataTable(), EmptyState(), Table(), TableBody(), TableCaption() (+5 more)

### Community 86 - "supabase/server.ts"
Cohesion: 0.05
Nodes (55): POST(), runtime, POST(), GET(), dynamic, GET(), PERIODS, GET() (+47 more)

### Community 91 - "ChannelPermissionsTab.tsx"
Cohesion: 0.13
Nodes (27): access(), creatorSupabase(), deleteChannelOverride(), deleteCommunityStructure(), reorderCommunityStructure(), Result, saveCategory(), saveChannel() (+19 more)

### Community 95 - "MemberProfileDialog.tsx"
Cohesion: 0.07
Nodes (27): setChannelNotificationLevel(), CHANNEL_ICONS, ChannelLink(), ChannelNav(), ChannelsShell(), LEVEL_LABEL, ShellSkeleton(), ACCOUNT_LABEL (+19 more)

### Community 96 - "SetPasswordForm.tsx"
Cohesion: 0.17
Nodes (15): setPasswordAction(), takePendingEmail(), metadata, ResetConfirmPage(), metadata, SignupConfirmPage(), ErrorNote(), PasswordField() (+7 more)

### Community 123 - "Medium"
Cohesion: 0.08
Nodes (23): C1 — A failed Stripe webhook is never retried, so a paid member never gets access, C2 — Any member can rewrite every other member's course progress, Critical, H1 — The service-role client silently falls back to a fake key, H2 — `npm run test:security` exits 0 having run nothing, H3 — 10 high-severity dependency advisories, H4 — The migration directory can no longer reproduce the database, H5 — No CI exists (+15 more)

### Community 124 - "Creator Analytics and Revenue Plan"
Cohesion: 0.10
Nodes (19): Analytics implementation, Confirmed product rules, Courses, /creator/analytics, Creator Analytics and Revenue Plan, /creator/revenue, Credit correctness and data requirements, Delivery sequence (+11 more)

### Community 125 - "createClient"
Cohesion: 0.20
Nodes (12): RFC-4122, POST(), createEmoji(), deleteEmoji(), renameEmoji(), Result, RestrictionScope, restrictMember() (+4 more)

### Community 126 - "Stoicverse project and branch status"
Cohesion: 0.15
Nodes (12): Branch inventory, Concrete unfinished work and risks, Documentation and maintenance, Executive assessment, Feature gaps, Implemented in committed history, Integration history, Recommended next steps (+4 more)

### Community 127 - "AuthForm.tsx"
Cohesion: 0.18
Nodes (7): ARRIVAL_NOTICES, AuthForm(), AuthState, initialState, SIGNUP_STEPS, PASSWORD_MIN_LENGTH, SIGNUP_ACK

### Community 128 - "LearningPathCatalog.tsx"
Cohesion: 0.10
Nodes (25): CourseRow, CourseVideoRow, DirectoryRow, Embedded, firstOf(), GET(), MemberRow, roleName() (+17 more)

### Community 130 - "community-settings/permissions.ts"
Cohesion: 0.12
Nodes (23): CHANNEL_TYPES, ALL_KEY_SET, canGrant(), canManageRole(), CHANNEL_KEY_SET, CHANNEL_PERMISSION_KEYS, diffPermissions(), ESCALATING_PERMISSIONS (+15 more)

### Community 131 - "AppRail.tsx"
Cohesion: 0.10
Nodes (22): AppRail(), AppRailProps, ICONS, RailVariant, WorkspaceChrome(), Tooltip(), TooltipContent(), TooltipProvider() (+14 more)

### Community 132 - "proxy.ts"
Cohesion: 0.17
Nodes (17): adminRoutes, authRoutes, communityRoutes, config, copyResponseState(), creatorRoutes, isRouteMatch(), memberRoutes (+9 more)

### Community 134 - "MessageMenu.tsx"
Cohesion: 0.10
Nodes (31): acceptRules(), createThread(), deleteMessage(), forwardMessage(), markChannelRead(), Result, sendChannelMessage(), toggleMessagePin() (+23 more)

### Community 135 - "card.tsx"
Cohesion: 0.22
Nodes (8): Card(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle(), Density, PAD

### Community 136 - "RoleEditor.tsx"
Cohesion: 0.09
Nodes (24): Candidate, MemberRow, MembersTab(), RoleEditor(), RoleForm(), Tab, TABS, CreateRoleButton() (+16 more)

### Community 137 - "Migrations — how this project actually deploys"
Cohesion: 0.40
Nodes (4): Known ledger facts (2026-09-10), Migrations — how this project actually deploys, The workflow, Why

### Community 139 - "member-avatar.tsx"
Cohesion: 0.19
Nodes (11): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), DOT, LABEL (+3 more)

### Community 142 - "cn"
Cohesion: 0.09
Nodes (28): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+20 more)

### Community 143 - "AppShell"
Cohesion: 0.31
Nodes (6): renderCourseDetailPage(), CreatorNotificationsPage(), DashboardCoursePage(), NotificationsPage(), renderNotifications(), AppShell()

### Community 144 - "overlay.tsx"
Cohesion: 0.17
Nodes (20): ForwardOutcome, Stage, Density, DensityContext, Overlay(), OverlayBackdrop(), OverlayBody(), OverlayClose() (+12 more)

### Community 145 - "messages.ts"
Cohesion: 0.15
Nodes (15): ChannelsLayout(), ForwardedOrigin, toForwardedOrigin(), toClientMessage(), ChannelMessage, ChannelThread, loadCustomEmojis(), loadMemberDirectory() (+7 more)

### Community 147 - "LandingScreen.tsx"
Cohesion: 0.09
Nodes (17): Home(), metadata, metadata, SECTIONS, metadata, SECTIONS, PublicFooter(), PublicHeader() (+9 more)

### Community 148 - "field.tsx"
Cohesion: 0.15
Nodes (13): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+5 more)

### Community 150 - "moderation.ts"
Cohesion: 0.22
Nodes (7): CaseKind, ReportReason, ReportStatus, BanRow, CaseRow, MODERATION_PAGE_SIZE, ReportRow

### Community 151 - "utils.ts"
Cohesion: 0.10
Nodes (12): Badge(), badgeVariants, Checkbox(), Density, PageHeader(), Density, Section(), Skeleton() (+4 more)

### Community 152 - "sections.ts"
Cohesion: 0.13
Nodes (24): AuditLogSection(), SECTION_ICONS, SettingsOverlayShell(), SettingsRail(), SettingsSectionBody(), SettingsTarget, useOpenSettings(), StructureEditor() (+16 more)

### Community 153 - "VideoPage.tsx"
Cohesion: 0.60
Nodes (3): VideoPage(), renderVideoPage(), DashboardVideoPage()

### Community 154 - "design-tokens.contract.mjs"
Cohesion: 0.70
Nodes (4): countAcross(), read(), sourceFiles(), stripComments()

### Community 155 - "requireInfluencerWorkspace"
Cohesion: 0.27
Nodes (13): CheckoutSuccessPage(), CreatorWorkspaceLayout(), CreatorMembersPage(), CreatorRevenuePage(), MemberWorkspaceLayout(), requireInfluencerWorkspace(), currentIsMaster, currentProfile (+5 more)

### Community 157 - "ChannelView.tsx"
Cohesion: 0.20
Nodes (16): ChannelView(), dayOf(), InlineEditor(), MessageRow(), timeOf(), useChannelLive(), useCommunity(), Composer() (+8 more)

### Community 158 - "VoiceRecorder.tsx"
Cohesion: 0.17
Nodes (20): clock(), decodeQueue, measure(), measureOnce(), peakCache, SPEEDS, VoicePlayer(), clock() (+12 more)

### Community 162 - "StructureForm.tsx"
Cohesion: 0.10
Nodes (24): channelMeta(), channelSlug(), ChannelTypeMeta, META, useRoleOrder(), AccessFields(), StructureEditorProps, StructurePanes() (+16 more)

### Community 167 - "profileRow"
Cohesion: 0.22
Nodes (5): CreatorCourseManagerPageV2(), CreatorDashboardPage(), CreatorEventsPage(), CreatorMemberTurnoverPage(), profileRow

### Community 169 - "AskStoicScreens.tsx"
Cohesion: 0.15
Nodes (13): CreatorMasterPage(), AttachmentRow, MasterPage(), MasterPageOptions, renderMasterPage(), AdminScreen(), CommunityChannel, CommunityPost (+5 more)

### Community 171 - "AppShell.tsx"
Cohesion: 0.10
Nodes (18): DashboardData, Event, TierProgressDetail, currency, eventDate(), TerminalDashboard(), AppShellProps, ChromeMounted (+10 more)

### Community 172 - "CourseCatalogPage.tsx"
Cohesion: 0.33
Nodes (5): CourseEnrollment, CoursesPage(), CourseVideo, renderCoursesPage(), DashboardCoursesPage()

### Community 174 - "dashboard/settings/page.tsx"
Cohesion: 0.36
Nodes (6): CreatorAccountPage(), AccountSettingsOptions, renderAccountSettings(), SettingsPage(), validSections, SettingsSection

### Community 178 - "tabs.tsx"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 181 - "MemberList.tsx"
Cohesion: 0.09
Nodes (23): CONTEXT_PARTS, DROPDOWN_PARTS, Pending, GIFT_OPTIONS, GiftOption, MemberMenuContext, memberMenuItems(), MenuParts (+15 more)

### Community 185 - "presence.ts"
Cohesion: 0.26
Nodes (10): TypingPayload, useCommunityLive(), activeTypists(), groupMembers(), MemberLike, MemberSection, onlineIdsFrom(), TYPING_TTL_MS (+2 more)

### Community 186 - "CommunityProvider.tsx"
Cohesion: 0.19
Nodes (17): ChannelPage(), dynamic, ChannelRow, CommunityContext, CommunityValue, mergeMessage(), MobilePane, useThreadLive() (+9 more)

### Community 188 - "toggle-group.tsx"
Cohesion: 0.27
Nodes (8): react, react, useComboboxAnchor(), ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 189 - "auth/actions.ts"
Cohesion: 0.46
Nodes (7): appOrigin(), AuthActionState, clientKey(), loginAction(), rememberPendingEmail(), requestPasswordResetAction(), signupAction()

### Community 193 - "Composer.tsx"
Cohesion: 0.26
Nodes (10): Pinned, PinsPopover(), Thread, ThreadListPopover(), useLazyRows(), PendingAttachment, Popover(), PopoverContent() (+2 more)

### Community 196 - "combobox.tsx"
Cohesion: 0.09
Nodes (22): ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty(), ComboboxGroup(), ComboboxInput() (+14 more)

### Community 199 - "channels-helpers.test.mjs"
Cohesion: 0.12
Nodes (15): CommunityProvider(), GROUP_WINDOW_MS, activeMentionQuery(), decodeMentions(), EMPTY, encodeMentions(), MentionDictionary, MentionTarget (+7 more)

### Community 201 - "EmojiSection.tsx"
Cohesion: 0.42
Nodes (6): EmojiSection(), CUSTOM_EMOJI_LIMITS, CustomEmoji, emojiToken(), isAllowedEmojiType(), parseEmojiName()

### Community 205 - "isUuid"
Cohesion: 0.32
Nodes (15): giftMembership(), banMember(), bulkDeleteMessages(), resolveReport(), Result, timeoutMember(), unbanMember(), untimeoutMember() (+7 more)

## Knowledge Gaps
- **682 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+677 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `Composer.tsx`, `AppRail.tsx`, `combobox.tsx`, `EventsView.tsx`, `MessageMenu.tsx`, `card.tsx`, `role-model.ts`, `buttonVariants`, `member-avatar.tsx`, `overlay.tsx`, `AuditLogSection.tsx`, `tabs.tsx`, `field.tsx`, `MemberList.tsx`, `utils.ts`, `sections.ts`, `toggle-group.tsx`, `MemberProfileDialog.tsx`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `createClient` connect `createClient` to `LearningPathCatalog.tsx`, `SetPasswordForm.tsx`, `access.ts`, `CreatorCourseManagerV2.tsx`, `AccountSettingsWorkspace.tsx`, `MessageMenu.tsx`, `MemberRegistry.tsx`, `CreatorEventsView.tsx`, `isUuid`, `requireActiveMembership`, `LandingScreen.tsx`, `postgresMessage`, `supabase/server.ts`, `requireInfluencerWorkspace`, `auth/actions.ts`, `MemberProfileDialog.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `createClient()` connect `CommunityProvider.tsx` to `Composer.tsx`, `AppRail.tsx`, `proxy.ts`, `role-model.ts`, `EmojiSection.tsx`, `RoleEditor.tsx`, `AppShell.tsx`, `isUuid`, `SearchOverlay.tsx`, `supabase/server.ts`, `presence.ts`, `ChannelView.tsx`, `MemberProfileDialog.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _682 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `community-settings/model.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08819345661450925 - nodes in this community are weakly interconnected._
- **Should `CreatorCourseManagerV2.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `tokenize.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13768115942028986 - nodes in this community are weakly interconnected._