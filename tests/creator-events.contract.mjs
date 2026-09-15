import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("creator events use lifecycle actions and do not send event email", () => {
  const actions = read("src/app/events/actions.ts");
  const creator = read("src/components/creator/CreatorEventsView.tsx");
  assert.match(actions, /saveCreatorEvent/);
  assert.match(actions, /cancelEvent/);
  assert.match(actions, /publishEvent/);
  assert.match(creator, /Save draft/i);
  assert.match(creator, /Publish event/i);
  assert.match(creator, /RSVP metrics/i);
  assert.doesNotMatch(actions, /sendTransactionalEmail/);
});

test("member event details stay separate from creator attendee metrics", () => {
  const member = read("src/components/events/EventsView.tsx");
  const creator = read("src/components/creator/CreatorEventsView.tsx");
  // Case-insensitive on purpose: the promise is that the member view names the
  // event's own details, not that the label is title-cased. Monolith phase 9
  // sentence-cased it, and an assertion pinned to the casing failed on a screen
  // that still keeps every promise this test exists to make.
  assert.match(member, /Event details/i);
  assert.match(member, /Masters/);
  assert.doesNotMatch(member, /MEMBERS ENROLLED/);
  assert.match(creator, /Members registered/i);
  assert.match(creator, /qualifiedAudienceCount/);
});

test("event migration keeps drafts private and masters tier-aware", () => {
  const migration = read("supabase/migrations/20260714030000_creator_event_management.sql");
  assert.match(migration, /'draft'/);
  assert.match(migration, /publish_now/);
  assert.match(migration, /membership\.status = 'active'/);
  assert.match(migration, /not profile\.is_suspended/);
  assert.match(migration, /save_creator_event/);
});
