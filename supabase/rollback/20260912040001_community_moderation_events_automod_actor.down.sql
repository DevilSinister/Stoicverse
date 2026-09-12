-- Rollback for 20260912040001.
--
-- Restores the NOT NULL on `community_moderation_events.actor_id`. **This
-- fails while any AutoMod-written event exists**, because those rows are
-- exactly the ones that have no actor; the delete below removes them first and
-- loses that audit history. Run only to undo a failed apply.

delete from public.community_moderation_events where actor_id is null;

alter table public.community_moderation_events alter column actor_id set not null;

comment on column public.community_moderation_events.actor_id is null;

notify pgrst, 'reload schema';
