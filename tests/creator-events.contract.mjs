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
  assert.match(creator, /Save draft/);
  assert.match(creator, /Publish now/);
  assert.match(creator, /RSVP metrics/);
  assert.doesNotMatch(actions, /sendTransactionalEmail/);
});

test("member event details stay separate from creator attendee metrics", () => {
  const member = read("src/components/events/EventsView.tsx");
  const creator = read("src/components/creator/CreatorEventsView.tsx");
  assert.match(member, /EVENT DETAILS/);
  assert.match(member, /Masters/);
  assert.doesNotMatch(member, /MEMBERS ENROLLED/);
  assert.match(creator, /MEMBERS ENROLLED/);
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
