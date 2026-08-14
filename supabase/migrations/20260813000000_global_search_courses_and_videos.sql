-- Search uses unanchored ILIKE, so published course and video catalogs need
-- trigram indexes alongside the legacy lesson/event/community indexes.
create index if not exists courses_title_trgm_idx on public.courses using gin (title gin_trgm_ops);
create index if not exists courses_description_trgm_idx on public.courses using gin (description gin_trgm_ops);
create index if not exists course_videos_title_trgm_idx on public.course_videos using gin (title gin_trgm_ops);
create index if not exists course_videos_description_trgm_idx on public.course_videos using gin (description gin_trgm_ops);
