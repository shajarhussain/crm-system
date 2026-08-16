"use client";

import { Lead } from "@/hooks/useLeads";
import { Clock, User, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  actionText?: string;
}

export function LeadCard({ lead, onClick, actionText }: LeadCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      let deadline = null;
      if (lead.status === "NEW" && lead.adminAssignDeadlineAt) {
        deadline = lead.adminAssignDeadlineAt.toMillis();
      } else if (lead.status === "ASSIGNED" && lead.acceptDeadlineAt) {
        deadline = lead.acceptDeadlineAt.toMillis();
      }

      if (!deadline) {
        setTimeLeft("");
        return;
      }

      const diff = deadline - Date.now();
      if (diff <= 0) {
        setTimeLeft("EXPIRED");
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    };

    updateTime();
    const int = setInterval(updateTime, 1000);
    return () => clearInterval(int);
  }, [lead]);

  const getStatusColor = () => {
    switch(lead.status) {
      case "NEW": return "bg-blue-50 text-blue-700 border-blue-200";
      case "ASSIGNED": return "bg-amber-50 text-amber-700 border-amber-200";
      case "ACCEPTED": return "bg-purple-50 text-purple-700 border-purple-200";
      case "CLOSED_WON": return "bg-green-50 text-green-700 border-green-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`group bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 ease-out ${onClick ? 'cursor-pointer hover:border-blue-400 hover:-translate-y-1' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-semibold text-gray-900 text-lg tracking-tight">{lead.name}</h4>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <User size={14} className="text-gray-400" /> 
            {lead.assignedUserId ? `Employee: ${lead.assignedUserId.substring(0, 6)}...` : 'Unassigned'}
          </p>
        </div>
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getStatusColor()}`}>
          {lead.status}
        </span>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
        {timeLeft ? (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md">
            <Clock size={14} />
            <span className={timeLeft === "EXPIRED" ? "text-red-600 font-bold" : ""}>
              {timeLeft} left
            </span>
          </div>
        ) : (
          <div className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
            {lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleDateString() : 'Just now'}
          </div>
        )}

        {onClick && actionText && (
          <div className="flex items-center gap-1 text-sm font-bold text-blue-600 group-hover:text-blue-700">
            {actionText} <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform" />
          </div>
        )}
      </div>
    </div>
  );
}
