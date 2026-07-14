"use client";

import { useState, useTransition, useEffect } from "react";
import { 
  addCourseVideo, 
  createCourse, 
  finishCourse, 
  updateCourse, 
  updateCourseVideo, 
  reorderCourseVideos,
  deleteCourse,
  deleteCourseVideo,
  type ActionResult 
} from "@/app/courses/actions";
import { AppShell } from "@/components/layout/AppShell";
import { 
  ArrowLeft, Plus, Edit, Clock, Video, Lock, Layers, 
  CheckCircle2, X, AlertCircle, LoaderCircle, Eye, Archive, CheckCircle,
  GripVertical, ChevronDown, Trash2, AlertTriangle
} from "lucide-react";

type ManagedVideo = { 
  id: string; 
  course_id: string; 
  title: string; 
  description: string | null; 
  duration_seconds: number; 
  sort_order: number; 
  is_optional: boolean; 
  release_at: string | null; 
};

export type ManagedCourse = { 
  id: string; 
  title: string; 
  description: string | null; 
  min_tier: number; 
  completion_tier: number | null; 
  status: string; 
  is_finished: boolean; 
  finished_at: string | null; 
  prerequisiteIds: string[]; 
  videos: ManagedVideo[]; 
};

const toLocalDatetimeLocal = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
};

const inputClass = "w-full h-11 px-5 rounded-full border border-surgical-steel bg-surface-container-low/40 text-sm text-white placeholder-fog-muted outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all";
const textareaClass = "w-full px-5 py-3 rounded-2xl border border-surgical-steel bg-surface-container-low/40 text-sm text-white placeholder-fog-muted outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all resize-none";

/* ================= CUSTOM SELECT POP-OVER COMPONENT ================= */
function CustomSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string | number;
  onChange: (val: any) => void;
  options: { value: string | number; label: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative space-y-1">
      <span className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 px-5 rounded-full border border-surgical-steel bg-surface-container-low/40 text-sm text-white flex items-center justify-between hover:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container transition-all cursor-pointer select-none"
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown size={15} className={`text-fog-muted transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-full z-50 rounded-2xl border border-surgical-steel bg-[#16181A] shadow-2xl overflow-hidden py-1 divide-y divide-surgical-steel/20">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-5 py-3 text-xs uppercase tracking-wider font-label transition-colors cursor-pointer hover:bg-primary-container/10 hover:text-white ${value === opt.value ? "text-primary-container font-semibold bg-primary-container/5" : "text-fog-muted"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function CreatorCourseManagerV2({ 
  courses, 
  memberName, 
  currentTier, 
  isMaster 
}: { 
  courses: ManagedCourse[]; 
  memberName: string; 
  currentTier: number; 
  isMaster: boolean; 
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  
  // Drag and Drop ordering state
  const [videoList, setVideoList] = useState<ManagedVideo[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Modal states
  const [activeModal, setActiveModal] = useState<'create-course' | 'edit-course' | 'add-video' | 'edit-video' | null>(null);
  const [editingVideo, setEditingVideo] = useState<ManagedVideo | null>(null);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Synchronize local video list for reordering
  useEffect(() => {
    if (selectedCourse) {
      setVideoList([...selectedCourse.videos].sort((a, b) => a.sort_order - b.sort_order));
    } else {
      setVideoList([]);
    }
  }, [selectedCourseId, courses]);

  const runFormAction = (
    action: (data: FormData) => Promise<ActionResult>, 
    onSuccess?: () => void
  ) => {
    return (data: FormData) => {
      setModalError(null);
      startTransition(async () => {
        const res = await action(data);
        if (res.error) {
          setModalError(res.error);
        } else {
          setMessage("Saved successfully.");
          setActiveModal(null);
          setEditingVideo(null);
          if (onSuccess) onSuccess();
        }
      });
    };
  };

  const handleFinishCourse = (courseId: string) => {
    setMessage(null);
    startTransition(async () => {
      const res = await finishCourse(courseId);
      if (res.error) {
        setMessage(res.error);
      } else {
        setMessage("Course finalized and published.");
      }
    });
  };

  const handleDeleteCourse = (courseId: string) => {
    setModalError(null);
    startTransition(async () => {
      const res = await deleteCourse(courseId);
      if (res.error) {
        setModalError(res.error);
      } else {
        setMessage("Course deleted successfully.");
        setActiveModal(null);
        setSelectedCourseId(null);
      }
    });
  };

  const handleDeleteVideo = (videoId: string) => {
    setModalError(null);
    startTransition(async () => {
      const res = await deleteCourseVideo(videoId);
      if (res.error) {
        setModalError(res.error);
      } else {
        setMessage("Video deleted successfully.");
        setActiveModal(null);
        setEditingVideo(null);
      }
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDragEnter = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const newList = [...videoList];
    const draggedItem = newList[draggedIndex];
    newList.splice(draggedIndex, 1);
    newList.splice(targetIndex, 0, draggedItem);
    setDraggedIndex(targetIndex);
    setVideoList(newList);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    const videoIds = videoList.map(v => v.id);
    startTransition(async () => {
      const res = await reorderCourseVideos(videoIds);
      if (res.error) {
        setMessage(res.error);
      } else {
        setMessage("Video order updated successfully.");
      }
    });
  };

  return (
    <AppShell 
      active="Learning" 
      title="Course studio" 
      memberName={memberName} 
      platformRole="influencer" 
      currentTier={currentTier} 
      isMaster={isMaster} 
      routeBase="/creator"
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
        
        {/* Banner Messages */}
        {message && (
          <div role="status" className="flex items-center justify-between gap-4 border border-primary-container/20 bg-primary-container/10 p-4 rounded-xl text-sm text-white animate-fade-in-up">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-primary-container shrink-0" size={16} />
              <span>{message}</span>
            </div>
            <button className="text-xs font-label uppercase text-fog-muted hover:text-white transition-colors cursor-pointer" onClick={() => setMessage(null)}>
              Dismiss
            </button>
          </div>
        )}

        {!selectedCourseId ? (
          /* ================= CATALOG / TILES VIEW ================= */
          <div className="space-y-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-surgical-steel pb-6">
              <div>
                <p className="font-label text-xs uppercase tracking-[.16em] text-primary-container">Influencer curriculum</p>
                <h1 className="mt-2 font-sans text-3xl font-extrabold text-white tracking-tight">Create and release courses</h1>
                <p className="mt-2 text-sm text-fog-muted max-w-2xl">
                  Configure access, release videos over time, and publish finished courses to the member curriculum.
                </p>
              </div>
              <button 
                onClick={() => {
                  setModalError(null);
                  setActiveModal('create-course');
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-container px-6 font-label text-xs font-bold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer shadow-md"
              >
                <Plus size={16} /> Create Course
              </button>
            </header>

            {courses.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-surgical-steel rounded-2xl bg-surface-container-low/5">
                <Video size={48} className="mx-auto text-fog-muted mb-4 opacity-40" />
                <h2 className="font-sans text-lg font-bold text-white">No courses created yet</h2>
                <p className="text-sm text-fog-muted mt-1 max-w-md mx-auto">Get started by creating your first course and defining its minimum access tier.</p>
                <button 
                  onClick={() => {
                    setModalError(null);
                    setActiveModal('create-course');
                  }}
                  className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-primary-container px-5 font-label text-xs font-bold uppercase tracking-wider text-primary-container hover:bg-primary-container/10 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Plus size={14} /> Add First Course
                </button>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map(course => (
                  <article 
                    key={course.id} 
                    onClick={() => setSelectedCourseId(course.id)}
                    className="group relative flex flex-col justify-between p-6 rounded-2xl border border-surgical-steel bg-monolith-surface hover:border-primary-container/40 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg"
                  >
                    <div className="space-y-4">
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-label text-[10px] uppercase font-bold border border-primary-container/30 bg-primary-container/10 text-primary-container">
                          Tier 0{course.min_tier}
                        </span>
                        <div className="flex gap-2">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded font-label text-[9px] uppercase font-bold ${course.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            {course.status}
                          </span>
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded font-label text-[9px] uppercase font-bold ${course.is_finished ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                            {course.is_finished ? "Finished" : "Draft"}
                          </span>
                        </div>
                      </div>

                      {/* Course Title and Description */}
                      <div className="space-y-2">
                        <h2 className="font-sans text-xl font-bold text-white group-hover:text-primary-container transition-colors line-clamp-1">
                          {course.title}
                        </h2>
                        <p className="font-body text-xs text-fog-muted line-clamp-3 leading-relaxed">
                          {course.description || "No description provided."}
                        </p>
                      </div>
                    </div>

                    {/* Footer Row */}
                    <div className="mt-6 pt-4 border-t border-surgical-steel/40 flex items-center justify-between text-xs text-fog-muted font-label">
                      <span className="flex items-center gap-1.5">
                        <Video size={13} className="text-primary-container" />
                        {course.videos.length} {course.videos.length === 1 ? "Video" : "Videos"}
                      </span>
                      {course.prerequisiteIds.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Layers size={13} />
                          {course.prerequisiteIds.length} {course.prerequisiteIds.length === 1 ? "Prereq" : "Prereqs"}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ================= DETAILED COURSE VIEW ================= */
          selectedCourse && (
            <div className="space-y-8 animate-fade-in-up">
              {/* Back Link */}
              <button 
                onClick={() => setSelectedCourseId(null)}
                className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-wider text-fog-muted hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Courses
              </button>

              {/* Course Detail Card */}
              <article className="rounded-2xl border border-surgical-steel bg-monolith-surface p-6 md:p-8 space-y-6">
                {/* Meta details row */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-full font-label text-xs uppercase font-bold border border-primary-container/30 bg-primary-container/10 text-primary-container">
                      Tier 0{selectedCourse.min_tier} Access
                    </span>
                    {selectedCourse.completion_tier && (
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full font-label text-xs uppercase font-bold border border-surgical-steel bg-surface-container-high text-fog-muted">
                        Reward: Tier 0{selectedCourse.completion_tier}
                      </span>
                    )}
                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded font-label text-xs uppercase font-bold ${selectedCourse.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {selectedCourse.status}
                    </span>
                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded font-label text-xs uppercase font-bold ${selectedCourse.is_finished ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                      {selectedCourse.is_finished ? "Finished & Locked" : "In Production"}
                    </span>
                  </div>

                  {/* Finish Course Action */}
                  {!selectedCourse.is_finished && (
                    <button 
                      disabled={pending}
                      onClick={() => handleFinishCourse(selectedCourse.id)}
                      className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary-container px-5 font-label text-xs font-bold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                    >
                      {pending ? <LoaderCircle size={14} className="animate-spin" /> : "Finish Course"}
                    </button>
                  )}
                </div>

                {/* Course Main Details */}
                <div className="space-y-4">
                  <h1 className="font-sans text-3xl font-extrabold text-white tracking-tight">{selectedCourse.title}</h1>
                  <p className="font-body text-base text-on-surface-variant leading-relaxed max-w-3xl">
                    {selectedCourse.description || "No description provided."}
                  </p>
                </div>

                {/* Prerequisites metadata */}
                {selectedCourse.prerequisiteIds.length > 0 && (
                  <div className="pt-4 border-t border-surgical-steel/40">
                    <h3 className="font-label text-xs uppercase tracking-wider text-fog-muted mb-2">Required Prerequisites</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCourse.prerequisiteIds.map(prereqId => {
                        const prereq = courses.find(c => c.id === prereqId);
                        return (
                          <span key={prereqId} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-surgical-steel bg-surface-container-high/40 text-xs text-white">
                            <Layers size={11} className="text-primary-container shrink-0" />
                            {prereq?.title || "Unknown Course"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Rules Row */}
                <div className="pt-6 border-t border-surgical-steel/40 flex flex-wrap gap-3">
                  <button 
                    onClick={() => {
                      setModalError(null);
                      setActiveModal('edit-course');
                    }}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-surgical-steel bg-surface-container-low/20 px-5 font-label text-xs font-bold uppercase tracking-wider text-white hover:border-primary-container hover:text-primary-container transition-colors cursor-pointer"
                  >
                    <Edit size={14} /> Edit Course Details
                  </button>
                  <button 
                    onClick={() => {
                      setModalError(null);
                      setActiveModal('add-video');
                    }}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-primary-container bg-primary-container/10 px-5 font-label text-xs font-bold uppercase tracking-wider text-primary-container hover:bg-primary-container hover:text-on-primary-fixed transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Add Video
                  </button>
                </div>
              </article>

              {/* Videos List Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-surgical-steel/60 pb-3">
                  <div>
                    <h2 className="font-sans text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Video size={18} className="text-primary-container" />
                      Videos ({selectedCourse.videos.length})
                    </h2>
                    {selectedCourse.videos.length > 1 && (
                      <p className="text-xs text-fog-muted mt-1">Drag the grab handle <GripVertical className="inline" size={12} /> to reorder videos.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {videoList.map((video, idx) => (
                    <div 
                      key={video.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnter={() => handleDragEnter(idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-surgical-steel bg-monolith-surface transition-all duration-150 shadow-sm ${draggedIndex === idx ? "opacity-40 border-primary-container/50 bg-[#16181A]" : "hover:border-primary-container/30"}`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing text-fog-muted hover:text-white p-1 rounded transition-colors shrink-0">
                          <GripVertical size={16} />
                        </div>
                        
                        <span className="font-mono text-sm text-fog-muted pt-0.5 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                        
                        <div className="space-y-1 min-w-0">
                          <h4 className="font-sans text-base font-bold text-white flex flex-wrap items-center gap-2 truncate">
                            {video.title}
                            {video.is_optional && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded border border-surgical-steel bg-surface-container-low text-[9px] font-bold uppercase tracking-wider text-fog-muted shrink-0">
                                Optional
                              </span>
                            )}
                          </h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fog-muted">
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock size={12} />
                              {Math.round(video.duration_seconds / 60)} min ({video.duration_seconds}s)
                            </span>
                            <span>Order: {video.sort_order}</span>
                            {video.release_at && (
                              <span className="truncate">Releases: {new Date(video.release_at).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setModalError(null);
                          setEditingVideo(video);
                          setActiveModal('edit-video');
                        }}
                        className="self-end sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-surgical-steel text-xs font-bold text-fog-muted hover:text-white hover:border-primary-container transition-colors cursor-pointer shrink-0"
                      >
                        <Edit size={12} /> Edit Video
                      </button>
                    </div>
                  ))}

                  {videoList.length === 0 && (
                    <div className="text-center py-16 border border-dashed border-surgical-steel rounded-xl bg-surface-container-low/5">
                      <Video size={36} className="mx-auto text-fog-muted mb-3 opacity-40" />
                      <p className="text-sm font-semibold text-white">No videos added to this course</p>
                      <p className="text-xs text-fog-muted mt-1 max-w-xs mx-auto">Build out this course curriculum by uploading Google Drive videos.</p>
                      <button 
                        onClick={() => {
                          setModalError(null);
                          setActiveModal('add-video');
                        }}
                        className="mt-4 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-primary-container px-4 font-label text-xs font-bold uppercase tracking-wider text-primary-container hover:bg-primary-container/10 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Plus size={12} /> Add First Video
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )
        )}
      </div>

      {/* ================= MODAL WINDOWS ================= */}

      {/* 1. Create Course Modal */}
      {activeModal === 'create-course' && (
        <Modal title="Create Course" onClose={() => setActiveModal(null)}>
          <CourseCreateForm 
            courses={courses}
            action={runFormAction(createCourse)}
            pending={pending}
            modalError={modalError}
            onClose={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {/* 2. Edit Course Modal */}
      {activeModal === 'edit-course' && selectedCourse && (
        <Modal title="Edit Course Details" onClose={() => setActiveModal(null)}>
          <CourseEditForm 
            courses={courses}
            course={selectedCourse}
            action={runFormAction(updateCourse)}
            pending={pending}
            modalError={modalError}
            onClose={() => setActiveModal(null)}
            onDelete={handleDeleteCourse}
          />
        </Modal>
      )}

      {/* 3. Add Video Modal */}
      {activeModal === 'add-video' && selectedCourse && (
        <Modal title={`Add Video to: ${selectedCourse.title}`} onClose={() => setActiveModal(null)}>
          <VideoAddForm 
            courseId={selectedCourse.id}
            action={runFormAction(addCourseVideo)}
            pending={pending}
            modalError={modalError}
            onClose={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {/* 4. Edit Video Modal */}
      {activeModal === 'edit-video' && editingVideo && (
        <Modal title="Edit Video Details" onClose={() => setActiveModal(null)}>
          <VideoEditForm 
            video={editingVideo}
            action={runFormAction(updateCourseVideo)}
            pending={pending}
            modalError={modalError}
            onClose={() => setActiveModal(null)}
            onDelete={handleDeleteVideo}
          />
        </Modal>
      )}
    </AppShell>
  );
}

/* ================= MODAL SHELL COMPONENT ================= */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto border border-surgical-steel bg-monolith-surface p-6 rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between border-b border-surgical-steel pb-4">
          <h2 className="font-sans text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 text-on-surface-variant hover:text-primary-container transition cursor-pointer" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ================= COURSE CREATE FORM SUB-COMPONENT ================= */
function CourseCreateForm({
  courses,
  action,
  pending,
  modalError,
  onClose
}: {
  courses: ManagedCourse[];
  action: (data: FormData) => void;
  pending: boolean;
  modalError: string | null;
  onClose: () => void;
}) {
  const [minTier, setMinTier] = useState<number>(1);
  const [rewardTier, setRewardTier] = useState<number>(2);
  const [status, setStatus] = useState<string>("draft");
  const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>([]);

  const togglePrereq = (id: string) => {
    setSelectedPrereqs(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <form action={action} className="space-y-4">
      {modalError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{modalError}</span>
        </div>
      )}
      
      <input type="hidden" name="minTier" value={minTier} />
      <input type="hidden" name="rewardTier" value={rewardTier} />
      <input type="hidden" name="status" value={status} />
      {selectedPrereqs.map(id => (
        <input key={id} type="hidden" name="prerequisiteIds" value={id} />
      ))}

      <div className="space-y-1">
        <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Title</label>
        <input className={inputClass} name="title" placeholder="e.g. Introduction to Stoic Ethics" required />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Description</label>
        <textarea className={`${textareaClass} h-28`} name="description" placeholder="Summarize course milestones and learnings..." />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CustomSelect 
          label="Min Access Tier"
          value={minTier}
          onChange={(val) => setMinTier(Number(val))}
          options={[1, 2, 3, 4, 5].map(t => ({ value: t, label: `Tier 0${t}` }))}
        />
        <CustomSelect 
          label="Completion Reward"
          value={rewardTier}
          onChange={(val) => setRewardTier(Number(val))}
          options={[1, 2, 3, 4, 5].map(t => ({ value: t, label: `Raise to Tier 0${t}` }))}
        />
        <CustomSelect 
          label="Publish State"
          value={status}
          onChange={(val) => setStatus(String(val))}
          options={[
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" }
          ]}
        />
      </div>

      {/* Prerequisites Field */}
      <div className="space-y-2 pt-2 border-t border-surgical-steel/40">
        <span className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Required Prerequisites</span>
        <div className="grid gap-2 sm:grid-cols-2 max-h-40 overflow-y-auto pr-1">
          {courses.map(item => {
            const isSelected = selectedPrereqs.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => togglePrereq(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-label uppercase tracking-wider transition-all duration-200 cursor-pointer text-left ${isSelected ? "border-primary-container bg-primary-container/10 text-white" : "border-surgical-steel bg-surface-container-low/20 text-fog-muted hover:border-white/20 hover:text-white"}`}
              >
                <span className="truncate pr-2">{item.title}</span>
                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${isSelected ? "border-primary-container bg-primary-container text-on-primary-fixed" : "border-surgical-steel bg-transparent"}`}>
                  {isSelected && <CheckCircle size={10} className="stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
        {courses.length === 0 && (
          <p className="text-xs text-fog-muted italic">No other courses available.</p>
        )}
      </div>

      <div className="pt-4 flex items-center justify-end gap-3 border-t border-surgical-steel">
        <button type="button" onClick={onClose} className="min-h-10 px-4 font-label text-xs font-bold uppercase tracking-wider text-fog-muted hover:text-white transition-colors cursor-pointer">
          Cancel
        </button>
        <button disabled={pending} type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary-container px-6 font-label text-xs font-bold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 disabled:opacity-60 transition-all cursor-pointer">
          {pending ? <LoaderCircle size={14} className="animate-spin" /> : "Create Course"}
        </button>
      </div>
    </form>
  );
}

/* ================= COURSE EDIT FORM SUB-COMPONENT ================= */
function CourseEditForm({
  courses,
  course,
  action,
  pending,
  modalError,
  onClose,
  onDelete
}: {
  courses: ManagedCourse[];
  course: ManagedCourse;
  action: (data: FormData) => void;
  pending: boolean;
  modalError: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [minTier, setMinTier] = useState<number>(course.min_tier);
  const [rewardTier, setRewardTier] = useState<number>(course.completion_tier || 2);
  const [status, setStatus] = useState<string>(course.status);
  const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>(course.prerequisiteIds);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const togglePrereq = (id: string) => {
    setSelectedPrereqs(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (showDeleteConfirm) {
    return (
      <div className="space-y-6 py-4 animate-fade-in">
        <div className="flex items-start gap-4 p-4 border border-red-500/20 bg-red-500/10 rounded-2xl">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <h4 className="font-sans font-bold text-white text-base">Delete course: {course.title}?</h4>
            <p className="text-sm text-red-200">
              This will permanently delete the course, all of its video settings, and unlock prerequisite dependencies for other courses.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surgical-steel">
          <button 
            type="button" 
            onClick={() => setShowDeleteConfirm(false)}
            className="min-h-10 px-4 font-label text-xs font-bold uppercase tracking-wider text-fog-muted hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            disabled={pending}
            onClick={() => onDelete(course.id)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-red-500/25 border border-red-500/50 hover:bg-red-500/40 text-red-300 px-6 font-label text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : <><Trash2 size={14} /> Confirm Delete</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {modalError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{modalError}</span>
        </div>
      )}
      
      <input type="hidden" name="courseId" value={course.id} />
      <input type="hidden" name="minTier" value={minTier} />
      <input type="hidden" name="rewardTier" value={rewardTier} />
      <input type="hidden" name="status" value={status} />
      {selectedPrereqs.map(id => (
        <input key={id} type="hidden" name="prerequisiteIds" value={id} />
      ))}

      <div className="space-y-1">
        <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Title</label>
        <input className={inputClass} name="title" defaultValue={course.title} required />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Description</label>
        <textarea className={`${textareaClass} h-28`} name="description" defaultValue={course.description ?? ""} placeholder="Summarize course milestones and learnings..." />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CustomSelect 
          label="Min Access Tier"
          value={minTier}
          onChange={(val) => setMinTier(Number(val))}
          options={[1, 2, 3, 4, 5].map(t => ({ value: t, label: `Tier 0${t}` }))}
        />
        <CustomSelect 
          label="Completion Reward"
          value={rewardTier}
          onChange={(val) => setRewardTier(Number(val))}
          options={[1, 2, 3, 4, 5].map(t => ({ value: t, label: `Raise to Tier 0${t}` }))}
        />
        <CustomSelect 
          label="Publish State"
          value={status}
          onChange={(val) => setStatus(String(val))}
          options={[
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
            { value: "archived", label: "Archived" }
          ]}
        />
      </div>

      {/* Prerequisites Field */}
      <div className="space-y-2 pt-2 border-t border-surgical-steel/40">
        <span className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Required Prerequisites</span>
        <div className="grid gap-2 sm:grid-cols-2 max-h-40 overflow-y-auto pr-1">
          {courses.filter(item => item.id !== course.id).map(item => {
            const isSelected = selectedPrereqs.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => togglePrereq(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-label uppercase tracking-wider transition-all duration-200 cursor-pointer text-left ${isSelected ? "border-primary-container bg-primary-container/10 text-white" : "border-surgical-steel bg-surface-container-low/20 text-fog-muted hover:border-white/20 hover:text-white"}`}
              >
                <span className="truncate pr-2">{item.title}</span>
                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${isSelected ? "border-primary-container bg-primary-container text-on-primary-fixed" : "border-surgical-steel bg-transparent"}`}>
                  {isSelected && <CheckCircle size={10} className="stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
        {courses.filter(item => item.id !== course.id).length === 0 && (
          <p className="text-xs text-fog-muted italic">No other courses available.</p>
        )}
      </div>

      <div className="pt-6 border-t border-surgical-steel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Delete Trigger */}
        <button 
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-500/30 hover:border-red-500 text-red-400 px-5 font-label text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          <Trash2 size={14} /> Delete Course
        </button>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="min-h-10 px-4 font-label text-xs font-bold uppercase tracking-wider text-fog-muted hover:text-white transition-colors cursor-pointer">
            Cancel
          </button>
          <button disabled={pending} type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary-container px-6 font-label text-xs font-bold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 disabled:opacity-60 transition-all cursor-pointer">
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ================= VIDEO ADD FORM SUB-COMPONENT ================= */
function VideoAddForm({
  courseId,
  action,
  pending,
  modalError,
  onClose
}: {
  courseId: string;
  action: (data: FormData) => void;
  pending: boolean;
  modalError: string | null;
  onClose: () => void;
}) {
  const [isOptional, setIsOptional] = useState<string>("false");

  return (
    <form action={action} className="space-y-4">
      {modalError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{modalError}</span>
        </div>
      )}
      
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="isOptional" value={isOptional === "true" ? "on" : ""} />

      <div className="space-y-1">
        <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Video Title</label>
        <input className={inputClass} name="title" placeholder="e.g. Session 1: The Dichotomy of Control" required />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Google Drive File ID</label>
        <input className={inputClass} name="videoFileId" placeholder="Enter secure Google Drive file ID (e.g. 1aBcDeFgHiJkLmNoP)" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CustomSelect 
          label="Requirement"
          value={isOptional}
          onChange={(val) => setIsOptional(String(val))}
          options={[
            { value: "false", label: "Required" },
            { value: "true", label: "Optional" }
          ]}
        />

        <div className="space-y-1">
          <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Release At (Optional)</label>
          <input className={inputClass} type="datetime-local" name="releaseAt" />
        </div>
      </div>

      <div className="pt-4 flex items-center justify-end gap-3 border-t border-surgical-steel">
        <button type="button" onClick={onClose} className="min-h-10 px-4 font-label text-xs font-bold uppercase tracking-wider text-fog-muted hover:text-white transition-colors cursor-pointer">
          Cancel
        </button>
        <button disabled={pending} type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary-container px-6 font-label text-xs font-bold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 disabled:opacity-60 transition-all cursor-pointer">
          {pending ? <LoaderCircle size={14} className="animate-spin" /> : "Add Video"}
        </button>
      </div>
    </form>
  );
}

/* ================= VIDEO EDIT FORM SUB-COMPONENT ================= */
function VideoEditForm({
  video,
  action,
  pending,
  modalError,
  onClose,
  onDelete
}: {
  video: ManagedVideo;
  action: (data: FormData) => void;
  pending: boolean;
  modalError: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [isOptional, setIsOptional] = useState<string>(video.is_optional ? "true" : "false");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (showDeleteConfirm) {
    return (
      <div className="space-y-6 py-4 animate-fade-in">
        <div className="flex items-start gap-4 p-4 border border-red-500/20 bg-red-500/10 rounded-2xl">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <h4 className="font-sans font-bold text-white text-base">Delete video: {video.title}?</h4>
            <p className="text-sm text-red-200">
              This will permanently delete the video and its secure access logs from the database.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surgical-steel">
          <button 
            type="button" 
            onClick={() => setShowDeleteConfirm(false)}
            className="min-h-10 px-4 font-label text-xs font-bold uppercase tracking-wider text-fog-muted hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            disabled={pending}
            onClick={() => onDelete(video.id)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-red-500/25 border border-red-500/50 hover:bg-red-500/40 text-red-300 px-6 font-label text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : <><Trash2 size={14} /> Confirm Delete</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {modalError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-sm text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{modalError}</span>
        </div>
      )}
      
      <input type="hidden" name="videoId" value={video.id} />
      <input type="hidden" name="isOptional" value={isOptional === "true" ? "on" : ""} />

      <div className="space-y-1">
        <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Video Title</label>
        <input className={inputClass} name="title" defaultValue={video.title} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Duration (seconds)</label>
          <input className={inputClass} type="number" min="1" name="durationSeconds" defaultValue={video.duration_seconds} required />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Sort Order</label>
          <input className={inputClass} type="number" min="0" name="sortOrder" defaultValue={video.sort_order} required />
        </div>

        <CustomSelect 
          label="Requirement"
          value={isOptional}
          onChange={(val) => setIsOptional(String(val))}
          options={[
            { value: "false", label: "Required" },
            { value: "true", label: "Optional" }
          ]}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold font-label uppercase tracking-wider text-fog-muted">Release At (Optional)</label>
        <input className={inputClass} type="datetime-local" name="releaseAt" defaultValue={toLocalDatetimeLocal(video.release_at)} />
      </div>

      <div className="pt-6 border-t border-surgical-steel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Delete Trigger */}
        <button 
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-500/30 hover:border-red-500 text-red-400 px-5 font-label text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
        >
          <Trash2 size={14} /> Delete Video
        </button>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="min-h-10 px-4 font-label text-xs font-bold uppercase tracking-wider text-fog-muted hover:text-white transition-colors cursor-pointer">
            Cancel
          </button>
          <button disabled={pending} type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary-container px-6 font-label text-xs font-bold uppercase tracking-wider text-on-primary-fixed hover:brightness-110 disabled:opacity-60 transition-all cursor-pointer">
            {pending ? <LoaderCircle size={14} className="animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
