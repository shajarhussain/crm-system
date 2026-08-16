"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase/client";
import { useLeads, Lead, LeadStatus } from "@/hooks/useLeads";
import { useEmployees } from "@/hooks/useEmployees";
import { useFinancials } from "@/hooks/useFinancials";
import { LeadCard } from "@/components/LeadCard";
import { Modal } from "@/components/ui/Modal";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { assignLead, reassignLeadManual } from "@/app/actions/leads";
import { addExpense } from "@/app/actions/expenses";
import { createEmployee, setEmployeePriority, disableEmployee } from "@/app/actions/employees";
import { 
  Search, 
  Users, 
  BarChart3, 
  LayoutDashboard, 
  Receipt, 
  Filter, 
  Plus, 
  TrendingUp, 
  DollarSign, 
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries",
  "Internet",
  "Electricity",
  "Water",
  "Bills",
  "Marketing",
  "Software",
  "Other"
];

export default function AdminDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { leads, loading: leadsLoading } = useLeads('admin');
  const { employees, loading: empLoading } = useEmployees();
  const { netProfit, totalRevenue, totalExpenses, expenses, deals } = useFinancials();

  const [activeTab, setActiveTab] = useState<"DASHBOARD" | "EMPLOYEES" | "EXPENSES" | "REPORTS">("DASHBOARD");
  
  // Search & Filter State (FR-30)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [employeeFilter, setEmployeeFilter] = useState<string>("ALL");
  const [campaignFilter, setCampaignFilter] = useState<string>("ALL");

  // Lead Assign Modal State
  const [assigningLead, setAssigningLead] = useState<Lead | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Lead Detail Modal State
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);

  // Expense Modal State
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [expTitle, setExpTitle] = useState("");
  const [expCategory, setExpCategory] = useState("Marketing");
  const [expAmount, setExpAmount] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [isLoggingExp, setIsLoggingExp] = useState(false);

  // Employee Management State
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [newEmpPriority, setNewEmpPriority] = useState("1");
  const [isManagingEmp, setIsManagingEmp] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      router.push("/");
    }
  }, [user, role, loading, router]);

  // Unique campaign IDs for filtering
  const uniqueCampaigns = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => {
      if (l.campaignId) set.add(l.campaignId);
    });
    return Array.from(set);
  }, [leads]);

  // Filtered Leads (FR-30)
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = l.name?.toLowerCase().includes(q);
        const matchesPhone = l.phone?.toLowerCase().includes(q);
        const matchesEmail = l.email?.toLowerCase().includes(q);
        const matchesSource = l.source?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesSource) return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
      // Employee filter
      if (employeeFilter !== "ALL") {
        if (employeeFilter === "UNASSIGNED" && l.assignedUserId) return false;
        if (employeeFilter !== "UNASSIGNED" && l.assignedUserId !== employeeFilter) return false;
      }
      // Campaign filter
      if (campaignFilter !== "ALL" && l.campaignId !== campaignFilter) return false;

      return true;
    });
  }, [leads, searchQuery, statusFilter, employeeFilter, campaignFilter]);

  if (loading || leadsLoading || empLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (!user || role !== "admin") return null;

  const newLeads = filteredLeads.filter(l => l.status === "NEW");
  const activeLeads = filteredLeads.filter(l => ["ASSIGNED", "ACCEPTED", "CONTACTED", "FOLLOW_UP", "INTERESTED", "NEGOTIATION"].includes(l.status));
  const closedLeads = filteredLeads.filter(l => l.status === "CLOSED_WON");

  const handleAssign = async () => {
    if (!assigningLead || !selectedEmpId) return;
    setIsAssigning(true);
    try {
      const token = await user.getIdToken();
      if (assigningLead.status === "NEW") {
        await assignLead(token, assigningLead.id, selectedEmpId);
      } else {
        await reassignLeadManual(token, assigningLead.id, selectedEmpId);
      }
      setAssigningLead(null);
      setSelectedEmpId("");
    } catch (e: any) {
      alert("Error assigning lead: " + e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle || !expAmount) return;
    setIsLoggingExp(true);
    try {
      const token = await user.getIdToken();
      await addExpense(token, expTitle, expCategory, parseFloat(expAmount), expDescription);
      setIsExpenseOpen(false);
      setExpTitle("");
      setExpCategory("Marketing");
      setExpAmount("");
      setExpDescription("");
    } catch (e: any) {
      alert("Error logging expense: " + e.message);
    } finally {
      setIsLoggingExp(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpEmail || !newEmpPassword) return;
    setIsManagingEmp(true);
    try {
      const token = await user.getIdToken();
      await createEmployee(token, newEmpEmail, newEmpPassword, parseInt(newEmpPriority));
      setIsEmpModalOpen(false);
      setNewEmpEmail("");
      setNewEmpPassword("");
      setNewEmpPriority("1");
    } catch (e: any) {
      alert("Error creating employee: " + e.message);
    } finally {
      setIsManagingEmp(false);
    }
  };

  const handleChangePriority = async (uid: string, priority: string) => {
    try {
      const token = await user.getIdToken();
      await setEmployeePriority(token, uid, parseInt(priority));
    } catch (e: any) {
      alert("Error updating priority: " + e.message);
    }
  };

  const handleDisableEmployee = async (uid: string) => {
    if (!confirm("Are you sure you want to disable this employee? Historical records will be safely preserved.")) return;
    try {
      const token = await user.getIdToken();
      await disableEmployee(token, uid);
    } catch (e: any) {
      alert("Error disabling employee: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                <ShieldCheck size={20} />
              </div>
              <h1 className="text-lg font-extrabold tracking-tight text-white">CRM Admin</h1>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80">
              <button 
                onClick={() => setActiveTab("DASHBOARD")} 
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                <LayoutDashboard size={14} /> Pipeline
              </button>
              <button 
                onClick={() => setActiveTab("EMPLOYEES")} 
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'EMPLOYEES' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                <Users size={14} /> Employees ({employees.length})
              </button>
              <button 
                onClick={() => setActiveTab("EXPENSES")} 
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'EXPENSES' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                <Receipt size={14} /> Expenses ({expenses.length})
              </button>
              <button 
                onClick={() => setActiveTab("REPORTS")} 
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'REPORTS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                <BarChart3 size={14} /> Reports
              </button>
            </nav>
          </div>
          
          <div className="flex items-center space-x-5">
            <NotificationsPanel />
            <div className="h-5 w-px bg-slate-800"></div>
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

      {/* Global Filter Toolbar (FR-30) */}
      <div className="bg-slate-900/40 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search leads by name, phone, email, source..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <Filter size={13} className="text-slate-400" />
              <span className="text-slate-400 font-semibold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-white font-semibold outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">All Statuses</option>
                <option value="NEW" className="bg-slate-900">New</option>
                <option value="ASSIGNED" className="bg-slate-900">Assigned</option>
                <option value="ACCEPTED" className="bg-slate-900">Accepted</option>
                <option value="CONTACTED" className="bg-slate-900">Contacted</option>
                <option value="FOLLOW_UP" className="bg-slate-900">Follow-Up</option>
                <option value="INTERESTED" className="bg-slate-900">Interested</option>
                <option value="NEGOTIATION" className="bg-slate-900">Negotiation</option>
                <option value="CLOSED_WON" className="bg-slate-900">Closed / Won</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-semibold">Employee:</span>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="bg-transparent text-white font-semibold outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">All Employees</option>
                <option value="UNASSIGNED" className="bg-slate-900">Unassigned</option>
                {employees.map(emp => (
                  <option key={emp.uid} value={emp.uid} className="bg-slate-900">{emp.email}</option>
                ))}
              </select>
            </div>

            {uniqueCampaigns.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 font-semibold">Campaign:</span>
                <select
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                  className="bg-transparent text-white font-semibold outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900">All Campaigns</option>
                  {uniqueCampaigns.map(c => (
                    <option key={c} value={c} className="bg-slate-900">{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-10">
        
        {/* TAB 1: PIPELINE DASHBOARD */}
        {activeTab === "DASHBOARD" && (
          <div className="space-y-10 animate-in fade-in duration-300">
            {/* KPI Section with Financials (FR-28) */}
            <section>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="p-6 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl shadow-xl shadow-indigo-600/20 text-white space-y-1">
                  <div className="flex justify-between items-center text-indigo-200 text-xs font-bold uppercase tracking-wider">
                    <span>Action Required</span>
                    <TrendingUp size={16} />
                  </div>
                  <p className="text-3xl font-black tracking-tight">{newLeads.length}</p>
                  <p className="text-xs text-indigo-200">Leads waiting in 5-min window</p>
                </div>

                <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <span>Gross Revenue</span>
                    <DollarSign size={16} />
                  </div>
                  <p className="text-3xl font-black text-white tracking-tight">${totalRevenue.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">Total deal profits closed</p>
                </div>

                <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <span>Total Expenses</span>
                    <Receipt size={16} />
                  </div>
                  <p className="text-3xl font-black text-red-400 tracking-tight">-${totalExpenses.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{expenses.length} logged office expenses</p>
                </div>

                <div className="p-6 bg-gradient-to-br from-emerald-950/40 to-slate-900 rounded-2xl border border-emerald-500/30 space-y-1">
                  <div className="flex justify-between items-center text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <span>Net Profit (FR-28)</span>
                    <ArrowUpRight size={16} />
                  </div>
                  <p className="text-3xl font-black text-emerald-400 tracking-tight">${netProfit.toFixed(2)}</p>
                  <p className="text-xs text-emerald-500/80">Revenue minus all expenses</p>
                </div>
              </div>
            </section>

            {/* Action Required (NEW Leads) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Action Required (5-Min SLA)
                  {newLeads.length > 0 && <span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-0.5 rounded-full border border-red-500/30 animate-pulse">{newLeads.length}</span>}
                </h2>
              </div>

              {newLeads.length === 0 ? (
                <div className="bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500 text-sm">
                  No new leads waiting for manual assignment.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {newLeads.map(lead => (
                    <LeadCard 
                      key={lead.id} 
                      lead={lead} 
                      onClick={() => setAssigningLead(lead)}
                      actionText="Assign Now"
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Active Pipeline */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Active Pipeline ({activeLeads.length})</h2>
                <p className="text-xs text-slate-400">Click any card to open full profile & follow-up history</p>
              </div>

              {activeLeads.length === 0 ? (
                <div className="bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500 text-sm">
                  No active leads matching your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {activeLeads.map(lead => (
                    <LeadCard 
                      key={lead.id} 
                      lead={lead} 
                      onClick={() => setViewingLead(lead)}
                      actionText="View Profile"
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Deals Won */}
            {closedLeads.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-emerald-400">Closed / Won Deals ({closedLeads.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {closedLeads.map(lead => (
                    <LeadCard 
                      key={lead.id} 
                      lead={lead} 
                      onClick={() => setViewingLead(lead)}
                      actionText="View Deal"
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: EMPLOYEES MANAGEMENT */}
        {activeTab === "EMPLOYEES" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Employee Management (FR-1, FR-2, BR-1, BR-2)</h2>
                <p className="text-xs text-slate-400">Manage employee priorities (1 = highest) for the 8-lead auto-rotation engine.</p>
              </div>
              <button 
                onClick={() => setIsEmpModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-colors"
              >
                <Plus size={16} /> Add Employee
              </button>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Employee Email</th>
                    <th className="px-6 py-4">Priority (1-5)</th>
                    <th className="px-6 py-4">Assigned Leads</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {employees.map(emp => {
                    const empLeadsCount = leads.filter(l => l.assignedUserId === emp.uid).length;
                    return (
                      <tr key={emp.uid} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">{emp.email}</td>
                        <td className="px-6 py-4">
                          <select 
                            value={emp.priority} 
                            onChange={(e) => handleChangePriority(emp.uid, e.target.value)}
                            className="bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer"
                          >
                            {[1,2,3,4,5].map(p => <option key={p} value={p}>Priority {p}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-semibold">{empLeadsCount} active leads</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-[11px] font-extrabold rounded-full border ${emp.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {emp.status === 'ACTIVE' && (
                            <button 
                              onClick={() => handleDisableEmployee(emp.uid)}
                              className="text-red-400 hover:text-red-300 font-bold transition-colors"
                            >
                              Disable
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: EXPENSES LEDGER */}
        {activeTab === "EXPENSES" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Expenses Ledger (FR-26, FR-27, BR-20)</h2>
                <p className="text-xs text-slate-400">All business and operational expenses deducted from gross profit.</p>
              </div>
              <button 
                onClick={() => setIsExpenseOpen(true)}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 shadow-md transition-colors"
              >
                <Plus size={16} /> Log Expense
              </button>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              {expenses.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No expenses recorded yet. Click "Log Expense" to add your first entry.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Category (FR-27)</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">{exp.title}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg font-mono">
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-red-400">-${exp.amount.toFixed(2)}</td>
                        <td className="px-6 py-4 text-slate-400 max-w-xs truncate">{exp.description || "—"}</td>
                        <td className="px-6 py-4 text-right text-slate-400 font-mono">
                          {exp.date?.toDate ? exp.date.toDate().toLocaleDateString() : "Recent"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ADVANCED REPORTS */}
        {activeTab === "REPORTS" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-lg font-bold text-white">Performance & Campaign Analytics (FR-22–FR-25)</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Employee Leaderboard */}
              <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Users size={16} className="text-indigo-400" /> Employee Performance Leaderboard (FR-24)
                </h3>
                <div className="divide-y divide-slate-800">
                  {employees.map(emp => {
                    const empLeads = leads.filter(l => l.assignedUserId === emp.uid);
                    const closed = empLeads.filter(l => l.status === "CLOSED_WON").length;
                    const convRate = empLeads.length > 0 ? ((closed / empLeads.length) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={emp.uid} className="py-3 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-white">{emp.email}</p>
                          <p className="text-slate-400">Priority {emp.priority} • {emp.status}</p>
                        </div>
                        <div className="flex gap-5 text-right">
                          <div>
                            <span className="text-slate-400 block">Handled</span>
                            <span className="font-bold text-white">{empLeads.length}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Closed</span>
                            <span className="font-bold text-emerald-400">{closed}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Conversion</span>
                            <span className="font-bold text-indigo-400">{convRate}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Campaign Performance */}
              <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <BarChart3 size={16} className="text-blue-400" /> Campaign Breakdown (FR-25)
                </h3>
                {uniqueCampaigns.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No campaign data recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {uniqueCampaigns.map(cId => {
                      const cLeads = leads.filter(l => l.campaignId === cId);
                      const closed = cLeads.filter(l => l.status === "CLOSED_WON").length;
                      return (
                        <div key={cId} className="py-3 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-white font-mono">{cId}</p>
                            <p className="text-slate-400">{cLeads.length} total leads received</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-400">{closed} Closed Won</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Manual Assignment Modal */}
      <Modal isOpen={!!assigningLead} onClose={() => setAssigningLead(null)} title="Assign Lead to Employee">
        {assigningLead && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Lead Name</p>
              <p className="text-slate-900 font-bold bg-slate-100 p-3 rounded-xl border border-slate-200">{assigningLead.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Select Assignee</p>
              <select 
                value={selectedEmpId} 
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="" disabled>Choose an employee...</option>
                {employees.filter(e => e.status === 'ACTIVE').map(emp => (
                  <option key={emp.uid} value={emp.uid}>{emp.email} (Priority {emp.priority})</option>
                ))}
              </select>
            </div>
            <button
              disabled={!selectedEmpId || isAssigning}
              onClick={handleAssign}
              className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-sm flex justify-center"
            >
              {isAssigning ? "Assigning..." : "Confirm Assignment"}
            </button>
          </div>
        )}
      </Modal>

      {/* Expense Modal (FR-26 / FR-27) */}
      <Modal isOpen={isExpenseOpen} onClose={() => setIsExpenseOpen(false)} title="Log Operational Expense (FR-26)">
        <form onSubmit={handleLogExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Title *</label>
            <input
              type="text"
              required
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Meta Ads August"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category (FR-27) *</label>
            <select
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ($) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. 500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              value={expDescription}
              onChange={(e) => setExpDescription(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
              placeholder="Additional invoice/notes..."
            />
          </div>

          <button
            type="submit"
            disabled={isLoggingExp}
            className="w-full bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-sm flex justify-center"
          >
            {isLoggingExp ? "Logging..." : "Record Expense"}
          </button>
        </form>
      </Modal>

      {/* Employee Create Modal */}
      <Modal isOpen={isEmpModalOpen} onClose={() => setIsEmpModalOpen(false)} title="Add New Employee (FR-1)">
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Email *</label>
            <input
              type="email"
              required
              value={newEmpEmail}
              onChange={(e) => setNewEmpEmail(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="employee@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password *</label>
            <input
              type="password"
              required
              value={newEmpPassword}
              onChange={(e) => setNewEmpPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Priority Tier (1-5) *</label>
            <select
              value={newEmpPriority}
              onChange={(e) => setNewEmpPriority(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[1,2,3,4,5].map(p => <option key={p} value={p}>Priority {p}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={isManagingEmp}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-sm flex justify-center"
          >
            {isManagingEmp ? "Creating..." : "Save Employee"}
          </button>
        </form>
      </Modal>

      {/* Comprehensive Lead Detail Modal */}
      <LeadDetailModal 
        lead={viewingLead} 
        onClose={() => setViewingLead(null)} 
        userRole="admin"
        getIdToken={() => user.getIdToken()}
      />
    </div>
  );
}
