# Graph Report - StoicWealthSociety  (2026-09-12)

## Corpus Check
- 439 files · ~402,803 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2201 nodes · 4543 edges · 186 communities (146 shown, 40 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c42dba2b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AskStoicScreens.tsx
- sections.ts
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
- VideoPage.tsx
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
- useToast
- sheet.tsx
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
- createClient
- Composer.tsx
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
- creator/settings/actions.ts
- role-model.ts
- proxy.ts
- NotificationCenter.tsx
- EmojiSection.tsx
- member-actions.ts
- Migrations — how this project actually deploys
- utils.ts
- member-operations/server.ts
- MessageMenu.tsx
- messages.ts
- next
- LandingScreen.tsx
- field.tsx
- workspace.ts
- withRouteBase
- ChannelsShell.tsx
- login/route.ts
- @supabase/ssr
- RolesSection.tsx
- VoicePlayer.tsx
- channels/actions.ts
- @dnd-kit/utilities
- CommunityProvider.tsx
- react-dom
- @supabase/supabase-js
- community-migrations.contract.mjs
- requireInfluencerWorkspace
- community-settings/permissions.ts
- webhook/route.ts
- search-query.ts
- AppShell.tsx
- isRateLimited
- channel-meta.ts
- access.ts
- CommunityWorkspace.tsx
- revalidateCommunity
- tabs.tsx
- @dnd-kit/core
- channels.contract.mjs
- MemberList.tsx
- presence.ts
- @dnd-kit/sortable
- toggle-group.tsx
- dialog.tsx
- lucide-react
- checkout/page.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 149 edges
2. `createClient()` - 73 edges
3. `postgresMessage()` - 59 edges
4. `revalidateCommunity()` - 41 edges
5. `isUuid()` - 40 edges
6. `createClient()` - 38 edges
7. `requireInfluencerWorkspace()` - 33 edges
8. `AppShell()` - 29 edges
9. `requireInfluencer()` - 29 edges
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
- `safeNextPath()` --calls--> `safeNextPath()`  [EXTRACTED]
  proxy.ts → src/lib/security/safe-path.ts

## Import Cycles
- 2-file cycle: `src/components/dashboard/DashboardView.tsx -> src/components/dashboard/TerminalDashboard.tsx -> src/components/dashboard/DashboardView.tsx`
- 2-file cycle: `src/components/courses/CourseCatalog.tsx -> src/components/courses/LearningPathCatalog.tsx -> src/components/courses/CourseCatalog.tsx`

## Hyperedges (group relationships)
- **Member Value Flow** — 01_prd_membership_activation, 01_prd_curriculum_progression, 01_prd_mentorship [EXTRACTED 1.00]
- **Protected Access Model** — 04_database_schema_profiles, 04_database_schema_memberships, 04_database_schema_course_video_assets [EXTRACTED 1.00]
- **Checkout Screen Variants** — stitch_screens_ask_stoic___checkout_checkout_screen, stitch_screens_ask_stoic___checkout_desktop_checkout_desktop_screen, stitch_screens_ask_stoic___checkout_mobile_checkout_mobile_screen [INFERRED 0.85]
- **Dashboard Screen Variants** — stitch_screens_ask_stoic___dashboard_desktop_dashboard_desktop_screen, stitch_screens_ask_stoic___dashboard_desktop__discord_sidebar_dashboard_discord_sidebar_screen, stitch_screens_ask_stoic___dashboard_mobile_dashboard_mobile_screen [INFERRED 0.85]
- **Trading Education Learning Flow** — stitch_screens_ask_stoic___trading_education_platform_trading_education_platform, stitch_screens_ask_stoic___trading_education_platform_learning_roadmap, stitch_screens_ask_stoic___trading_education_platform_progression_model [EXTRACTED 1.00]

## Communities (186 total, 40 thin omitted)

### Community 0 - "AskStoicScreens.tsx"
Cohesion: 0.12
Nodes (13): CreatorMasterPage(), MasterPage(), MasterPageOptions, renderMasterPage(), ButtonLink(), CommunityChannel, CommunityPost, cx() (+5 more)

### Community 1 - "sections.ts"
Cohesion: 0.09
Nodes (33): CreatorSettingsPage(), ACTION_COPY, ACTIONS, AuditLogSection(), SECTION_ICONS, NoticeContext, NoticeContextValue, SettingsNoticeProvider() (+25 more)

### Community 2 - "community-settings/model.ts"
Cohesion: 0.09
Nodes (37): AccentField(), IdentityPreview(), IdentitySection(), RoleColorField(), ACCENT_SWATCHES, bounded(), CASE_KIND_LABELS, CASE_KINDS (+29 more)

### Community 3 - "requireInfluencer"
Cohesion: 0.09
Nodes (40): GET(), runtime, ActionResult, addCourseVideo(), addLesson(), createCourse(), deleteCourse(), deleteCourseVideo() (+32 more)

### Community 4 - "AuthForm.tsx"
Cohesion: 0.10
Nodes (18): appOrigin(), AuthActionState, clientKey(), loginAction(), signupAction(), GET(), SettingsPage(), validSections (+10 more)

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
Cohesion: 0.11
Nodes (14): CreatorDashboardPage(), CreatorOverviewView(), currency, delta(), eventTime(), FilterOption, isSameDay(), number (+6 more)

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
Nodes (17): @base-ui/react, class-variance-authority, clsx, emojibase-data, dependencies, @base-ui/react, class-variance-authority, clsx (+9 more)

### Community 15 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 16 - "constants.ts"
Cohesion: 0.12
Nodes (24): MENTIONS, MentionTrigger, mentionTriggerAt(), MessageComposer(), ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES, ATTACHMENTS_PER_MESSAGE, CHANNEL_NOTIFICATION_LEVELS (+16 more)

### Community 17 - "EmojiPicker.tsx"
Cohesion: 0.06
Nodes (59): generate(), OUTPUT, require, root, applySkinTone(), buildIndex(), CompactEmojiInput, EMOJI_GROUPS (+51 more)

### Community 18 - "Influencer Implementation Plan"
Cohesion: 0.12
Nodes (15): 1. Permission model — two independent axes, 2.1 Home / Analytics, 2.2 Members, 2.3 Learning (Tiers), 2.4 Events, 2. Influencer Dashboard — surfaces, 3. Gifting membership — rules, 4. Membership lapse behavior (+7 more)

### Community 20 - "VideoPage.tsx"
Cohesion: 0.21
Nodes (10): VideoPage(), renderVideoPage(), DashboardVideoPage(), formatDuration(), LegacyCourseVideoPlayer(), PlaylistVideo, formatDuration(), LessonWorkspacePlayer() (+2 more)

### Community 21 - "automod.ts"
Cohesion: 0.11
Nodes (32): RuleDraft, RuleEditor(), AutomodSection(), draftFor(), AUTOMOD_KIND_LABELS, AUTOMOD_KINDS, AUTOMOD_LIMITS, AUTOMOD_MATCH_MODES (+24 more)

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

### Community 38 - "useToast"
Cohesion: 0.11
Nodes (16): ForwardOutcome, inter, jetbrainsMono, metadata, InlineEditor(), ForwardDialog(), Stage, RulesGateNotice() (+8 more)

### Community 39 - "sheet.tsx"
Cohesion: 0.18
Nodes (6): SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

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

### Community 71 - "createClient"
Cohesion: 0.16
Nodes (25): POST(), dynamic, GET(), PERIODS, GET(), acceptRules(), createThread(), deleteMessage() (+17 more)

### Community 72 - "Composer.tsx"
Cohesion: 0.19
Nodes (14): Pinned, PinsPopover(), Thread, ThreadListPopover(), useLazyRows(), PendingAttachment, useUnread(), Popover() (+6 more)

### Community 73 - "cn"
Cohesion: 0.08
Nodes (37): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia(), AlertDialogOverlay() (+29 more)

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
Nodes (25): Button(), buttonVariants, ComboboxChip(), ComboboxChips(), ComboboxChipsInput(), ComboboxClear(), ComboboxContent(), ComboboxEmpty() (+17 more)

### Community 126 - "Stoicverse project and branch status"
Cohesion: 0.15
Nodes (12): Branch inventory, Concrete unfinished work and risks, Documentation and maintenance, Executive assessment, Feature gaps, Implemented in committed history, Integration history, Recommended next steps (+4 more)

### Community 127 - "ChannelView.tsx"
Cohesion: 0.13
Nodes (24): ChannelPage(), dynamic, ChannelView(), dayOf(), MessageRow(), Reactions(), timeOf(), mergeMessage() (+16 more)

### Community 128 - "search/route.ts"
Cohesion: 0.21
Nodes (12): CourseRow, CourseVideoRow, DirectoryRow, Embedded, firstOf(), GET(), MemberRow, roleName() (+4 more)

### Community 130 - "creator/settings/actions.ts"
Cohesion: 0.38
Nodes (8): clearLockdown(), Result, saveCommunityIdentity(), saveCommunitySafety(), saveRole(), value(), SafetySection(), when()

### Community 131 - "role-model.ts"
Cohesion: 0.13
Nodes (15): normalizePermissions(), isSystemRoleKey(), parseRoleInput(), RoleInput, SYSTEM_ROLE_KEYS, SystemRoleKey, text(), TIER_ROLE_KEYS (+7 more)

### Community 132 - "proxy.ts"
Cohesion: 0.22
Nodes (13): adminRoutes, authRoutes, communityRoutes, config, copyResponseState(), creatorRoutes, isRouteMatch(), memberRoutes (+5 more)

### Community 134 - "NotificationCenter.tsx"
Cohesion: 0.24
Nodes (13): GET(), FeedResponse, groupLabel(), iconFor(), NotificationCenter(), relativeTime, timeAgo(), views (+5 more)

### Community 135 - "EmojiSection.tsx"
Cohesion: 0.42
Nodes (6): EmojiSection(), CUSTOM_EMOJI_LIMITS, CustomEmoji, emojiToken(), isAllowedEmojiType(), parseEmojiName()

### Community 136 - "member-actions.ts"
Cohesion: 0.15
Nodes (12): RFC-4122, createEmoji(), deleteEmoji(), renameEmoji(), Result, RestrictionScope, restrictMember(), Result (+4 more)

### Community 137 - "Migrations — how this project actually deploys"
Cohesion: 0.40
Nodes (4): Known ledger facts (2026-09-10), Migrations — how this project actually deploys, The workflow, Why

### Community 142 - "utils.ts"
Cohesion: 0.11
Nodes (9): Badge(), badgeVariants, Checkbox(), ScrollArea(), ScrollBar(), Skeleton(), Slider(), Switch() (+1 more)

### Community 143 - "member-operations/server.ts"
Cohesion: 0.05
Nodes (59): GET(), GET(), platformRoles, statuses, currentIsoWeekStart(), deleteCosmeticRole(), giftMemberSubscription(), moderateMember() (+51 more)

### Community 144 - "MessageMenu.tsx"
Cohesion: 0.17
Nodes (14): Dialog, MenuItemType, MenuSeparatorType, deriveMessageActions(), JUMP_PAGE_BUDGET, MessageAbilities, MessageActions, messagePermalink() (+6 more)

### Community 145 - "messages.ts"
Cohesion: 0.13
Nodes (16): ChannelsLayout(), ChannelRow, ForwardedOrigin, toForwardedOrigin(), toClientMessage(), ChannelThread, loadCustomEmojis(), loadMemberDirectory() (+8 more)

### Community 147 - "LandingScreen.tsx"
Cohesion: 0.19
Nodes (8): Home(), metadata, FAQS, gridField(), INCLUDED, LandingScreen(), STAGES, hasSupabaseConfig()

### Community 148 - "field.tsx"
Cohesion: 0.15
Nodes (13): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+5 more)

### Community 149 - "workspace.ts"
Cohesion: 0.10
Nodes (29): StructureEditorProps, CommunityCategory, CommunityChannel, STAFF_ROLES, loadAutomodAlerts(), loadAutomodPresets(), loadAutomodRules(), CaseKind (+21 more)

### Community 150 - "withRouteBase"
Cohesion: 0.13
Nodes (17): CourseEnrollment, CoursesPage(), CourseVideo, renderCoursesPage(), DashboardCoursesPage(), CourseCard, CourseFilter, CourseRow() (+9 more)

### Community 151 - "ChannelsShell.tsx"
Cohesion: 0.10
Nodes (23): CHANNEL_ICONS, ChannelLink(), ChannelNav(), ChannelsShell(), LEVEL_LABEL, ShellSkeleton(), useCommunity(), ACCOUNT_LABEL (+15 more)

### Community 152 - "login/route.ts"
Cohesion: 0.15
Nodes (19): GET(), POST(), runtime, adoptOwner(), isLocalRequest(), LOCAL_HOSTS, POST(), secretMatches() (+11 more)

### Community 154 - "RolesSection.tsx"
Cohesion: 0.13
Nodes (18): RoleEditor(), CreateRoleButton(), DeleteRoleCard(), RolesSection(), useRoleOrder(), StructurePanes(), StructureList(), StructureSelection (+10 more)

### Community 158 - "VoicePlayer.tsx"
Cohesion: 0.17
Nodes (20): clock(), decodeQueue, measure(), measureOnce(), peakCache, SPEEDS, VoicePlayer(), clock() (+12 more)

### Community 159 - "channels/actions.ts"
Cohesion: 0.17
Nodes (22): access(), creatorSupabase(), deleteChannelOverride(), deleteCommunityStructure(), reorderCommunityStructure(), Result, Role, roles() (+14 more)

### Community 161 - "CommunityProvider.tsx"
Cohesion: 0.11
Nodes (20): CommunityContext, CommunityProvider(), CommunityValue, MobilePane, Composer(), GROUP_WINDOW_MS, activeMentionQuery(), decodeMentions() (+12 more)

### Community 167 - "requireInfluencerWorkspace"
Cohesion: 0.18
Nodes (12): LessonPage(), LessonPageOptions, renderLessonPage(), CreatorLessonPage(), CreatorEventsPage(), CreatorMentorshipPage(), MentorshipPage(), MentorshipPageOptions (+4 more)

### Community 168 - "community-settings/permissions.ts"
Cohesion: 0.07
Nodes (39): Candidate, MemberRow, MembersTab(), RoleForm(), Tab, TABS, RoleIconField(), RolePermissionGrid() (+31 more)

### Community 169 - "webhook/route.ts"
Cohesion: 0.36
Nodes (6): POST(), runtime, StripeEvent, verifiedEvent(), Email, sendTransactionalEmail()

### Community 170 - "search-query.ts"
Cohesion: 0.16
Nodes (16): applyFilter(), dayLabel(), describeFilters(), HAS_LABEL, HAS_VALUES, HasFilter, KEYS, matchName() (+8 more)

### Community 171 - "AppShell.tsx"
Cohesion: 0.13
Nodes (15): CreatorNotificationsPage(), AppShell(), AppShellProps, EMPTY_NOTIFICATIONS, eventDate(), Notification, NotificationResponse, roleName() (+7 more)

### Community 172 - "isRateLimited"
Cohesion: 0.27
Nodes (10): POST(), products, runtime, POST(), GET(), PATCH(), hasTrustedOrigin(), isRateLimited() (+2 more)

### Community 173 - "channel-meta.ts"
Cohesion: 0.19
Nodes (13): channelHref(), channelMeta(), ChannelTypeMeta, META, tierName(), ChannelRow(), ChannelSidebar(), Props (+5 more)

### Community 174 - "access.ts"
Cohesion: 0.14
Nodes (14): AdminPage(), BlockedPage(), dynamic, ChannelsIndexPage(), dynamic, NotificationsPage(), CommitmentPage(), SubscriptionPage() (+6 more)

### Community 175 - "CommunityWorkspace.tsx"
Cohesion: 0.22
Nodes (10): CreatorChannelsPage(), CreatorCommunityPage(), DashboardCommunityPage(), CommunitySurface(), capabilities, CommunityWorkspace, CommunityWorkspaceOptions, renderCommunityWorkspace() (+2 more)

### Community 177 - "revalidateCommunity"
Cohesion: 0.22
Nodes (26): giftMembership(), banMember(), bulkDeleteMessages(), resolveReport(), Result, timeoutMember(), unbanMember(), untimeoutMember() (+18 more)

### Community 178 - "tabs.tsx"
Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 181 - "MemberList.tsx"
Cohesion: 0.07
Nodes (30): CONTEXT_PARTS, DROPDOWN_PARTS, Pending, GIFT_OPTIONS, GiftOption, MemberMenuContext, memberMenuItems(), MenuParts (+22 more)

### Community 185 - "presence.ts"
Cohesion: 0.26
Nodes (10): TypingPayload, useCommunityLive(), activeTypists(), groupMembers(), MemberLike, MemberSection, onlineIdsFrom(), TYPING_TTL_MS (+2 more)

### Community 188 - "toggle-group.tsx"
Cohesion: 0.27
Nodes (8): react, react, useComboboxAnchor(), ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 191 - "dialog.tsx"
Cohesion: 0.18
Nodes (6): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 194 - "checkout/page.tsx"
Cohesion: 0.33
Nodes (4): CheckoutPage(), CheckoutScreen(), OFFERS, Product

## Knowledge Gaps
- **643 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+638 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `createClient` to `search/route.ts`, `checkout/page.tsx`, `requireInfluencer`, `AuthForm.tsx`, `CreatorEventsView.tsx`, `NotificationCenter.tsx`, `AccountSettingsWorkspace.tsx`, `member-actions.ts`, `requireInfluencerWorkspace`, `isRateLimited`, `access.ts`, `member-operations/server.ts`, `revalidateCommunity`, `LandingScreen.tsx`, `login/route.ts`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `sheet.tsx`, `Composer.tsx`, `utils.ts`, `tabs.tsx`, `field.tsx`, `MemberList.tsx`, `ChannelsShell.tsx`, `toggle-group.tsx`, `combobox.tsx`, `dialog.tsx`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Composer.tsx` to `CommunityProvider.tsx`, `community-settings/model.ts`, `NotificationCenter.tsx`, `createClient`, `EmojiSection.tsx`, `community-settings/permissions.ts`, `AppShell.tsx`, `constants.ts`, `revalidateCommunity`, `ChannelsShell.tsx`, `login/route.ts`, `presence.ts`, `ChannelView.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _643 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AskStoicScreens.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11666666666666667 - nodes in this community are weakly interconnected._
- **Should `sections.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08970099667774087 - nodes in this community are weakly interconnected._
- **Should `community-settings/model.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08571428571428572 - nodes in this community are weakly interconnected._