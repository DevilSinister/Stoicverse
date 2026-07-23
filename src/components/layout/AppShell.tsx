"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Menu, Search, X, Crown, LogOut, AlertCircle, Settings } from "lucide-react";

import { buildAppNav } from "@/lib/navigation/app-nav";
import { withRouteBase } from "@/lib/navigation/paths";
import { createClient } from "@/lib/supabase/client";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
};

type SearchResult = {
  id: string;
  title: string;
  description: string | null;
  href: string;
  kind: "lesson" | "event";
};

export interface AppShellProps {
  active: string;
  title: string;
  isMaster?: boolean;
  memberName?: string;
  platformRole?: string;
  currentTier?: number;
  notifications?: Notification[];
  routeBase?: string;
  children: React.ReactNode;
}

const roleName = (role: string) => role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const eventDate = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

const EMPTY_NOTIFICATIONS: Notification[] = [];

export function AppShell({
  active,
  isMaster = false,
  memberName = "Practitioner",
  platformRole = "member",
  currentTier = 1,
  notifications: initialNotifications = EMPTY_NOTIFICATIONS,
  routeBase = "",
  children,
}: AppShellProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isUpgradeOpen, setUpgradeOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [newName, setNewName] = useState(memberName);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
      }
    }
    loadUser();
  }, [supabase]);

  const currentName = settingsSuccess === "Username updated successfully." ? newName : memberName;

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ full_name: newName })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setSettingsSuccess("Username updated successfully.");
    } catch (error: unknown) {
      setSettingsError(error instanceof Error ? error.message : "Failed to update username");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setSettingsError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setSettingsError("Password must be at least 8 characters");
      return;
    }
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      setSettingsSuccess("Password updated successfully.");
    } catch (error: unknown) {
      setSettingsError(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleLogout = async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSettingsOpen(false);
      window.location.href = "/login";
    } catch (error: unknown) {
      setSettingsError(error instanceof Error ? error.message : "Failed to sign out");
      setSettingsLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const navItems = useMemo(() => buildAppNav({ routeBase }), [routeBase]);
  const visibleResults = query.trim().length >= 2 ? results : [];

  useEffect(() => {
    if (isSearchOpen) searchInput.current?.focus();
  }, [isSearchOpen]);

  // Search logic
  useEffect(() => {
    if (!isSearchOpen || query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (routeBase) params.set("base", routeBase);
        const response = await fetch(`/api/dashboard/search?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json() as { results?: SearchResult[] };
        setResults(response.ok ? payload.results ?? [] : []);
      } catch {
        // Ignored
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      try {
        controller.abort();
      } catch (e) {
        // Ignored
      }
      window.clearTimeout(timeout);
    };
  }, [query, isSearchOpen, routeBase]);

  async function openNotifications() {
    setNotificationsOpen(true);
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    
    // Optimistic update
    setNotifications((prev) => prev.map((n) => unreadIds.includes(n.id) ? { ...n, is_read: true } : n));
    
    try {
      const response = await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds })
      });
      if (!response.ok) {
        // Rollback
        setNotifications((prev) => prev.map((n) => unreadIds.includes(n.id) ? { ...n, is_read: false } : n));
      }
    } catch {
      setNotifications((prev) => prev.map((n) => unreadIds.includes(n.id) ? { ...n, is_read: false } : n));
    }
  }

  // Sidebar Render Component
  const renderSidebar = () => (
    <>
      <div className="border-b border-sidebar-border p-4 flex items-center justify-between">
        <Link href="/" className="block">
          <div className="font-headline text-lg text-white font-extrabold tracking-tight">Stoicverse</div>
          <div className="mt-1 font-label text-[10px] text-fog-muted uppercase tracking-[0.12em]">Community Hub</div>
        </Link>
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || active === item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex min-h-11 items-center justify-between px-4 py-2 rounded-full font-label text-xs uppercase tracking-wider transition ${isActive ? "bg-sidebar-accent text-sidebar-primary border-r-2 border-sidebar-primary font-bold" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"}`}
            >
              <div className="flex items-center gap-3">
                <Icon size={16} />
                <span>{item.label}</span>
              </div>
              {item.label === "Community" && unreadCount > 0 && (
                <span className="grid min-w-5 h-5 place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white uppercase tracking-normal animate-pulse shrink-0">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4 space-y-4 bg-sidebar/80">
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-primary border border-sidebar-border font-bold shrink-0">
              {currentName[0]?.toUpperCase() || "P"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{currentName}</p>
              <p className="truncate text-[10px] text-fog-muted capitalize font-label">{roleName(platformRole)}</p>
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            className="grid size-8 shrink-0 place-items-center rounded-full text-sidebar-foreground hover:text-white hover:bg-sidebar-accent transition-colors group"
          >
            <Settings size={15} className="transition-transform duration-500 group-hover:rotate-90" />
          </button>
        </div>
        <button
          onClick={() => setUpgradeOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-sidebar-primary hover:bg-opacity-90 py-3 font-label text-xs text-on-primary-fixed uppercase tracking-wider transition duration-200 shadow-md hover:brightness-105"
        >
          <Crown size={14} />
          <span>Upgrade Plan</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface md:flex">
      {/* Mobile Top Bar */}
      <header className="flex h-16 items-center justify-between border-b border-surgical-steel bg-sidebar px-4 md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(true)} className="text-on-surface-variant hover:text-primary-container" aria-label="Open menu">
            <Menu size={24} />
          </button>
          <span className="font-headline text-lg font-extrabold text-white tracking-tight">Stoicverse</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSearchOpen(true)} aria-label="Search" className="p-2 text-on-surface-variant hover:text-primary-container">
            <Search size={18} />
          </button>
          <button onClick={openNotifications} aria-label="Notifications" className="relative p-2 text-on-surface-variant hover:text-primary-container">
            <Bell size={18} />
            {unreadCount > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />}
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Slide-out */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 md:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {renderSidebar()}
      </aside>

      {/* Desktop Sidebar (Fixed) */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:h-screen md:sticky md:top-0 md:flex-col">
        {renderSidebar()}
      </aside>

      {/* Main Workspace Column */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Desktop Header */}
        <header className="hidden" aria-hidden="true">
          <div>
            <h1 className="font-headline text-lg text-white font-extrabold">{active}</h1>
            <p className="font-label text-[10px] text-fog-muted uppercase tracking-wider">Level 0{currentTier} • {isMaster ? "Master Account" : "Practitioner Access"}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSearchOpen(true)} aria-label="Search lessons and events" className="grid size-10 place-items-center rounded-full border border-surgical-steel text-on-surface-variant hover:border-primary-container hover:text-primary-container focus-ring transition-colors">
              <Search size={18} />
            </button>
            <button onClick={openNotifications} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} className="relative grid size-10 place-items-center rounded-full border border-surgical-steel text-on-surface-variant hover:border-primary-container hover:text-primary-container focus-ring transition-colors">
              <Bell size={18} />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 size-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 bg-surface relative overflow-y-auto">
          {children}
        </div>
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <Modal title="Search Stoicverse" onClose={() => setSearchOpen(false)}>
          <div className="space-y-4">
            <label className="sr-only" htmlFor="dashboard-search">Search lessons and events</label>
            <input
              ref={searchInput}
              id="dashboard-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lessons and events…"
              className="w-full rounded border border-surgical-steel bg-surface-container-lowest p-3.5 text-on-surface outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
            />
            {searching && (
              <div className="flex items-center gap-2 text-sm text-fog-muted">
                <div className="size-4 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
                <span>Searching…</span>
              </div>
            )}
            <div className="divide-y divide-surgical-steel max-h-[40vh] overflow-y-auto">
              {visibleResults.map((result) => (
                <Link
                  onClick={() => setSearchOpen(false)}
                  href={result.href}
                  key={`${result.kind}-${result.id}`}
                  className="block py-3 group hover:text-primary-container transition"
                >
                  <p className="font-label text-[10px] uppercase text-primary-container font-semibold tracking-wider">{result.kind}</p>
                  <p className="mt-1 font-headline text-sm font-semibold text-white group-hover:text-primary-container transition">{result.title}</p>
                  {result.description && <p className="mt-1 font-body text-xs text-fog-muted line-clamp-1">{result.description}</p>}
                </Link>
              ))}
              {query.trim().length >= 2 && !searching && visibleResults.length === 0 && (
                <div className="py-6 text-center text-sm text-fog-muted">
                  <AlertCircle size={20} className="mx-auto mb-2 opacity-50" />
                  <span>No accessible results found.</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Notifications Modal */}
      {isNotificationsOpen && (
        <Modal title="Notifications" onClose={() => setNotificationsOpen(false)}>
          <div className="space-y-6">
            <section className="border-b border-surgical-steel pb-4">
              <p className="font-label text-xs uppercase text-primary-container font-semibold tracking-wider">Account access</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="border border-surgical-steel bg-surface-container-low px-2.5 py-1 rounded font-label text-xs">
                  {roleName(platformRole)}
                </span>
                <span className="border border-surgical-steel bg-surface-container-low px-2.5 py-1 rounded font-label text-xs">
                  {isMaster ? "Master Status" : `Tier 0${currentTier}`}
                </span>
              </div>
            </section>
            
            <div className="divide-y divide-surgical-steel max-h-[50vh] overflow-y-auto pr-1">
              {notifications.map((notification) => (
                <article key={notification.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex gap-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.is_read ? "bg-surgical-steel" : "bg-red-500"}`} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-white leading-snug">{notification.title}</p>
                      {notification.body && <p className="font-body text-xs text-fog-muted leading-relaxed">{notification.body}</p>}
                      <div className="flex items-center justify-between pt-2">
                        {notification.action_url && (
                          <Link href={notification.action_url} className="font-label text-xs text-primary-container hover:underline uppercase tracking-wider font-semibold">
                            View details
                          </Link>
                        )}
                        <p className="font-label text-[10px] text-fog-muted">{eventDate(notification.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {notifications.length === 0 && (
                <div className="py-8 text-center text-fog-muted">
                  <p className="font-headline text-base font-semibold text-white">You are all caught up</p>
                  <p className="font-body text-xs mt-1">Account, role, and event updates will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in" onMouseDown={() => {
          setSettingsOpen(false);
          setSettingsError(null);
          setSettingsSuccess(null);
        }}>
          <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-surgical-steel bg-surface-container-low text-on-surface shadow-2xl animate-in zoom-in-95 duration-200" onMouseDown={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surgical-steel px-6 py-4">
              <h2 className="font-headline text-lg font-bold text-white flex items-center gap-2">
                <Settings className="text-primary-container transition-transform duration-500 hover:rotate-90" size={18} />
                Account Settings
              </h2>
              <button
                onClick={() => {
                  setSettingsOpen(false);
                  setSettingsError(null);
                  setSettingsSuccess(null);
                }}
                className="text-on-surface-variant hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-6">
              {settingsSuccess && (
                <div className="flex items-center gap-2 rounded bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {settingsError && (
                <div className="flex items-center gap-2 rounded bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}

              {/* Read-Only Details */}
              <div className="space-y-4">
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-wider text-fog-muted">Email Address</label>
                  <p className="mt-1 font-body text-sm text-white select-all">{email || "Retrieving session email..."}</p>
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-wider text-fog-muted">Access Tier</label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="border border-surgical-steel bg-surface-container-high px-2.5 py-1 rounded-full font-label text-[10px] text-primary-container uppercase">
                      Level 0{currentTier} • {isMaster ? "Master" : "Practitioner"}
                    </span>
                  </div>
                </div>
              </div>

              <hr className="border-surgical-steel" />

              {/* Username Update Form */}
              <form onSubmit={handleUpdateName} className="space-y-3">
                <h3 className="font-headline text-sm font-semibold text-white">Update Profile</h3>
                <div>
                  <label htmlFor="settings-username" className="block font-label text-[10px] uppercase tracking-wider text-fog-muted mb-1.5">Username</label>
                  <input
                    id="settings-username"
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded border border-surgical-steel bg-surface-container-lowest px-4 py-2.5 text-sm text-white outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={settingsLoading || newName === currentName}
                  className="flex min-h-10 items-center justify-center rounded-full bg-primary-container px-5 font-label text-xs uppercase tracking-wider text-on-primary-fixed transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Profile
                </button>
              </form>

              <hr className="border-surgical-steel" />

              {/* Password Update Form */}
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <h3 className="font-headline text-sm font-semibold text-white">Change Password</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="settings-new-password" className="block font-label text-[10px] uppercase tracking-wider text-fog-muted mb-1.5">New Password</label>
                    <input
                      id="settings-new-password"
                      type="password"
                      required
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded border border-surgical-steel bg-surface-container-lowest px-4 py-2.5 text-sm text-white outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all placeholder:text-fog-muted"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-confirm-password" className="block font-label text-[10px] uppercase tracking-wider text-fog-muted mb-1.5">Confirm New Password</label>
                    <input
                      id="settings-confirm-password"
                      type="password"
                      required
                      placeholder="Verify new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded border border-surgical-steel bg-surface-container-lowest px-4 py-2.5 text-sm text-white outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all placeholder:text-fog-muted"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={settingsLoading || !newPassword}
                  className="flex min-h-10 items-center justify-center rounded-full border border-primary-container px-5 font-label text-xs uppercase tracking-wider text-primary-container transition-all hover:bg-primary-container/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Password
                </button>
              </form>

              <hr className="border-surgical-steel" />

              {/* Logout Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={settingsLoading}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 font-label-md text-label-md text-red-400 uppercase tracking-wider transition hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50"
                >
                  <LogOut size={16} />
                  Log Out Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Plan Modal */}
      {isUpgradeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in" onMouseDown={() => setUpgradeOpen(false)}>
          <div className="relative w-full max-w-xl overflow-hidden rounded-lg border border-surgical-steel bg-surface-container-low text-on-surface shadow-2xl animate-in zoom-in-95 duration-200" onMouseDown={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surgical-steel px-6 py-4">
              <h2 className="font-headline text-lg font-bold text-white flex items-center gap-2">
                <Crown className="text-primary-container" size={18} />
                Upgrade Membership
              </h2>
              <button onClick={() => setUpgradeOpen(false)} className="text-on-surface-variant hover:text-white transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {/* Content Container */}
            <div className="p-6 space-y-6">
              {/* Current Active Plan */}
              <div className="border border-surgical-steel bg-surface-container-high/30 p-4 rounded-lg space-y-2">
                <span className="font-label text-[9px] uppercase tracking-wider text-fog-muted">Current Plan</span>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-headline text-base font-bold text-white">Platform Membership</h3>
                    <p className="font-body text-xs text-on-surface-variant">Level 0{currentTier} • Practitioner Access</p>
                  </div>
                  <span className="font-headline text-sm font-bold text-emerald-400">ACTIVE • $10.00/mo</span>
                </div>
              </div>

              {/* Available Plans */}
              <div className="space-y-4">
                <h4 className="font-label text-[10px] uppercase tracking-wider text-fog-muted border-b border-surgical-steel pb-2">Available Plans</h4>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Annual Membership Card */}
                  <div className="border border-surgical-steel bg-surface-container-high/10 p-5 rounded-lg flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-headline text-sm font-bold text-white">Annual Membership</h4>
                        <span className="border border-primary-container/20 bg-primary-container/10 px-2 py-0.5 rounded-full font-label text-[8px] text-primary-container uppercase font-semibold">Save 16%</span>
                      </div>
                      <p className="font-body text-xs text-on-surface-variant">Lock in a full year of Stoic study, reflections, events, and curriculum progression.</p>
                    </div>
                    <div>
                      <div className="font-headline text-lg font-bold text-primary-container mb-3">$100.00<span className="text-xs font-normal text-fog-muted">/yr</span></div>
                      <Link
                        href={withRouteBase("", "/checkout?product=annual")}
                        onClick={() => setUpgradeOpen(false)}
                        className="flex min-h-9 w-full items-center justify-center rounded-full bg-primary-container font-label text-xs uppercase tracking-wider text-on-primary-fixed hover:brightness-105 active:scale-[0.98] transition"
                      >
                        Upgrade Now
                      </Link>
                    </div>
                  </div>

                  {/* Mentorship Card */}
                  <div className="border border-surgical-steel bg-surface-container-high/10 p-5 rounded-lg flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-headline text-sm font-bold text-white">Private Mentorship</h4>
                        <span className="border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full font-label text-[8px] text-emerald-400 uppercase font-semibold">1-on-1 Slots</span>
                      </div>
                      <p className="font-body text-xs text-on-surface-variant">Work directly with a Master Stoic. Daily log reviews, bi-weekly private reflection calls.</p>
                    </div>
                    <div>
                      <div className="font-headline text-lg font-bold text-emerald-400 mb-3">$1,000.00<span className="text-xs font-normal text-fog-muted">/2mo</span></div>
                      <Link
                        href={withRouteBase("", "/checkout?product=mentorship")}
                        onClick={() => setUpgradeOpen(false)}
                        className="flex min-h-9 w-full items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 font-label text-xs uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] transition"
                      >
                        Enroll Now
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onMouseDown={onClose}>
      <div className="max-h-[85vh] w-full max-w-xl overflow-auto border border-surgical-steel bg-monolith-surface p-6 rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between border-b border-surgical-steel pb-4">
          <h2 className="font-headline text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 text-on-surface-variant hover:text-primary-container transition" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
