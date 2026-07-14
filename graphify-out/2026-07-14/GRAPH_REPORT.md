# Graph Report - Ask_Stoic  (2026-07-14)

## Corpus Check
- 101 files · ~147,785 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 519 nodes · 638 edges · 56 communities (43 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b1a7ef0e`
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
- client.ts
- server.ts
- EventsView.tsx
- createClient
- rls.integration.mjs
- SECURITY_DEPLOYMENT.md
- README.md
- LearningPathView.tsx

## God Nodes (most connected - your core abstractions)
1. `Content safety` - 28 edges
2. `createClient()` - 26 edges
3. `requireActiveMembership()` - 19 edges
4. `compilerOptions` - 16 edges
5. `What You Must Do When Invoked` - 12 edges
6. `isRateLimited()` - 11 edges
7. `getSupabaseConfig()` - 11 edges
8. `/graphify` - 11 edges
9. `AppShell()` - 10 edges
10. `createAdminClient()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `copyResponseState()` --indirect_call--> `value()`  [INFERRED]
  proxy.ts → src/app/courses/actions.ts
- `proxy()` --calls--> `getSupabaseConfig()`  [EXTRACTED]
  proxy.ts → src/lib/supabase/env.ts
- `CoursesPage()` --calls--> `requireActiveMembership()`  [EXTRACTED]
  src/app/courses/page.tsx → src/lib/supabase/access.ts
- `DashboardPage()` --calls--> `requireActiveMembership()`  [EXTRACTED]
  src/app/dashboard/page.tsx → src/lib/supabase/access.ts
- `GET()` --calls--> `createClient()`  [EXTRACTED]
  src/app/api/dashboard/search/route.ts → src/lib/supabase/server.ts

## Import Cycles
- None detected.

## Communities (56 total, 13 thin omitted)

### Community 0 - "AskStoicScreens.tsx"
Cohesion: 0.08
Nodes (22): AdminPage(), CommunityPage(), LessonPage(), EventsPage(), MasterPage(), MentorshipPage(), CommitmentPage(), SubscriptionPage() (+14 more)

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
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+22 more)

### Community 5 - "claude-fable-5.md"
Cohesion: 0.07
Nodes (27): After search, Connector directory first, CRITICAL BROWSER STORAGE RESTRICTION, Data Scope, Design guidance, Do NOT use artifacts for, Error Handling, Explicit triggers (+19 more)

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
Cohesion: 0.08
Nodes (25): @base-ui/react, class-variance-authority, clsx, lucide-react, next, dependencies, @base-ui/react, class-variance-authority (+17 more)

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
Cohesion: 0.29
Nodes (6): Direction, Interaction and accessibility, Layout and components, Palette, Stoicverse Design System, Typography

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

### Community 39 - "client.ts"
Cohesion: 0.14
Nodes (14): authRoutes, config, copyResponseState(), isRouteMatch(), memberRoutes, proxy(), redirectWithState(), safeNextPath() (+6 more)

### Community 40 - "server.ts"
Cohesion: 0.12
Nodes (16): DashboardPage(), DashboardData, DashboardView(), Event, eventDate(), roleName(), AppShell(), AppShellProps (+8 more)

### Community 49 - "EventsView.tsx"
Cohesion: 0.14
Nodes (19): POST(), StripeEvent, verifiedEvent(), ActionResult, asTrimmedString(), createEvent(), enrollInEvent(), isApprovedZoomUrl() (+11 more)

### Community 50 - "createClient"
Cohesion: 0.19
Nodes (16): POST(), products, POST(), GET(), PATCH(), GET(), GET(), CheckoutPage() (+8 more)

### Community 54 - "LearningPathView.tsx"
Cohesion: 0.19
Nodes (12): ActionResult, addLesson(), isDriveFileId(), isUuid(), value(), CoursesPage(), FilterType, LearningPathData (+4 more)

## Knowledge Gaps
- **256 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+251 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `createClient` to `AskStoicScreens.tsx`, `EventsView.tsx`, `LearningPathView.tsx`, `client.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `getSupabaseConfig()` connect `client.ts` to `EventsView.tsx`, `createClient`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `requireActiveMembership()` connect `AskStoicScreens.tsx` to `server.ts`, `EventsView.tsx`, `createClient`, `LearningPathView.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _256 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AskStoicScreens.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08414634146341464 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `claude-fable-5.md` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._