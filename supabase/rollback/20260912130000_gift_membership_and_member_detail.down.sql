-- Rollback for 20260912130000_gift_membership_and_member_detail.sql
--
-- Drops the two functions. **Memberships already gifted are not undone** — the
-- rows stay exactly as they are, `access_source = 'gifted'` and all, and the
-- people holding them keep their access. That is deliberate: taking somebody's
-- access away because a function was rolled back would be confiscating
-- something they were given, which is not what a rollback is for.
--
-- What breaks after this runs: the owner can no longer gift a membership, or
-- read a member's commercial detail from the community page. The Members
-- section of the settings area is unaffected — it never used either function.

begin;

drop function if exists public.community_gift_membership(uuid, integer, text);
drop function if exists public.community_member_detail(uuid);

notify pgrst, 'reload schema';

commit;
