"use client";
import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useFinancials";

export function NotificationsPanel() {
  const { notifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-[400px] overflow-y-auto transform origin-top-right transition-all">
          <div className="p-4 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm sticky top-0">
            <h3 className="font-bold text-gray-900">Notifications</h3>
          </div>
          <div className="p-3">
            {notifications.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6 font-medium">You're all caught up!</p>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} className="p-3.5 bg-red-50 text-red-900 rounded-xl mb-2 text-sm border border-red-100 shadow-sm">
                  <span className="font-bold flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    {notif.type.replace('_', ' ')}
                  </span>
                  <p className="mt-1.5 opacity-90">{notif.payload?.message || "Action required on lead."}</p>
                  <p className="text-xs text-red-500/80 font-mono mt-2">{notif.leadId}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
