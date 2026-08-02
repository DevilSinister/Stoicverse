# Graph Report - .  (2026-08-02)

## Corpus Check
- 244 files · ~197,209 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1013 nodes · 1563 edges · 123 communities (87 shown, 36 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- admin page tsx
- checkout route ts
- community actions ts
- courses actions ts
- proxy ts
- creator events page tsx
- deletion pending page tsx
- dom
- ask user input v0
- SKILL md
- creator dashboard page tsx
- components json
- claude fable 5 md
- PostComposer
- base ui react
- eslint
- notifications route ts
- CourseCatalogPage tsx
- influncer implementation md
- CourseDetailPage tsx
- app courses  id  video  videoId  page ts
- members actions ts
- Graphify
- 01 PRD md
- DESIGN md
- DashboardView tsx
- design md md
- 05 IMPLEMENTATION PLAN md
- search route ts
- package json
- 03 APP FLOW md
- exports md
- PRODUCT md
- 02 TRD md
- 04 DATABASE SCHEMA md
- CLIENT SCREEN INVENTORY md
- query md
- CRITICAL BROWSER STORAGE RESTRICTION
- app layout tsx
- button tsx
- rls integration mjs
- UI UX md
- Application Stack
- Atomic Progression
- Do NOT use artifacts for
- add watch md
- hooks md
- update md
- Gifted Membership
- README md
- Learning Path with Discord Sidebar
- Live Sessions with Discord Sidebar
- index ts
- Data Safety
- github and merge md
- transcribe md
- Stoic Methodology
- next config ts
- SECURITY DEPLOYMENT md
- Advanced Position Sizing Lesson with Dis
- Return to Silence Login
- Institutional Mentorship
- Learning Roadmap
- AskStoic Design System
- AGENTS md
- CLAUDE md
- claude CLAUDE md
- extraction spec md
- clsx
- Cairn Design System Reference
- eslint config mjs
- lucide react
- supabase ssr
- tailwind merge
- tw animate css
- postcss config mjs
- Premium Account Registration
- Billing Interval Toggle
- security README md
- Single community Model
- Next js Agent Rules
- File Icon
- Globe Icon
- Next js Logo
- Vercel Logo
- Window Icon
- Mobile Checkout Screen
- Desktop Dashboard with Discord Sidebar
- Mobile Member Dashboard
- Community Selection
- Sign up Form
- Subscription Commitment
- Super Admin Dashboard
- Video Lesson Player

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 52 edges
2. `requireInfluencerWorkspace()` - 33 edges
3. `requireActiveMembership()` - 29 edges
4. `Content safety` - 28 edges
5. `requireInfluencer()` - 25 edges
6. `AppShell()` - 24 edges
7. `withRouteBase()` - 22 edges
8. `isRateLimited()` - 17 edges
9. `compilerOptions` - 16 edges
10. `safeNextPath()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Cairn Design System Reference` --semantically_similar_to--> `Cairn Pricing Page Reference`  [INFERRED] [semantically similar]
  cover.webp → preview-desktop.png
- `Production Security Checklist` --conceptually_related_to--> `Membership Checkout Screen`  [INFERRED]
  SECURITY_DEPLOYMENT.md → stitch_screens/ask_stoic___checkout.html
- `Client Screen Inventory` --references--> `Desktop Checkout Screen`  [EXTRACTED]
  docs/CLIENT_SCREEN_INVENTORY.md → stitch_screens/ask_stoic___checkout_desktop.html
- `Client Screen Inventory` --references--> `Master Zone Community Feed`  [EXTRACTED]
  docs/CLIENT_SCREEN_INVENTORY.md → stitch_screens/ask_stoic___community_feed.html
- `Client Screen Inventory` --references--> `Desktop Member Dashboard`  [EXTRACTED]
  docs/CLIENT_SCREEN_INVENTORY.md → stitch_screens/ask_stoic___dashboard_desktop.html

## Import Cycles
- 2-file cycle: `src/components/dashboard/DashboardView.tsx -> src/components/dashboard/TerminalDashboard.tsx -> src/components/dashboard/DashboardView.tsx`
- 2-file cycle: `src/components/courses/CourseCatalog.tsx -> src/components/courses/LearningPathCatalog.tsx -> src/components/courses/CourseCatalog.tsx`

## Hyperedges (group relationships)
- **Member Value Flow** — 01_prd_membership_activation, 01_prd_curriculum_progression, 01_prd_mentorship [EXTRACTED 1.00]
- **Protected Access Model** — 04_database_schema_profiles, 04_database_schema_memberships, 04_database_schema_course_video_assets [EXTRACTED 1.00]
- **Checkout Screen Variants** — stitch_screens_ask_stoic___checkout_checkout_screen, stitch_screens_ask_stoic___checkout_desktop_checkout_desktop_screen, stitch_screens_ask_stoic___checkout_mobile_checkout_mobile_screen [INFERRED 0.85]
- **Dashboard Screen Variants** — stitch_screens_ask_stoic___dashboard_desktop_dashboard_desktop_screen, stitch_screens_ask_stoic___dashboard_desktop__discord_sidebar_dashboard_discord_sidebar_screen, stitch_screens_ask_stoic___dashboard_mobile_dashboard_mobile_screen [INFERRED 0.85]
- **Trading Education Learning Flow** — stitch_screens_ask_stoic___trading_education_platform_trading_education_platform, stitch_screens_ask_stoic___trading_education_platform_learning_roadmap, stitch_screens_ask_stoic___trading_education_platform_progression_model [EXTRACTED 1.00]

## Communities (123 total, 36 thin omitted)

### Community 0 - "admin page tsx"
Cohesion: 0.05
Nodes (44): AdminPage(), LessonPage(), LessonPageOptions, renderLessonPage(), CreatorAnalyticsPage(), CreatorLessonPage(), CreatorWorkspaceLayout(), CreatorMasterPage() (+36 more)

### Community 1 - "checkout route ts"
Cohesion: 0.06
Nodes (43): POST(), products, runtime, POST(), GET(), POST(), GET(), runtime (+35 more)

### Community 2 - "community actions ts"
Cohesion: 0.08
Nodes (44): createStaffPost(), deleteStaffPost(), editStaffPost(), Result, togglePostHighlight(), toggleReaction(), uuid(), access() (+36 more)

### Community 3 - "courses actions ts"
Cohesion: 0.11
Nodes (35): ActionResult, addCourseVideo(), addLesson(), createCourse(), deleteCourse(), deleteCourseVideo(), driveId(), enrollInCourse() (+27 more)

### Community 4 - "proxy ts"
Cohesion: 0.07
Nodes (28): adminRoutes, authRoutes, config, copyResponseState(), creatorRoutes, isRouteMatch(), memberRoutes, proxy() (+20 more)

### Community 5 - "creator events page tsx"
Cohesion: 0.09
Nodes (30): CreatorEventsPage(), DashboardEventsPage(), ActionResult, cancelEvent(), enrollInEvent(), isApprovedZoomUrl(), isoDate(), publishEvent() (+22 more)

### Community 6 - "deletion pending page tsx"
Cohesion: 0.14
Nodes (23): DeletionPendingPage(), authenticatedMember(), avatarTypes, cancelAccountDeletion(), EMPTY_SETTINGS_ACTION_STATE, logoutAction(), rateLimit(), removeAvatar() (+15 more)

### Community 7 - "dom"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 8 - "ask user input v0"
Cohesion: 0.07
Nodes (28): ask_user_input_v0, bash_tool, Content safety, conversation_search, create_file, Critical NEVER search for images in following categories (blocked):, Examples of when **NOT** to use image search:, fetch_sports_data (+20 more)

### Community 9 - "SKILL md"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 10 - "creator dashboard page tsx"
Cohesion: 0.11
Nodes (13): CreatorDashboardPage(), CreatorOverviewView(), currency, delta(), eventTime(), FilterOption, isSameDay(), number (+5 more)

### Community 11 - "components json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "claude fable 5 md"
Cohesion: 0.11
Nodes (18): After search, Connector directory first, Data Scope, Design guidance, Error Handling, Explicit triggers, Key Design Pattern, Limitations (+10 more)

### Community 13 - "PostComposer"
Cohesion: 0.15
Nodes (13): PostComposer(), AppShell(), AppShellProps, EMPTY_NOTIFICATIONS, eventDate(), Notification, NotificationResponse, roleName() (+5 more)

### Community 14 - "base ui react"
Cohesion: 0.12
Nodes (17): @base-ui/react, class-variance-authority, next, dependencies, @base-ui/react, class-variance-authority, next, react (+9 more)

### Community 15 - "eslint"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 16 - "notifications route ts"
Cohesion: 0.24
Nodes (13): GET(), FeedResponse, groupLabel(), iconFor(), NotificationCenter(), relativeTime, timeAgo(), views (+5 more)

### Community 17 - "CourseCatalogPage tsx"
Cohesion: 0.19
Nodes (11): CourseEnrollment, CoursesPage(), CourseVideo, renderCoursesPage(), DashboardCoursesPage(), CourseCard, CourseFilter, CourseRow() (+3 more)

### Community 18 - "influncer implementation md"
Cohesion: 0.12
Nodes (15): 1. Permission model — two independent axes, 2.1 Home / Analytics, 2.2 Members, 2.3 Learning (Tiers), 2.4 Events, 2. Influencer Dashboard — surfaces, 3. Gifting membership — rules, 4. Membership lapse behavior (+7 more)

### Community 19 - "CourseDetailPage tsx"
Cohesion: 0.21
Nodes (10): renderCourseDetailPage(), DashboardCoursePage(), FilterType, LearningPathData, LearningPathView(), LessonProgressItem, TierProgressItem, AppNavItem (+2 more)

### Community 20 - "app courses  id  video  videoId  page ts"
Cohesion: 0.21
Nodes (10): VideoPage(), renderVideoPage(), DashboardVideoPage(), formatDuration(), LegacyCourseVideoPlayer(), PlaylistVideo, formatDuration(), LessonWorkspacePlayer() (+2 more)

### Community 21 - "members actions ts"
Cohesion: 0.30
Nodes (12): color(), deleteCosmeticRole(), refresh(), Result, saveCosmeticRole(), setCosmeticRoleAssignment(), uuid(), value() (+4 more)

### Community 22 - "Graphify"
Cohesion: 0.14
Nodes (14): Graphify, Incremental Update, Graph Exports, Extraction Schema, Multi-repository Merge, Post-commit Rebuild, Graph Query, Transcription (+6 more)

### Community 23 - "01 PRD md"
Cohesion: 0.15
Nodes (12): Authorization Boundary, Creator Workspace, Curriculum Progression, Membership Activation, Mentorship, Non-goals and deferred behaviour, Product, Product Requirements Document (+4 more)

### Community 24 - "DESIGN md"
Cohesion: 0.15
Nodes (12): Accessible Interaction, Direction, Identity Command Center, Interaction and accessibility, Layout and components, Mobile, Notification Inbox, Palette (+4 more)

### Community 25 - "DashboardView tsx"
Cohesion: 0.21
Nodes (7): Event, eventDate(), LegacyDashboardView(), roleName(), TierProgressDetail, eventDate(), TerminalDashboard()

### Community 26 - "design md md"
Cohesion: 0.15
Nodes (12): Brand & Style, Buttons, Cards, Chips & Status Indicators, Colors, Components, Data Visualization, Elevation & Depth (+4 more)

### Community 27 - "05 IMPLEMENTATION PLAN md"
Cohesion: 0.18
Nodes (10): Access and data safety, Community and curriculum, Documentation maintenance rule, Existing extra or unapproved behaviour, Implementation Plan and Delivery Status, Implemented foundation, Must complete before MVP launch, Payments and account lifecycle (+2 more)

### Community 28 - "search route ts"
Cohesion: 0.25
Nodes (10): DirectoryRow, Embedded, firstOf(), GET(), MemberRow, roleName(), SearchKind, SearchResult (+2 more)

### Community 29 - "package json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, test:security (+1 more)

### Community 30 - "03 APP FLOW md"
Cohesion: 0.25
Nodes (8): App Flow, In-app Notifications, Member Journey, Notifications, Public and onboarding, Public Onboarding, Staff Journey, Stoicverse single-community flow

### Community 31 - "exports md"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 32 - "PRODUCT md"
Cohesion: 0.22
Nodes (8): Explicit non-goals, Global Roles, Principles, Product purpose, Scope, Stoicverse Product Context, Structured Learning Path, Users

### Community 33 - "02 TRD md"
Cohesion: 0.25
Nodes (7): Architecture, Data and authorization model, Explicitly absent today, Required service interfaces, Security and operational requirements, Stoicverse, Technical Requirements Document

### Community 34 - "04 DATABASE SCHEMA md"
Cohesion: 0.25
Nodes (7): Automation, Core records, Database Schema, Identity and access, Required RLS invariants, Scope, Stoicverse single-community model

### Community 35 - "CLIENT SCREEN INVENTORY md"
Cohesion: 0.29
Nodes (6): Client Screen Inventory, Notes, Desktop Checkout Screen, Master Zone Community Feed, Desktop Member Dashboard, Events Directory Screen

### Community 36 - "query md"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 37 - "CRITICAL BROWSER STORAGE RESTRICTION"
Cohesion: 0.40
Nodes (5): CRITICAL BROWSER STORAGE RESTRICTION, Step 0 — Does the request need a visual at all?, Step 1 — Is a connected MCP tool a fit?, Step 2 — Did the person ask for a file?, Step 3 — Visualizer (default inline visual)

### Community 38 - "app layout tsx"
Cohesion: 0.40
Nodes (3): inter, jetbrainsMono, metadata

### Community 39 - "button tsx"
Cohesion: 0.70
Nodes (3): Button(), buttonVariants, cn()

### Community 41 - "UI UX md"
Cohesion: 0.40
Nodes (4): Information design, Interaction, Responsive and accessible behaviour, UI/UX Standards

### Community 42 - "Application Stack"
Cohesion: 0.50
Nodes (4): Application Stack, Google Drive Preview, Row Level Security, Stripe Webhook

### Community 43 - "Atomic Progression"
Cohesion: 0.50
Nodes (4): Atomic Progression, Course Video Assets, Memberships, Profiles

### Community 44 - "Do NOT use artifacts for"
Cohesion: 0.50
Nodes (4): Do NOT use artifacts for, HTML, Markdown, React

### Community 45 - "add watch md"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 46 - "hooks md"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 47 - "update md"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 48 - "Gifted Membership"
Cohesion: 0.50
Nodes (4): Gifted Membership, Membership Lapse Preservation, Role and Tier Access Model, Influencer Dashboard Screen

### Community 49 - "README md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 50 - "Learning Path with Discord Sidebar"
Cohesion: 0.50
Nodes (4): Learning Path with Discord Sidebar, Learning Path, Learning Path Mobile, Member Dashboard

### Community 51 - "Live Sessions with Discord Sidebar"
Cohesion: 0.50
Nodes (4): Live Sessions with Discord Sidebar, Live Sessions, Live Sessions Mobile, Master Zone Dashboard

### Community 53 - "Data Safety"
Cohesion: 0.67
Nodes (3): Data Safety, MVP Launch Gaps, Payments and Account Lifecycle

### Community 56 - "Stoic Methodology"
Cohesion: 0.67
Nodes (3): Stoic Methodology, Stoic Landing Page Screen, Trading Learning Roadmap

### Community 59 - "Advanced Position Sizing Lesson with Dis"
Cohesion: 0.67
Nodes (3): Advanced Position Sizing Lesson with Discord Sidebar, Advanced Position Sizing Lesson, Lesson Page Mobile

### Community 60 - "Return to Silence Login"
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

## Knowledge Gaps
- **404 isolated node(s):** `graphify`, `Usage`, `What graphify is for`, `Step 0 - GitHub repos and multi-path merge (only if a URL or several paths)`, `Step 1 - Ensure graphify is installed` (+399 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `checkout route ts` to `admin page tsx`, `community actions ts`, `courses actions ts`, `proxy ts`, `creator events page tsx`, `deletion pending page tsx`, `notifications route ts`, `search route ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `AppShell()` connect `PostComposer` to `admin page tsx`, `community actions ts`, `courses actions ts`, `creator events page tsx`, `creator dashboard page tsx`, `notifications route ts`, `CourseCatalogPage tsx`, `CourseDetailPage tsx`, `app courses  id  video  videoId  page ts`, `members actions ts`, `DashboardView tsx`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `withRouteBase()` connect `CourseDetailPage tsx` to `admin page tsx`, `PostComposer`, `CourseCatalogPage tsx`, `app courses  id  video  videoId  page ts`, `DashboardView tsx`, `search route ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `graphify`, `Usage`, `What graphify is for` to the rest of the system?**
  _404 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admin page tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05368382080710848 - nodes in this community are weakly interconnected._
- **Should `checkout route ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05789235639981909 - nodes in this community are weakly interconnected._
- **Should `community actions ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08470588235294117 - nodes in this community are weakly interconnected._