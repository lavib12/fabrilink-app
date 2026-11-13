import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  Building,
  ShoppingBag,
  Factory,
  Search,
  Eye,
  X,
  FileText,
  DollarSign,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatBDT } from "@/lib/utils";

interface CompanyData {
  id: string;
  name: string;
  company_type: string;
  contact_email: string;
  contact_phone: string;
  verification_status: string;
  trade_license_number: string;
  tin_number: string;
  bin_number: string;
  credit_limit: string | number;
  credit_terms_days: number;
  created_at: string;
}

interface OrderItem {
  id: string;
  roll_code: string;
  roll_title: string;
  requested_yards: string | number;
  unit_price: string | number;
  subtotal: string | number;
}

interface AdminOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  status: string;
  items_subtotal: string | number;
  platform_commission_fee: string | number;
  cutting_fee: string | number;
  total_amount: string | number;
  payment_method: string;
  items: OrderItem[];
  created_at: string;
}

export const AdminKYCPage: React.FC = () => {
  const location = useLocation();

  const getInitialTab = () => {
    if (location.pathname.includes("/orders")) return "orders";
    if (location.pathname.includes("/matching")) return "matching";
    // "/admin/settings" had no content; show the company directory instead of a blank page.
    if (location.pathname.includes("/settings") || location.pathname.includes("/companies"))
      return "companies";
    return "kyc";
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab());
  const [pendingCompanies, setPendingCompanies] = useState<CompanyData[]>([]);
  const [allCompanies, setAllCompanies] = useState<CompanyData[]>([]);
  const [allOrders, setAllOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [sourcingRequests, setSourcingRequests] = useState<
    Array<{
      id: string;
      buyer_name: string;
      fabric_name: string;
      target_gsm: number | null;
      required_yards: string | null;
      color_preference: string;
      status: string;
      created_at: string;
    }>
  >([]);

  // Approval Modal State
  const [approvingCompany, setApprovingCompany] = useState<CompanyData | null>(null);
  const [creditLimit, setCreditLimit] = useState<string>("50000.00");
  const [creditTerms, setCreditTerms] = useState<number>(30);
  const [rejectingCompany, setRejectingCompany] = useState<CompanyData | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pendingRes, allCoRes, ordersRes] = await Promise.all([
        apiClient.get("/companies/admin/kyc-queue/"),
        apiClient.get("/companies/admin/kyc-queue/?status=ALL"),
        apiClient.get("/orders/"),
      ]);
      setPendingCompanies(pendingRes.data.data || []);
      setAllCompanies(allCoRes.data.data || []);
      setAllOrders(ordersRes.data.data || []);
    } catch (err) {
      console.error("Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
    apiClient
      .get("/matching/requests/")
      .then((res) => setSourcingRequests(res.data.data || []))
      .catch(() => setSourcingRequests([]));
  };

  useEffect(() => {
    setActiveTab(getInitialTab());
    fetchData();
  }, [location.pathname]);

  const handleApproveSubmit = async () => {
    if (!approvingCompany) return;
    try {
      setIsProcessing(true);
      await apiClient.post(`/companies/admin/${approvingCompany.id}/verify/`, {
        action: "APPROVE",
        credit_limit: creditLimit,
        credit_terms_days: creditTerms,
      });

      setActionSuccess(`Company "${approvingCompany.name}" successfully approved with ৳${Number(creditLimit).toLocaleString()} credit limit.`);
      setApprovingCompany(null);
      await fetchData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch {
      alert("Failed to approve company.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingCompany) return;
    try {
      setIsProcessing(true);
      await apiClient.post(`/companies/admin/${rejectingCompany.id}/verify/`, {
        action: "REJECT",
        rejection_reason: rejectionReason || "Trade license or TIN verification failed.",
      });

      setActionSuccess(`Company "${rejectingCompany.name}" rejected.`);
      setRejectingCompany(null);
      await fetchData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch {
      alert("Failed to reject company.");
    } finally {
      setIsProcessing(false);
    }
  };

  const verifiedCompanies = allCompanies.filter((c) => c.verification_status === "APPROVED");
  const totalVolume = allOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalCommissions = allOrders.reduce((sum, o) => sum + Number(o.platform_commission_fee || 0), 0);

  return (
    <div className="space-y-8">
      {/* Top Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>FabriLink Central Clearinghouse & Auditing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Central Platform Administration
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Audit Trade Licenses, assign B2B deferred credit limits, monitor platform-wide orders, and manage clearinghouse compliance.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-xl border border-border text-xs font-bold hover:bg-muted self-start"
        >
          Refresh Data
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Pending KYC Queue</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">{pendingCompanies.length}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Require trade license audit</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Verified Partners</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600">{verifiedCompanies.length}</p>
          <p className="text-xs text-muted-foreground font-medium">Garment mills & boutiques active</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Total GMV Volume</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">{formatBDT(totalVolume)}</p>
          <p className="text-xs text-muted-foreground font-medium">{allOrders.length} orders transacted</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Platform Commission</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-primary">{formatBDT(totalCommissions)}</p>
          <p className="text-xs text-muted-foreground font-medium">6% marketplace take-rate</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("kyc")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "kyc"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>KYC Approvals Queue</span>
          {pendingCompanies.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500 text-white font-mono">
              {pendingCompanies.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "orders"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>All Marketplace Orders</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-white font-mono">
            {allOrders.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("companies")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "companies"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>Verified Directory</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-white font-mono">
            {verifiedCompanies.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("matching")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "matching"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>Sourcing Requests</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-white font-mono">
            {sourcingRequests.filter((r) => r.status === "OPEN").length}
          </span>
        </button>
      </div>

      {activeTab === "matching" && (
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Buyer Sourcing Requests</h3>
            <p className="text-xs text-muted-foreground">
              Fabric buyers asked for that isn't in the catalog. Verified mills see open requests and
              can build a custom profile for the buyer.
            </p>
          </div>
          {sourcingRequests.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">No sourcing requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Buyer</th>
                    <th className="py-3 px-4">Fabric</th>
                    <th className="py-3 px-4">GSM</th>
                    <th className="py-3 px-4">Yards</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Posted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sourcingRequests.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-4 font-semibold text-foreground">{r.buyer_name}</td>
                      <td className="py-3 px-4">
                        {r.fabric_name}
                        {r.color_preference ? (
                          <span className="block text-muted-foreground">{r.color_preference}</span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 tabular-nums">{r.target_gsm ?? "—"}</td>
                      <td className="py-3 px-4 tabular-nums">
                        {r.required_yards ? Number(r.required_yards) : "—"}
                      </td>
                      <td className="py-3 px-4">{r.status}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Intl.DateTimeFormat("en-BD", { dateStyle: "medium" }).format(
                          new Date(r.created_at)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: KYC Queue */}
      {activeTab === "kyc" && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center text-xs text-muted-foreground">Loading KYC queue...</div>
          ) : pendingCompanies.length === 0 ? (
            <div className="bg-card p-16 rounded-3xl border border-border text-center space-y-3 shadow-sm">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-foreground">All Verification Requests Cleared</h3>
              <p className="text-xs text-muted-foreground">There are currently no mills or boutiques waiting for KYC approval.</p>
            </div>
          ) : (
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                    <tr>
                      <th className="py-3.5 px-4">Company Name</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Contact Details</th>
                      <th className="py-3.5 px-4">Trade License / TIN</th>
                      <th className="py-3.5 px-4 text-right">KYC Audit Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pendingCompanies.map((co) => (
                      <tr key={co.id} className="hover:bg-muted/20">
                        <td className="py-4 px-4 font-bold text-foreground">
                          {co.name}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              co.company_type === "FACTORY"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-blue-500/10 text-blue-600"
                            }`}
                          >
                            {co.company_type}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-muted-foreground">
                          <p className="text-foreground font-semibold">{co.contact_email}</p>
                          <p>{co.contact_phone}</p>
                        </td>
                        <td className="py-4 px-4 font-mono">
                          <p className="font-bold text-foreground">
                            {co.trade_license_number || "Trade License Pending"}
                          </p>
                          {co.tin_number && <p className="text-[11px] text-muted-foreground">TIN: {co.tin_number}</p>}
                        </td>
                        <td className="py-4 px-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setApprovingCompany(co);
                              setCreditLimit(co.company_type === "BUYER" ? "50000.00" : "0.00");
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-sm"
                          >
                            Approve & Set Credit
                          </button>
                          <button
                            onClick={() => setRejectingCompany(co)}
                            className="px-3.5 py-1.5 rounded-xl bg-destructive text-white font-bold text-xs hover:bg-destructive/90 transition-all shadow-sm"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: All Marketplace Orders */}
      {activeTab === "orders" && (
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Platform-wide Surplus Fabric Orders</h3>
            <p className="text-xs text-muted-foreground">
              Live audit of every breakdown purchase across Bangladesh garment mills and boutiques
            </p>
          </div>

          {allOrders.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">No orders recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Boutique Buyer</th>
                    <th className="py-3 px-4">Items / Rolls</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-muted/20">
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">{ord.order_number}</td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">{ord.buyer_name}</td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {ord.items.map((i) => `${i.requested_yards} yds of ${i.roll_code}`).join(", ")}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-foreground">{ord.payment_method}</td>
                      <td className="py-3.5 px-4 font-extrabold text-foreground">{formatBDT(Number(ord.total_amount))}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                          {ord.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Verified Companies Directory */}
      {activeTab === "companies" && (
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Verified RMG Mills & Boutique Partners</h3>
            <p className="text-xs text-muted-foreground">
              Directory of audited trading entities operating on FabriLink
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Entity Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Trade License</th>
                  <th className="py-3 px-4">B2B Credit Line</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {verifiedCompanies.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="py-3.5 px-4 font-bold text-foreground">{c.name}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground">
                        {c.company_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{c.contact_email}</td>
                    <td className="py-3.5 px-4 font-mono">{c.trade_license_number || "Verified by Dhaka City Corp"}</td>
                    <td className="py-3.5 px-4 font-extrabold text-primary">
                      {Number(c.credit_limit) > 0 ? formatBDT(Number(c.credit_limit)) : "Cash in Advance"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                        VERIFIED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-start pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-base text-foreground">Approve KYC & Assign Credit</h3>
                <p className="text-xs text-muted-foreground">{approvingCompany.name}</p>
              </div>
              <button
                onClick={() => setApprovingCompany(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1">
                <p className="font-bold text-foreground">Audit Summary:</p>
                <p>Type: {approvingCompany.company_type}</p>
                <p>Trade License: {approvingCompany.trade_license_number || "Not provided (Overriding manually)"}</p>
                <p>Contact: {approvingCompany.contact_email}</p>
              </div>

              {approvingCompany.company_type === "BUYER" && (
                <>
                  <div className="space-y-1">
                    <label className="font-bold text-foreground">Approved B2B Credit Limit (BDT)</label>
                    <input
                      type="number"
                      step="5000"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      placeholder="50000.00"
                      className="w-full px-3 py-2 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none font-bold"
                    />
                    <p className="text-[10px] text-muted-foreground">Standard boutique tier: ৳50,000</p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground">Payment Terms (Days)</label>
                    <select
                      value={creditTerms}
                      onChange={(e) => setCreditTerms(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                      <option value={15}>Net 15 Days</option>
                      <option value={30}>Net 30 Days</option>
                      <option value={45}>Net 45 Days</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApprovingCompany(null)}
                className="px-4 py-2 rounded-xl border border-border text-foreground font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSubmit}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Confirm Verification"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-foreground">Reject KYC Application</h3>
            <p className="text-xs text-muted-foreground">
              Provide feedback for {rejectingCompany.name} to upload valid trade documentation.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Trade license expired in 2024. Please re-upload updated renewal receipt."
              className="w-full p-3 rounded-xl border border-input bg-card text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingCompany(null)}
                className="px-4 py-2 rounded-xl border border-border text-foreground font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-destructive text-white font-bold text-xs hover:bg-destructive/90 transition-all disabled:opacity-50"
              >
                {isProcessing ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
