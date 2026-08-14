import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard search covers published courses and accessible released videos", async () => {
  const [route, shell, migration] = await Promise.all([
    read("src/app/api/dashboard/search/route.ts"),
    read("src/components/layout/AppShell.tsx"),
    read("supabase/migrations/20260813000000_global_search_courses_and_videos.sql"),
  ]);

  assert.match(route, /from\("courses"\).*eq\("status", "published"\)/);
  assert.match(route, /from\("course_videos"\)/);
  assert.match(route, /kind: "course"/);
  assert.match(route, /kind: "video"/);
  assert.match(route, /\/courses\/\$\{item\.course_id\}\/video\/\$\{item\.id\}/);
  assert.match(shell, /\{ kind: "course", label: "Courses" \}/);
  assert.match(shell, /\{ kind: "video", label: "Videos" \}/);
  assert.match(shell, /max-h-\[calc\(100svh-1rem\)\]/);
  assert.match(migration, /courses_title_trgm_idx/);
  assert.match(migration, /course_videos_title_trgm_idx/);
});
