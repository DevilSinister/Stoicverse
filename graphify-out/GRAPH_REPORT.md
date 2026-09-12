# Graph Report - StoicWealthSociety  (2026-09-12)

## Corpus Check
- 433 files · ~396,317 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2185 nodes · 4459 edges · 196 communities (155 shown, 41 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `28f324c3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- access.ts
- SettingsPageShell.tsx
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
- CourseVideoPlayer.tsx
- automod.ts
- Graphify Workflow
- Product Requirements Document
- Stoicverse Design System
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
- community/actions.ts
- alert-dialog.tsx
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
- revenue/model.ts
- Cairn Design System Reference
- eslint.config.mjs
- MessageMenu.tsx
- sections.ts
- cn
- tokenize.ts
- postcss.config.mjs
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
- combobox.tsx
- Stoicverse project and branch status
- ChannelView.tsx
- search/route.ts
- members/actions.ts
- role-model.ts
- proxy.ts
- NotificationCenter.tsx
- IdentitySection.tsx
- postgresMessage
- Migrations — how this project actually deploys
- utils.ts
- member-operations/server.ts
- message-actions.ts
- messages.ts
- next
- LandingScreen.tsx
- field.tsx
- workspace.ts
- AppShell.tsx
- ChannelsShell.tsx
- login/route.ts
- CreatorRevenueView.tsx
- StructureEditor.tsx
- AuditLogSection.tsx
- CourseCatalogPage.tsx
- @base-ui/react
- VoicePlayer.tsx
- channels/actions.ts
- @dnd-kit/utilities
- ChannelView
- react-dom
- @supabase/supabase-js
- community-migrations.contract.mjs
- requireInfluencerWorkspace
- community-settings/permissions.ts
- createAdminClient
- search-query.ts
- app/mentorship/page.tsx
- createClient
- CommunitySurface.tsx
- [channelId]/page.tsx
- CommunityWorkspace.tsx
- TurnoverWorkspace.tsx
- isUuid
- tabs.tsx
- @dnd-kit/core
- channels.contract.mjs
- MemberList.tsx
- MemberRegistry.tsx
- presence.ts
- @dnd-kit/sortable
- dropdown-menu.tsx
- toggle-group.tsx
- VideoPage.tsx
- stream/route.ts
- dialog.tsx
- lucide-react
- MemberProfileDialog.tsx
- checkout/page.tsx
- tooltip.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 149 edges
2. `createClient()` - 69 edges
3. `postgresMessage()` - 55 edges
4. `revalidateCommunity()` - 37 edges
5. `isUuid()` - 36 edges
6. `createClient()` - 36 edges
7. `requireInfluencerWorkspace()` - 33 edges
8. `AppShell()` - 29 edges
9. `requireInfluencer()` - 29 edges
10. `Content safety` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Cairn Design System Reference` --semantically_similar_to--> `Cairn Pricing Page Reference`  [INFERRED] [semantically similar]
  cover.webp → preview-desktop.png
- `ChannelView()` --indirect_call--> `message()`  [INFERRED]
  src/components/channels/ChannelView.tsx → tests/channels-message-actions.test.mjs
- `buildAnalytics()` --indirect_call--> `row()`  [INFERRED]
  src/lib/analytics/model.ts → tests/community-settings-order.test.mjs
- `parse()` --calls--> `parseSearchQuery()`  [EXTRACTED]
  tests/channels-search-query.test.mjs → src/lib/channels/search-query.ts
- `press()` --calls--> `resolveShortcut()`  [EXTRACTED]
  tests/channels-shortcuts.test.mjs → src/lib/channels/shortcuts.ts

## Import Cycles
- 2-file cycle: `src/components/dashboard/DashboardView.tsx -> src/components/dashboard/TerminalDashboard.tsx -> src/components/dashboard/DashboardView.tsx`
- 2-file cycle: `src/components/courses/CourseCatalog.tsx -> src/components/courses/LearningPathCatalog.tsx -> src/components/courses/CourseCatalog.tsx`

## Hyperedges (group relationships)
- **Member Value Flow** — 01_prd_membership_activation, 01_prd_curriculum_progression, 01_prd_mentorship [EXTRACTED 1.00]
- **Protected Access Model** — 04_database_schema_profiles, 04_database_schema_memberships, 04_database_schema_course_video_assets [EXTRACTED 1.00]
- **Checkout Screen Variants** — stitch_screens_ask_stoic___checkout_checkout_screen, stitch_screens_ask_stoic___checkout_desktop_checkout_desktop_screen, stitch_screens_ask_stoic___checkout_mobile_checkout_mobile_screen [INFERRED 0.85]
- **Dashboard Screen Variants** — stitch_screens_ask_stoic___dashboard_desktop_dashboard_desktop_screen, stitch_screens_ask_stoic___dashboard_desktop__discord_sidebar_dashboard_discord_sidebar_screen, stitch_screens_ask_stoic___dashboard_mobile_dashboard_mobile_screen [INFERRED 0.85]
- **Trading Education Learning Flow** — stitch_screens_ask_stoic___trading_education_platform_trading_education_platform, stitch_screens_ask_stoic___trading_education_platform_learning_roadmap, stitch_screens_ask_stoic___trading_education_platform_progression_model [EXTRACTED 1.00]

## Communities (196 total, 41 thin omitted)

### Community 0 - "access.ts"
Cohesion: 0.09
Nodes (22): AdminPage(), CreatorMasterPage(), NotificationsPage(), MasterPage(), MasterPageOptions, renderMasterPage(), CommitmentPage(), SubscriptionPage() (+14 more)

### Community 1 - "SettingsPageShell.tsx"
Cohesion: 0.20
Nodes (13): CreatorSettingsPage(), NoticeContext, NoticeContextValue, SettingsNoticeProvider(), useSettingsNotice(), SettingsOverlayShell(), SettingsPageShell(), SettingsRail() (+5 more)

### Community 2 - "community-settings/model.ts"
Cohesion: 0.11
Nodes (22): SafetySection(), when(), bounded(), CASE_KIND_LABELS, CASE_KINDS, CommunityIdentity, CommunitySafety, DEFAULT_COMMUNITY_IDENTITY (+14 more)

### Community 3 - "requireInfluencer"
Cohesion: 0.13
Nodes (33): ActionResult, addCourseVideo(), addLesson(), createCourse(), deleteCourse(), deleteCourseVideo(), driveId(), enrollInCourse() (+25 more)

### Community 4 - "AuthForm.tsx"
Cohesion: 0.13
Nodes (11): appOrigin(), AuthActionState, clientKey(), loginAction(), signupAction(), ARRIVAL_NOTICES, AuthForm(), AuthState (+3 more)

### Community 5 - "CreatorEventsView.tsx"
Cohesion: 0.09
Nodes (29): DashboardEventsPage(), ActionResult, cancelEvent(), enrollInEvent(), isApprovedZoomUrl(), isoDate(), publishEvent(), revalidateEvents() (+21 more)

### Community 6 - "AccountSettingsWorkspace.tsx"
Cohesion: 0.14
Nodes (23): DeletionPendingPage(), authenticatedMember(), avatarTypes, cancelAccountDeletion(), logoutAction(), rateLimit(), removeAvatar(), requestAccountDeletion() (+15 more)

### Community 7 - "compilerOptions"
Cohesion: 0.06
Nodes (32): dom, dom.iterable, esnext, **/*.mts, .next-build/dev/types/**/*.ts, .next-build/types/**/*.ts, .next/dev/types/**/*.ts, next-env.d.ts (+24 more)

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
Cohesion: 0.14
Nodes (12): DashboardPage(), DashboardPageOptions, renderDashboardPage(), DashboardData, Event, eventDate(), LegacyDashboardView(), roleName() (+4 more)

### Community 14 - "dependencies"
Cohesion: 0.12
Nodes (17): class-variance-authority, clsx, emojibase-data, dependencies, class-variance-authority, clsx, emojibase-data, recharts (+9 more)

### Community 15 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 16 - "constants.ts"
Cohesion: 0.12
Nodes (28): sendChannelMessage(), sendMessage(), Composer(), PendingAttachment, MENTIONS, MentionTrigger, mentionTriggerAt(), MessageComposer() (+20 more)

### Community 17 - "EmojiPicker.tsx"
Cohesion: 0.06
Nodes (59): generate(), OUTPUT, require, root, applySkinTone(), buildIndex(), CompactEmojiInput, EMOJI_GROUPS (+51 more)

### Community 18 - "Influencer Implementation Plan"
Cohesion: 0.12
Nodes (15): 1. Permission model — two independent axes, 2.1 Home / Analytics, 2.2 Members, 2.3 Learning (Tiers), 2.4 Events, 2. Influencer Dashboard — surfaces, 3. Gifting membership — rules, 4. Membership lapse behavior (+7 more)

### Community 20 - "CourseVideoPlayer.tsx"
Cohesion: 0.31
Nodes (7): formatDuration(), LegacyCourseVideoPlayer(), PlaylistVideo, formatDuration(), LessonWorkspacePlayer(), PlaylistVideo, QueueItem()

### Community 21 - "automod.ts"
Cohesion: 0.14
Nodes (27): RuleDraft, RuleEditor(), AutomodSection(), draftFor(), AUTOMOD_KIND_LABELS, AUTOMOD_KINDS, AUTOMOD_LIMITS, AUTOMOD_MATCH_MODES (+19 more)

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
Nodes (43): GET(), CreatorAnalyticsPage(), Cell, Courses(), CreatorAnalyticsView(), date(), delta(), Events() (+35 more)

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

### Community 38 - "community/actions.ts"
Cohesion: 0.10
Nodes (21): acceptRules(), forwardMessage(), ForwardOutcome, markChannelRead(), Result, inter, jetbrainsMono, metadata (+13 more)

### Community 39 - "alert-dialog.tsx"
Cohesion: 0.08
Nodes (17): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+9 more)

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

### Community 68 - "revenue/model.ts"
Cohesion: 0.13
Nodes (25): GET(), headers, CreatorRevenuePage(), CreatorRevenueView(), buildRevenue(), defaultRevenueFilters(), parseRevenueFilters(), RevenueAggregate (+17 more)

### Community 71 - "MessageMenu.tsx"
Cohesion: 0.20
Nodes (12): createThread(), Dialog, MenuItemType, MenuSeparatorType, MessageMenu(), ContextMenuContent(), ContextMenuItem(), ContextMenuSeparator() (+4 more)

### Community 72 - "sections.ts"
Cohesion: 0.18
Nodes (15): SECTION_ICONS, DEFAULT_SETTINGS_SECTION, first(), isSettingsSection(), LEGACY_SECTION_ALIASES, parseSettingsQuery(), SECTION_IDS, SETTINGS_GROUPS (+7 more)

### Community 73 - "cn"
Cohesion: 0.11
Nodes (30): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), PopoverContent(), PopoverDescription() (+22 more)

### Community 74 - "tokenize.ts"
Cohesion: 0.18
Nodes (14): collectMentions(), Cursor, ENTITY_PATTERNS, INLINE_DELIMITERS, isWordChar(), JUMBO_EMOJI_LIMIT, MAX_DEPTH, MentionKind (+6 more)

### Community 123 - "Medium"
Cohesion: 0.08
Nodes (23): C1 — A failed Stripe webhook is never retried, so a paid member never gets access, C2 — Any member can rewrite every other member's course progress, Critical, H1 — The service-role client silently falls back to a fake key, H2 — `npm run test:security` exits 0 having run nothing, H3 — 10 high-severity dependency advisories, H4 — The migration directory can no longer reproduce the database, H5 — No CI exists (+15 more)

### Community 124 - "Creator Analytics and Revenue Plan"
Cohesion: 0.10
Nodes (19): Analytics implementation, Confirmed product rules, Courses, /creator/analytics, Creator Analytics and Revenue Plan, /creator/revenue, Credit correctness and data requirements, Delivery sequence (+11 more)

### Community 125 - "combobox.tsx"
Cohesion: 0.09
Nodes (23): ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty(), ComboboxGroup(), ComboboxInput() (+15 more)

### Community 126 - "Stoicverse project and branch status"
Cohesion: 0.15
Nodes (12): Branch inventory, Concrete unfinished work and risks, Documentation and maintenance, Executive assessment, Feature gaps, Implemented in committed history, Integration history, Recommended next steps (+4 more)

### Community 127 - "ChannelView.tsx"
Cohesion: 0.11
Nodes (28): setThreadState(), Pinned, PinsPopover(), Thread, ThreadListPopover(), useLazyRows(), MessageRow(), timeOf() (+20 more)

### Community 128 - "search/route.ts"
Cohesion: 0.21
Nodes (12): CourseRow, CourseVideoRow, DirectoryRow, Embedded, firstOf(), GET(), MemberRow, roleName() (+4 more)

### Community 130 - "members/actions.ts"
Cohesion: 0.15
Nodes (20): currentIsoWeekStart(), deleteCosmeticRole(), giftMemberSubscription(), moderateMember(), refreshMemberOperations(), saveCosmeticRole(), saveWeeklyTurnover(), setCosmeticRoleAssignment() (+12 more)

### Community 131 - "role-model.ts"
Cohesion: 0.07
Nodes (38): Candidate, MemberRow, MembersTab(), RoleEditor(), RoleForm(), Tab, TABS, RoleIconField() (+30 more)

### Community 132 - "proxy.ts"
Cohesion: 0.13
Nodes (21): adminRoutes, authRoutes, communityRoutes, config, copyResponseState(), creatorRoutes, isRouteMatch(), memberRoutes (+13 more)

### Community 134 - "NotificationCenter.tsx"
Cohesion: 0.31
Nodes (8): FeedResponse, groupLabel(), iconFor(), NotificationCenter(), relativeTime, timeAgo(), views, safeNotificationHref()

### Community 135 - "IdentitySection.tsx"
Cohesion: 0.20
Nodes (15): AccentField(), IdentityPreview(), IdentitySection(), RoleColorField(), ACCENT_SWATCHES, channelLuminance(), contrastRatio(), formatContrast() (+7 more)

### Community 136 - "postgresMessage"
Cohesion: 0.17
Nodes (26): RFC-4122, RestrictionScope, restrictMember(), Result, SCOPES, unrestrictMember(), clearLockdown(), deleteRole() (+18 more)

### Community 137 - "Migrations — how this project actually deploys"
Cohesion: 0.40
Nodes (4): Known ledger facts (2026-09-10), Migrations — how this project actually deploys, The workflow, Why

### Community 142 - "utils.ts"
Cohesion: 0.12
Nodes (10): Badge(), badgeVariants, Checkbox(), Kbd(), KbdGroup(), RadioGroup(), RadioGroupItem(), Skeleton() (+2 more)

### Community 143 - "member-operations/server.ts"
Cohesion: 0.13
Nodes (23): GET(), GET(), platformRoles, statuses, CreatorMembersPage(), decodeMemberCursor(), encodeMemberCursor(), MemberCursor (+15 more)

### Community 144 - "message-actions.ts"
Cohesion: 0.26
Nodes (10): deriveMessageActions(), JUMP_PAGE_BUDGET, MessageAbilities, MessageActions, messagePermalink(), MessageSubject, NOTHING, abilities() (+2 more)

### Community 145 - "messages.ts"
Cohesion: 0.13
Nodes (15): ChannelsLayout(), ForwardedOrigin, toForwardedOrigin(), toClientMessage(), ChannelThread, DirectoryMember, loadMemberDirectory(), loadViewerState() (+7 more)

### Community 147 - "LandingScreen.tsx"
Cohesion: 0.19
Nodes (8): Home(), metadata, FAQS, gridField(), INCLUDED, LandingScreen(), STAGES, hasSupabaseConfig()

### Community 148 - "field.tsx"
Cohesion: 0.15
Nodes (13): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+5 more)

### Community 149 - "workspace.ts"
Cohesion: 0.12
Nodes (25): AUDIT_PAGE_SIZE, AUTOMOD_ALERT_PAGE_SIZE, AutomodAlertRow, AutomodRuleRow, loadAuditPage(), loadAutomodAlerts(), loadAutomodPresets(), loadAutomodRules() (+17 more)

### Community 150 - "AppShell.tsx"
Cohesion: 0.10
Nodes (25): renderCourseDetailPage(), DashboardCoursePage(), CourseCard, CourseFilter, CourseRow(), duration(), filters, LearningPathCatalog() (+17 more)

### Community 151 - "ChannelsShell.tsx"
Cohesion: 0.15
Nodes (16): setChannelNotificationLevel(), CHANNEL_ICONS, ChannelLink(), ChannelNav(), ChannelsShell(), LEVEL_LABEL, ShellSkeleton(), useCommunity() (+8 more)

### Community 152 - "login/route.ts"
Cohesion: 0.19
Nodes (14): adoptOwner(), isLocalRequest(), LOCAL_HOSTS, POST(), secretMatches(), seedPersona(), DevLoginPanel(), DEV_PERSONA_EMAIL (+6 more)

### Community 153 - "CreatorRevenueView.tsx"
Cohesion: 0.22
Nodes (12): change(), date(), decimal(), MemberCredits(), money(), productName(), RevenueOverview(), RevenueTrend() (+4 more)

### Community 154 - "StructureEditor.tsx"
Cohesion: 0.18
Nodes (16): useRoleOrder(), StructureEditorProps, StructurePanes(), StructureList(), StructureSelection, OrderState, useStructureOrder(), CommunityCategory (+8 more)

### Community 155 - "AuditLogSection.tsx"
Cohesion: 0.40
Nodes (4): ACTION_COPY, ACTIONS, AuditLogSection(), AuditEvent

### Community 156 - "CourseCatalogPage.tsx"
Cohesion: 0.33
Nodes (5): CourseEnrollment, CoursesPage(), CourseVideo, renderCoursesPage(), DashboardCoursesPage()

### Community 158 - "VoicePlayer.tsx"
Cohesion: 0.17
Nodes (20): clock(), decodeQueue, measure(), measureOnce(), peakCache, SPEEDS, VoicePlayer(), clock() (+12 more)

### Community 159 - "channels/actions.ts"
Cohesion: 0.11
Nodes (30): access(), creatorSupabase(), deleteChannelOverride(), deleteCommunityStructure(), reorderCommunityStructure(), Result, Role, roles() (+22 more)

### Community 161 - "ChannelView"
Cohesion: 0.11
Nodes (19): ChannelView(), dayOf(), continuesGroup(), firstUnreadIndex(), GROUP_WINDOW_MS, GroupableMessage, startsNewDay(), activeMentionQuery() (+11 more)

### Community 167 - "requireInfluencerWorkspace"
Cohesion: 0.13
Nodes (12): LessonPage(), LessonPageOptions, renderLessonPage(), CreatorCourseManagerPageV2(), CreatorLessonPage(), CreatorDashboardPage(), CreatorEventsPage(), CreatorNotificationsPage() (+4 more)

### Community 168 - "community-settings/permissions.ts"
Cohesion: 0.13
Nodes (21): ALL_KEY_SET, canGrant(), canManageRole(), CHANNEL_KEY_SET, CHANNEL_PERMISSION_KEYS, diffPermissions(), ESCALATING_PERMISSIONS, isChannelPermissionKey() (+13 more)

### Community 169 - "createAdminClient"
Cohesion: 0.22
Nodes (10): GET(), POST(), runtime, POST(), runtime, StripeEvent, verifiedEvent(), Email (+2 more)

### Community 170 - "search-query.ts"
Cohesion: 0.16
Nodes (16): applyFilter(), dayLabel(), describeFilters(), HAS_LABEL, HAS_VALUES, HasFilter, KEYS, matchName() (+8 more)

### Community 171 - "app/mentorship/page.tsx"
Cohesion: 0.27
Nodes (7): CreatorMentorshipPage(), MentorshipPage(), MentorshipPageOptions, renderMentorshipPage(), Notification, MentorshipView(), MentorshipViewProps

### Community 172 - "createClient"
Cohesion: 0.16
Nodes (21): POST(), products, runtime, POST(), GET(), POST(), dynamic, GET() (+13 more)

### Community 173 - "CommunitySurface.tsx"
Cohesion: 0.13
Nodes (21): deleteMessage(), editMessage(), togglePostHighlight(), toggleReaction(), Reactions(), channelHref(), channelMeta(), ChannelTypeMeta (+13 more)

### Community 174 - "[channelId]/page.tsx"
Cohesion: 0.19
Nodes (11): BlockedPage(), dynamic, ChannelPage(), dynamic, ChannelsIndexPage(), dynamic, ATTACHMENT_URL_TTL_SECONDS, attachmentPathsOf() (+3 more)

### Community 175 - "CommunityWorkspace.tsx"
Cohesion: 0.23
Nodes (9): CreatorChannelsPage(), CreatorCommunityPage(), DashboardCommunityPage(), CommunitySurface(), capabilities, CommunityWorkspace, CommunityWorkspaceOptions, renderCommunityWorkspace() (+1 more)

### Community 176 - "TurnoverWorkspace.tsx"
Cohesion: 0.24
Nodes (9): CreatorMemberTurnoverPage(), isoWeekRange(), money(), statuses, TurnoverDesktopRow(), TurnoverMobileRow(), TurnoverWorkspace(), MemberDirectoryPage (+1 more)

### Community 177 - "isUuid"
Cohesion: 0.26
Nodes (17): giftMembership(), banMember(), bulkDeleteMessages(), reportMessage(), resolveReport(), Result, timeoutMember(), unbanMember() (+9 more)

### Community 178 - "tabs.tsx"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 181 - "MemberList.tsx"
Cohesion: 0.14
Nodes (11): CONTEXT_PARTS, DROPDOWN_PARTS, Pending, ContextMenu(), ContextMenuCheckboxItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuShortcut() (+3 more)

### Community 184 - "MemberRegistry.tsx"
Cohesion: 0.20
Nodes (7): date(), DesktopTable(), EMPTY_FILTERS, Filters, MemberRegistry(), MobileRows(), statusOptions

### Community 185 - "presence.ts"
Cohesion: 0.26
Nodes (10): TypingPayload, useCommunityLive(), activeTypists(), groupMembers(), MemberLike, MemberSection, onlineIdsFrom(), TYPING_TTL_MS (+2 more)

### Community 187 - "dropdown-menu.tsx"
Cohesion: 0.18
Nodes (7): DropdownMenuCheckboxItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuShortcut(), DropdownMenuSub(), DropdownMenuSubContent(), DropdownMenuSubTrigger()

### Community 188 - "toggle-group.tsx"
Cohesion: 0.27
Nodes (8): react, react, useComboboxAnchor(), ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 189 - "VideoPage.tsx"
Cohesion: 0.60
Nodes (3): VideoPage(), renderVideoPage(), DashboardVideoPage()

### Community 190 - "stream/route.ts"
Cohesion: 0.60
Nodes (3): GET(), runtime, getGoogleDriveDownloadUrl()

### Community 191 - "dialog.tsx"
Cohesion: 0.18
Nodes (6): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 193 - "MemberProfileDialog.tsx"
Cohesion: 0.15
Nodes (13): GIFT_OPTIONS, GiftOption, MemberMenuContext, memberMenuItems(), MenuParts, ACCOUNT_LABEL, Detail, Pending (+5 more)

### Community 194 - "checkout/page.tsx"
Cohesion: 0.33
Nodes (4): CheckoutPage(), CheckoutScreen(), OFFERS, Product

## Knowledge Gaps
- **643 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+638 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `createClient` to `search/route.ts`, `access.ts`, `requireInfluencer`, `AuthForm.tsx`, `CreatorEventsView.tsx`, `AccountSettingsWorkspace.tsx`, `proxy.ts`, `postgresMessage`, `member-operations/server.ts`, `constants.ts`, `LandingScreen.tsx`, `ChannelsShell.tsx`, `community/actions.ts`, `requireInfluencerWorkspace`, `createAdminClient`, `CommunitySurface.tsx`, `[channelId]/page.tsx`, `isUuid`, `stream/route.ts`, `checkout/page.tsx`, `MessageMenu.tsx`, `ChannelView.tsx`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `MemberProfileDialog.tsx`, `tooltip.tsx`, `MessageMenu.tsx`, `alert-dialog.tsx`, `utils.ts`, `tabs.tsx`, `field.tsx`, `MemberList.tsx`, `dropdown-menu.tsx`, `toggle-group.tsx`, `combobox.tsx`, `dialog.tsx`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `createClient()` connect `ChannelView.tsx` to `ChannelView`, `MemberProfileDialog.tsx`, `role-model.ts`, `proxy.ts`, `NotificationCenter.tsx`, `IdentitySection.tsx`, `CommunitySurface.tsx`, `constants.ts`, `isUuid`, `AppShell.tsx`, `ChannelsShell.tsx`, `presence.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _643 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `access.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09041835357624832 - nodes in this community are weakly interconnected._
- **Should `community-settings/model.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11264367816091954 - nodes in this community are weakly interconnected._
- **Should `requireInfluencer` be split into smaller, more focused modules?**
  _Cohesion score 0.12624584717607973 - nodes in this community are weakly interconnected._