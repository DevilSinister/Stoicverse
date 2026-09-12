-- AutoMod has no actor, and the audit table demanded one.
--
-- Phase 4 added `automod_block` to `community_moderation_events_action_check`
-- and made `community_mod_cases.actor_id` nullable on the stated principle
-- that "a case with no actor is not a case with a missing actor". It did not
-- carry that principle across to the audit table, so the first AutoMod event
-- phase 5 tried to record failed on a not-null violation. Caught by the
-- post-apply probe, before any code read it.
--
-- The alternative was to attribute the event to the influencer, which would
-- put a person's name against something no person did.

alter table public.community_moderation_events alter column actor_id drop not null;

comment on column public.community_moderation_events.actor_id is
  'The moderator who acted. Null when AutoMod did, matching community_mod_cases.actor_id.';

notify pgrst, 'reload schema';
