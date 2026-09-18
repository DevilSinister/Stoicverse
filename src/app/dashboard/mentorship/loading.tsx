import { CardGridSkeleton } from "@/components/layout/Skeletons";

/* A loading boundary is a prefetching primitive, not a courtesy: a dynamic
   route without one is not prefetched at all. See lesson 83. */
export default function Loading() {
  return <CardGridSkeleton label="Loading mentorship" />;
}
