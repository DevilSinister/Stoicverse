-- Global search matches with unanchored ILIKE ('%term%'), which no btree index can serve.
-- Every keystroke would otherwise sequentially scan lessons, events, posts, and profiles,
-- so the search modal degrades as the content library and community history grow.
create extension if not exists pg_trgm;

create index if not exists lessons_title_trgm_idx on public.lessons using gin (title gin_trgm_ops);
create index if not exists lessons_description_trgm_idx on public.lessons using gin (description gin_trgm_ops);
create index if not exists events_title_trgm_idx on public.events using gin (title gin_trgm_ops);
create index if not exists events_description_trgm_idx on public.events using gin (description gin_trgm_ops);
-- Partial, matching the search filter: soft-deleted posts are never searchable.
create index if not exists posts_body_trgm_idx on public.posts using gin (body gin_trgm_ops) where not is_deleted;
create index if not exists profiles_full_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);
