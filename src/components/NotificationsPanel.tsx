"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, AlertTriangle, Clock, UserX } from "lucide-react";
import { useNotifications } from "@/hooks/useFinancials";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/clientActions";
import { formatBusinessDateTime } from "@/lib/dates";

const ALERT_META: Record<string, { label: string; icon: typeof AlertTriangle; tone: string }> = {
  RED_FLAG: { label: "Not accepted in time", icon: AlertTriangle, tone: "text-red-600 bg-red-50 border-red-100" },
  NO_FOLLOWUP: { label: "No follow-up logged", icon: Clock, tone: "text-amber-700 bg-amber-50 border-amber-100" },
  UNASSIGNED_LEAD: { label: "Needs manual assignment", icon: UserX, tone: "text-indigo-700 bg-indigo-50 border-indigo-100" },
};

export function NotificationsPanel({ getIdToken }: { getIdToken: () => Promise<string> }) {
  const { notifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const dismiss = async (id: string) => {
    setBusyId(id);
    try {
      await markNotificationRead(await getIdToken(), id);
    } catch (error) {
      console.error("[notifications] dismiss failed", error);
    } finally {
      setBusyId(null);
    }
  };

  const dismissAll = async () => {
    setBusyId("all");
    try {
      await markAllNotificationsRead(await getIdToken());
    } catch (error) {
      console.error("[notifications] dismiss all failed", error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Alerts${notifications.length ? `, ${notifications.length} unread` : ""}`}
        aria-expanded={isOpen}
        className="relative rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold tabular-nums text-white">
            {notifications.length > 99 ? "99+" : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-3 max-h-[420px] w-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-slate-50/90 p-4 backdrop-blur-sm">
            <h3 className="font-bold text-slate-900">Alerts</h3>
            {notifications.length > 0 && (
              <button
                onClick={dismissAll}
                disabled={busyId === "all"}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
              >
                {busyId === "all" ? "Clearing…" : "Clear all"}
              </button>
            )}
          </div>

          <div className="p-3">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm font-medium text-slate-500">Nothing needs your attention.</p>
            ) : (
              notifications.map((notification) => {
                const meta = ALERT_META[notification.type] ?? {
                  label: notification.type.replace(/_/g, " "),
                  icon: AlertTriangle,
                  tone: "text-slate-700 bg-slate-50 border-slate-100",
                };
                const Icon = meta.icon;

                return (
                  <div key={notification.id} className={`mb-2 rounded-xl border p-3.5 text-sm ${meta.tone}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-2 font-bold">
                        <Icon size={15} className="shrink-0" />
                        {meta.label}
                      </span>
                      <button
                        onClick={() => dismiss(notification.id)}
                        disabled={busyId === notification.id}
                        aria-label="Dismiss alert"
                        className="shrink-0 rounded-full p-1 transition-colors hover:bg-white/60 disabled:opacity-50"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                    <p className="mt-1.5 opacity-90">{notification.payload?.message ?? "Action required."}</p>
                    <p className="mt-2 text-xs opacity-60">{formatBusinessDateTime(notification.createdAt)}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
