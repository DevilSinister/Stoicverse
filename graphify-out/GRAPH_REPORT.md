# Graph Report - StoicWealthSociety  (2026-07-27)

## Corpus Check
- 184 files · ~193,127 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 853 nodes · 1397 edges · 74 communities (61 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b5b25151`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AskStoicScreens.tsx
- Implementation Plan
- Database Schema
- Technical Requirements Document (TRD)
- compilerOptions
- claude-fable-5.md
- Content safety
- 4. Core Features
- What You Must Do When Invoked
- devDependencies
- components.json
- dependencies
- App Flow
- UI/UX Design System: Ask Stoic
- UI/UX Design System: Ask Stoic
- graphify reference: extra exports and benchmark
- UI/UX Design System: Ask Stoic
- Product
- graphify reference: query, path, explain
- button.tsx
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- README.md
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- layout.tsx
- AGENTS.md
- CLAUDE.md
- CLAUDE.md
- extraction-spec.md
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- AppShell.tsx
- EventsView.tsx
- createClient
- rls.integration.mjs
- SECURITY_DEPLOYMENT.md
- README.md
- LearningPathView.tsx
- CommunitySurface.tsx
- courses/actions.ts
- CreatorOverviewView.tsx
- Influencer Implementation Plan
- DashboardView.tsx
- tiers/actions.ts
- CourseVideoPlayer.tsx
- CRITICAL BROWSER STORAGE RESTRICTION
- Do NOT use artifacts for
- Client screen inventory

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 46 edges
2. `requireInfluencerWorkspace()` - 38 edges
3. `requireActiveMembership()` - 34 edges
4. `Content safety` - 28 edges
5. `withRouteBase()` - 27 edges
6. `AppShell()` - 22 edges
7. `requireInfluencer()` - 21 edges
8. `compilerOptions` - 16 edges
9. `isRateLimited()` - 14 edges
10. `createAdminClient()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `copyResponseState()` --indirect_call--> `value()`  [INFERRED]
  proxy.ts → src/app/courses/actions.ts
- `safeNextPath()` --calls--> `safeNextPath()`  [EXTRACTED]
  proxy.ts → src/lib/security/safe-path.ts
- `proxy()` --calls--> `getSupabaseConfig()`  [EXTRACTED]
  proxy.ts → src/lib/supabase/env.ts
- `CreatorCourseManagerPageV2()` --calls--> `requireInfluencerWorkspace()`  [EXTRACTED]
  src/app/creator/courses/CreatorCourseManagerPageV2.tsx → src/lib/supabase/access.ts
- `Feed()` --indirect_call--> `text()`  [INFERRED]
  src/components/community/CommunitySurface.tsx → src/app/creator/tiers/actions.ts

## Import Cycles
- None detected.

## Communities (74 total, 13 thin omitted)

### Community 0 - "AskStoicScreens.tsx"
Cohesion: 0.05
Nodes (47): AdminPage(), LessonPage(), LessonPageOptions, renderLessonPage(), CreatorAnalyticsPage(), CreatorLessonPage(), CreatorEventsPage(), CreatorWorkspaceLayout() (+39 more)

### Community 1 - "Implementation Plan"
Cohesion: 0.18
Nodes (10): Access and data safety, Community and curriculum, Documentation maintenance rule, Existing extra or unapproved behaviour, Implementation Plan and Delivery Status, Implemented foundation, Must complete before MVP launch, Payments and account lifecycle (+2 more)

### Community 2 - "Database Schema"
Cohesion: 0.25
Nodes (7): Automation, Core records, Database Schema, Identity and access, Required RLS invariants, Scope, Stoicverse single-community model

### Community 3 - "Technical Requirements Document (TRD)"
Cohesion: 0.25
Nodes (7): Architecture, Data and authorization model, Explicitly absent today, Required service interfaces, Security and operational requirements, Stoicverse, Technical Requirements Document

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "claude-fable-5.md"
Cohesion: 0.11
Nodes (18): After search, Connector directory first, Data Scope, Design guidance, Error Handling, Explicit triggers, Key Design Pattern, Limitations (+10 more)

### Community 6 - "Content safety"
Cohesion: 0.07
Nodes (28): ask_user_input_v0, bash_tool, Content safety, conversation_search, create_file, Critical NEVER search for images in following categories (blocked):, Examples of when **NOT** to use image search:, fetch_sports_data (+20 more)

### Community 7 - "4. Core Features"
Cohesion: 0.25
Nodes (7): Non-goals and deferred behaviour, Product, Product Requirements Document, Required MVP behaviour, Stoicverse, Success criteria, Users and permissions

### Community 8 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 9 - "devDependencies"
Cohesion: 0.07
Nodes (26): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+18 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "dependencies"
Cohesion: 0.07
Nodes (27): @base-ui/react, class-variance-authority, clsx, lucide-react, next, dependencies, @base-ui/react, class-variance-authority (+19 more)

### Community 12 - "App Flow"
Cohesion: 0.29
Nodes (6): App Flow, Member journey, Notifications, Public and onboarding, Staff journey, Stoicverse single-community flow

### Community 13 - "UI/UX Design System: Ask Stoic"
Cohesion: 0.15
Nodes (12): Brand & Style, Buttons, Cards, Chips & Status Indicators, Colors, Components, Data Visualization, Elevation & Depth (+4 more)

### Community 14 - "UI/UX Design System: Ask Stoic"
Cohesion: 0.40
Nodes (4): Information design, Interaction, Responsive and accessible behaviour, UI/UX Standards

### Community 15 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 16 - "UI/UX Design System: Ask Stoic"
Cohesion: 0.20
Nodes (9): Direction, Interaction and accessibility, Layout and components, Mobile, Palette, Stoicverse Design System, Surfaces, Two-pane auth and checkout layout (+1 more)

### Community 17 - "Product"
Cohesion: 0.29
Nodes (6): Explicit non-goals, Principles, Product purpose, Scope, Stoicverse Product Context, Users

### Community 18 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 19 - "button.tsx"
Cohesion: 0.70
Nodes (3): Button(), buttonVariants, cn()

### Community 20 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 21 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 22 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 23 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 26 - "layout.tsx"
Cohesion: 0.40
Nodes (3): inter, jetbrainsMono, metadata

### Community 40 - "AppShell.tsx"
Cohesion: 0.09
Nodes (35): POST(), products, POST(), GET(), POST(), GET(), GET(), POST() (+27 more)

### Community 49 - "EventsView.tsx"
Cohesion: 0.09
Nodes (28): DashboardEventsPage(), ActionResult, cancelEvent(), enrollInEvent(), isApprovedZoomUrl(), isoDate(), publishEvent(), revalidateEvents() (+20 more)

### Community 50 - "createClient"
Cohesion: 0.06
Nodes (27): adminRoutes, authRoutes, config, copyResponseState(), creatorRoutes, isRouteMatch(), memberRoutes, proxy() (+19 more)

### Community 54 - "LearningPathView.tsx"
Cohesion: 0.13
Nodes (16): POST(), StripeEvent, verifiedEvent(), CourseEnrollment, CoursesPage(), CourseVideo, renderCoursesPage(), DashboardCoursesPage() (+8 more)

### Community 56 - "CommunitySurface.tsx"
Cohesion: 0.08
Nodes (42): access(), creatorSupabase(), deleteCommunityStructure(), refresh(), reorderCommunityStructure(), Result, Role, roles() (+34 more)

### Community 58 - "courses/actions.ts"
Cohesion: 0.17
Nodes (25): ActionResult, addCourseVideo(), addLesson(), createCourse(), deleteCourse(), deleteCourseVideo(), driveId(), finishCourse() (+17 more)

### Community 59 - "CreatorOverviewView.tsx"
Cohesion: 0.11
Nodes (13): CreatorDashboardPage(), CreatorOverviewView(), currency, delta(), eventTime(), FilterOption, isSameDay(), number (+5 more)

### Community 60 - "Influencer Implementation Plan"
Cohesion: 0.12
Nodes (15): 1. Permission model — two independent axes, 2.1 Home / Analytics, 2.2 Members, 2.3 Learning (Tiers), 2.4 Events, 2. Influencer Dashboard — surfaces, 3. Gifting membership — rules, 4. Membership lapse behavior (+7 more)

### Community 62 - "DashboardView.tsx"
Cohesion: 0.05
Nodes (53): DirectoryRow, Embedded, firstOf(), GET(), MemberRow, roleName(), SearchKind, SearchResult (+45 more)

### Community 65 - "tiers/actions.ts"
Cohesion: 0.32
Nodes (9): deleteTier(), refresh(), Result, saveTier(), text(), validate(), CreatorTiersPage(), CreatorTierManager() (+1 more)

### Community 67 - "CourseVideoPlayer.tsx"
Cohesion: 0.31
Nodes (7): formatDuration(), LegacyCourseVideoPlayer(), PlaylistVideo, formatDuration(), LessonWorkspacePlayer(), PlaylistVideo, QueueItem()

### Community 69 - "CRITICAL BROWSER STORAGE RESTRICTION"
Cohesion: 0.40
Nodes (5): CRITICAL BROWSER STORAGE RESTRICTION, Step 0 — Does the request need a visual at all?, Step 1 — Is a connected MCP tool a fit?, Step 2 — Did the person ask for a file?, Step 3 — Visualizer (default inline visual)

### Community 70 - "Do NOT use artifacts for"
Cohesion: 0.50
Nodes (4): Do NOT use artifacts for, HTML, Markdown, React

## Knowledge Gaps
- **334 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+329 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `AppShell.tsx` to `AskStoicScreens.tsx`, `EventsView.tsx`, `createClient`, `courses/actions.ts`, `DashboardView.tsx`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `AppShell()` connect `DashboardView.tsx` to `AskStoicScreens.tsx`, `tiers/actions.ts`, `EventsView.tsx`, `LearningPathView.tsx`, `CommunitySurface.tsx`, `courses/actions.ts`, `CreatorOverviewView.tsx`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `requireActiveMembership()` connect `AskStoicScreens.tsx` to `AppShell.tsx`, `EventsView.tsx`, `LearningPathView.tsx`, `CommunitySurface.tsx`, `DashboardView.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _334 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AskStoicScreens.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.053482221569203646 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `claude-fable-5.md` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._