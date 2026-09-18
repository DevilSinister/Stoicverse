/*
  What used to live here was a second, complete video player.

  `LegacyCourseVideoPlayer` was ~170 lines of the pre-Monolith design with no
  importer - eslint had been reporting it unused for long enough that the
  warning was part of the accepted baseline - and it carried its own playlist,
  progress bar and deprecated token call sites. The same shape as the dead
  dashboard phase 7 removed: a screen nobody could reach, inflating every count
  of how much of the product is still on the old design system.

  Deleted in phase 8. This module is now only the name `VideoPage` imports.
*/

export { LessonWorkspacePlayer as CourseVideoPlayer } from "./LessonWorkspacePlayer";
