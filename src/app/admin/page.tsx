"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { useLeads, Lead } from "@/hooks/useLeads";
import { useEmployees } from "@/hooks/useEmployees";
import { useFinancials } from "@/hooks/useFinancials";
import { LeadCard } from "@/components/LeadCard";
import { Modal } from "@/components/ui/Modal";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { assignLead } from "@/app/actions/leads";
import { addExpense } from "@/app/actions/expenses";

export default function AdminDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { leads, loading: leadsLoading } = useLeads('admin');
  const { employees, loading: empLoading } = useEmployees();
  const { netProfit, totalRevenue, totalExpenses } = useFinancials();

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Expense Modal State
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [isLoggingExp, setIsLoggingExp] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      router.push("/");
    }
  }, [user, role, loading, router]);

  if (loading || leadsLoading || empLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!user || role !== "admin") return null;

  const newLeads = leads.filter(l => l.status === "NEW");
  const activeLeads = leads.filter(l => ["ASSIGNED", "ACCEPTED"].includes(l.status));
  const closedLeads = leads.filter(l => l.status === "CLOSED_WON");

  const handleAssign = async () => {
    if (!selectedLead || !selectedEmpId) return;
    setIsAssigning(true);
    try {
      const token = await user.getIdToken();
      await assignLead(token, selectedLead.id, selectedEmpId);
      setSelectedLead(null);
      setSelectedEmpId("");
    } catch (e: any) {
      alert("Error assigning lead: " + e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleLogExpense = async () => {
    if (!expTitle || !expAmount) return;
    setIsLoggingExp(true);
    try {
      const token = await user.getIdToken();
      await addExpense(token, expTitle, "General", parseFloat(expAmount), "");
      setIsExpenseOpen(false);
      setExpTitle("");
      setExpAmount("");
    } catch (e: any) {
      alert("Error logging expense: " + e.message);
    } finally {
      setIsLoggingExp(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight">Admin Console</h1>
          <div className="flex items-center space-x-6">
            <NotificationsPanel />
            <div className="h-6 w-px bg-gray-200"></div>
            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">{user.email}</span>
            <button 
              onClick={() => auth.signOut()}
              className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-12">
        
        {/* KPI Section with Financials */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Overview</h2>
            <button 
              onClick={() => setIsExpenseOpen(true)}
              className="bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg shadow-sm hover:bg-gray-800 transition-colors"
            >
              + Log Expense
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-lg text-white">
              <h3 className="font-semibold text-blue-100 opacity-90">Action Required</h3>
              <p className="text-4xl font-extrabold mt-2 tracking-tight">{newLeads.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-500">Gross Revenue</h3>
              <p className="text-3xl font-extrabold mt-2 text-gray-900 tracking-tight">${totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-500">Total Expenses</h3>
              <p className="text-3xl font-extrabold mt-2 text-red-600 tracking-tight">-${totalExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 bg-gradient-to-br from-green-50 to-white">
              <h3 className="font-semibold text-green-800">Net Profit</h3>
              <p className="text-3xl font-extrabold mt-2 text-green-700 tracking-tight">${netProfit.toFixed(2)}</p>
            </div>
          </div>
        </section>

        {/* Action Required Section */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            Action Required
            {newLeads.length > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{newLeads.length}</span>}
          </h2>
          {newLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500 font-medium">No new leads pending assignment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newLeads.map(lead => (
                <LeadCard 
                  key={lead.id} 
                  lead={lead} 
                  onClick={() => setSelectedLead(lead)}
                  actionText="Assign Now"
                />
              ))}
            </div>
          )}
        </section>

        {/* Pipeline Section */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Active Pipeline</h2>
          {activeLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500 font-medium">No active leads being worked on.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity duration-300">
              {activeLeads.map(lead => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Assignment Modal */}
      <Modal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} title="Assign Lead">
        {selectedLead && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Lead Name</p>
              <p className="text-gray-900 font-semibold bg-gray-50 p-3 rounded-lg border border-gray-200">{selectedLead.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Select Assignee</p>
              <select 
                value={selectedEmpId} 
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg p-3 text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="" disabled>Select an employee...</option>
                {employees.map(emp => (
                  <option key={emp.uid} value={emp.uid}>{emp.email} (Priority: {emp.priority})</option>
                ))}
              </select>
            </div>
            <button
              disabled={!selectedEmpId || isAssigning}
              onClick={handleAssign}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex justify-center items-center"
            >
              {isAssigning ? "Assigning..." : "Confirm Assignment"}
            </button>
          </div>
        )}
      </Modal>

      {/* Expense Modal */}
      <Modal isOpen={isExpenseOpen} onClose={() => setIsExpenseOpen(false)} title="Log Expense">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expense Title</label>
            <input
              type="text"
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3.5 text-gray-900 font-medium focus:ring-2 focus:ring-gray-900 outline-none transition-all"
              placeholder="e.g. Meta Ads August"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount ($)</label>
            <input
              type="number"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3.5 text-gray-900 font-medium focus:ring-2 focus:ring-gray-900 outline-none transition-all"
              placeholder="e.g. 500"
            />
          </div>
          <button
            disabled={!expTitle || !expAmount || isLoggingExp}
            onClick={handleLogExpense}
            className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md mt-4 flex justify-center"
          >
            {isLoggingExp ? "Logging..." : "Log Expense"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
