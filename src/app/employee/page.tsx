"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase/client";
import { useLeads, Lead } from "@/hooks/useLeads";
import { LeadCard } from "@/components/LeadCard";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import { acceptLead } from "@/app/actions/leads";
import { 
  Search, 
  Filter, 
  Briefcase, 
  CheckCircle, 
  Clock, 
  UserCheck
} from "lucide-react";

export default function EmployeeDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { leads, loading: leadsLoading } = useLeads('employee', user?.uid);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  
  // Selected Lead for Detail Modal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    if (!loading && (!user || role !== "employee")) {
      router.push("/");
    }
  }, [user, role, loading, router]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = l.name?.toLowerCase().includes(q);
        const matchesPhone = l.phone?.toLowerCase().includes(q);
        const matchesEmail = l.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail) return false;
      }
      if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
      return true;
    });
  }, [leads, searchQuery, statusFilter]);

  if (loading || leadsLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (!user || role !== "employee") return null;

  const assignedLeads = filteredLeads.filter(l => l.status === "ASSIGNED");
  const activeLeads = filteredLeads.filter(l => l.status !== "ASSIGNED" && l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST");
  const closedLeads = filteredLeads.filter(l => l.status === "CLOSED_WON");

  const handleAccept = async (leadId: string) => {
    setAcceptingId(leadId);
    try {
      const token = await user.getIdToken();
      await acceptLead(token, leadId);
    } catch (e: any) {
      alert("Error accepting lead: " + e.message);
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Briefcase size={20} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white">Employee Workspace</h1>
              <p className="text-[11px] text-slate-400">My Leads & Follow-ups</p>
            </div>
          </div>

          <div className="flex items-center space-x-5">
            <span className="text-xs font-semibold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
              {user.email}
            </span>
            <button 
              onClick={() => auth.signOut()}
              className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/40 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search my leads by name, phone, email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <Filter size={13} className="text-slate-400" />
            <span className="text-slate-400 font-semibold">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All My Leads</option>
              <option value="ASSIGNED" className="bg-slate-900">Needs Acceptance</option>
              <option value="ACCEPTED" className="bg-slate-900">Accepted</option>
              <option value="CONTACTED" className="bg-slate-900">Contacted</option>
              <option value="FOLLOW_UP" className="bg-slate-900">Follow-Up</option>
              <option value="INTERESTED" className="bg-slate-900">Interested</option>
              <option value="NEGOTIATION" className="bg-slate-900">Negotiation</option>
              <option value="CLOSED_WON" className="bg-slate-900">Closed Won</option>
            </select>
          </div>
        </div>
      </div>
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-10">
        
        {/* KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
            <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Needs Acceptance</span>
              <Clock size={16} className="text-amber-400" />
            </div>
            <p className="text-3xl font-black text-amber-400 tracking-tight">{assignedLeads.length}</p>
            <p className="text-xs text-slate-500">10-minute acceptance SLA</p>
          </div>

          <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
            <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>Active Pipeline</span>
              <UserCheck size={16} className="text-indigo-400" />
            </div>
            <p className="text-3xl font-black text-white tracking-tight">{activeLeads.length}</p>
            <p className="text-xs text-slate-500">Leads currently in communication</p>
          </div>

          <div className="p-6 bg-gradient-to-br from-emerald-950/40 to-slate-900 rounded-2xl border border-emerald-500/30 space-y-1">
            <div className="flex justify-between items-center text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span>Closed Won</span>
              <CheckCircle size={16} />
            </div>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">{closedLeads.length}</p>
            <p className="text-xs text-emerald-500/80">Converted deals</p>
          </div>
        </section>

        {/* Section 1: Needs Acceptance (10-min SLA) */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Needs Acceptance (10-Min Window)
            {assignedLeads.length > 0 && <span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-0.5 rounded-full border border-red-500/30 animate-pulse">{assignedLeads.length}</span>}
          </h2>

          {assignedLeads.length === 0 ? (
            <div className="bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500 text-xs">
              No new leads waiting for your acceptance.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {assignedLeads.map(lead => (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  onClick={() => handleAccept(lead.id)}
                  actionText={acceptingId === lead.id ? "Accepting..." : "Accept Lead"}
                />
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Active Pipeline */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">My Working Pipeline ({activeLeads.length})</h2>
            <p className="text-xs text-slate-400">Click any card to view full timeline, log calls/WhatsApp, or close deal</p>
          </div>

          {activeLeads.length === 0 ? (
            <div className="bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500 text-xs">
              No active leads in your working pipeline.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeLeads.map(lead => (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  onClick={() => setSelectedLead(lead)}
                  actionText="Open Profile"
                />
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Closed Deals */}
        {closedLeads.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-emerald-400">My Closed Deals ({closedLeads.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {closedLeads.map(lead => (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  onClick={() => setSelectedLead(lead)}
                  actionText="View Closed Deal"
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Comprehensive Lead Detail Modal */}
      <LeadDetailModal 
        lead={selectedLead} 
        onClose={() => setSelectedLead(null)} 
        userRole="employee"
        getIdToken={() => user.getIdToken()}
      />
    </div>
  );
}
