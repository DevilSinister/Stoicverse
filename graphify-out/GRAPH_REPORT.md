# Graph Report - Ask_Stoic  (2026-07-11)

## Corpus Check
- 77 files · ~103,844 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 530 nodes · 570 edges · 49 communities (39 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

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

## God Nodes (most connected - your core abstractions)
1. `Content safety` - 28 edges
2. `compilerOptions` - 16 edges
3. `requireActiveMembership()` - 15 edges
4. `App Flow` - 15 edges
5. `createClient()` - 13 edges
6. `Technical Requirements Document (TRD)` - 13 edges
7. `Implementation Plan` - 13 edges
8. `What You Must Do When Invoked` - 12 edges
9. `4. Core Features` - 12 edges
10. `/graphify` - 11 edges

## Surprising Connections (you probably didn't know these)
- `proxy()` --calls--> `getSupabaseConfig()`  [EXTRACTED]
  proxy.ts → src/lib/supabase/env.ts
- `DashboardPage()` --calls--> `requireActiveMembership()`  [EXTRACTED]
  src/app/dashboard/page.tsx → src/lib/supabase/access.ts
- `AdminPage()` --calls--> `requirePlatformRole()`  [EXTRACTED]
  src/app/admin/page.tsx → src/lib/supabase/access.ts
- `PATCH()` --calls--> `createClient()`  [EXTRACTED]
  src/app/api/dashboard/notifications/route.ts → src/lib/supabase/server.ts
- `GET()` --calls--> `createClient()`  [EXTRACTED]
  src/app/api/dashboard/search/route.ts → src/lib/supabase/server.ts

## Import Cycles
- None detected.

## Communities (49 total, 10 thin omitted)

### Community 0 - "AskStoicScreens.tsx"
Cohesion: 0.10
Nodes (22): AdminPage(), CommunityPage(), LessonPage(), CreatorPage(), EventsPage(), MasterPage(), CommitmentPage(), SubscriptionPage() (+14 more)

### Community 1 - "Implementation Plan"
Cohesion: 0.05
Nodes (40): 1. Create Accounts (free or cheap tiers), 2. VPS Initial Setup (do this once via SSH), 3. Create Supabase Project, 4. Point Domain to VPS, Before You Start: One-Time Setup, Community Learning Platform, Cost Breakdown at Launch, Deployment Update Process (+32 more)

### Community 2 - "Database Schema"
Cohesion: 0.18
Nodes (10): Access And RLS, Core Tables, Database Schema, Identity And Roles, Lifecycle Automation, Migrations, Relationships, Scope (+2 more)

### Community 3 - "Technical Requirements Document (TRD)"
Cohesion: 0.06
Nodes (34): 10. Performance Targets, 11. Monitoring (Free/Cheap), 1. Tech Stack, 2. Hosting Architecture (Hostinger VPS), 3.1 Auth Settings, 3.2 Row Level Security (RLS), 3.3 Storage Buckets, 3.4 Edge Functions (+26 more)

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
Cohesion: 0.07
Nodes (26): 1. Overview, 2. Goals, 3.1 Super Admin (you), 3.2 Influencer, 3.3 Moderator, 3.4 Member, 3. User Roles, 4.10 Video Embedding (Google Drive) (+18 more)

### Community 8 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 9 - "devDependencies"
Cohesion: 0.08
Nodes (25): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+17 more)

### Community 10 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "dependencies"
Cohesion: 0.08
Nodes (25): @base-ui/react, class-variance-authority, clsx, lucide-react, next, dependencies, @base-ui/react, class-variance-authority (+17 more)

### Community 12 - "App Flow"
Cohesion: 0.12
Nodes (15): 10. Influencer Flow (Inline UI), 11. Super Admin Flow, 12. Notification Flow, 13. Page Map, 1. Public / Unauthenticated Flow, 2. Signup & Onboarding Flow, 3. Member Dashboard Flow, 4. Community (Channel) Flow (+7 more)

### Community 13 - "UI/UX Design System: Ask Stoic"
Cohesion: 0.20
Nodes (9): 1. Design Strategy & Vibe, 2. Color Palette, 3. Typography, 4. Layout & Rhythm, 5. Interaction & Motion, 6. Accessibility & UX Quality (CRITICAL), Anti-Patterns to Refuse & Avoid, Font Pairing (+1 more)

### Community 14 - "UI/UX Design System: Ask Stoic"
Cohesion: 0.20
Nodes (9): 1. Design Strategy & Vibe, 2. Color Palette, 3. Typography, 4. Layout & Rhythm, 5. Interaction & Motion, 6. Accessibility & UX Quality (CRITICAL), Anti-Patterns to Refuse & Avoid, Font Pairing (+1 more)

### Community 15 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 16 - "UI/UX Design System: Ask Stoic"
Cohesion: 0.22
Nodes (8): 1. Design Strategy & Vibe, 2. Color Palette, 3. Typography, 4. Layout & Rhythm, 5. Components, 6. Motion, 7. Accessibility, UI/UX Design System: Ask Stoic

### Community 17 - "Product"
Cohesion: 0.25
Nodes (7): Brand Personality, Design Principles, Explicit Non-Goals, Product Purpose, Scope, Stoicverse Product Context, Users

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
Cohesion: 0.10
Nodes (21): authRoutes, config, copyResponseState(), isRouteMatch(), memberRoutes, proxy(), redirectWithState(), safeNextPath() (+13 more)

### Community 40 - "server.ts"
Cohesion: 0.16
Nodes (11): DashboardPage(), DashboardData, DashboardView(), Event, eventDate(), Notification, roleName(), SearchResult (+3 more)

## Knowledge Gaps
- **311 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+306 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `client.ts` to `AskStoicScreens.tsx`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `Content safety` connect `Content safety` to `claude-fable-5.md`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _311 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AskStoicScreens.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10384068278805121 - nodes in this community are weakly interconnected._
- **Should `Implementation Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `Technical Requirements Document (TRD)` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._