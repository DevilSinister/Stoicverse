export type CourseCard = {
  id: string;
  title: string;
  description: string | null;
  rewardTier: number | null;
  isFinished: boolean;
  isCompleted: boolean;
  isEnrolled: boolean;
  enrollmentCount: number;
  videos: { id: string; title: string; durationSeconds: number; isOptional: boolean }[];
  progressPercent: number;
};

export { LearningPathCatalog as CourseCatalog } from "./LearningPathCatalog";
