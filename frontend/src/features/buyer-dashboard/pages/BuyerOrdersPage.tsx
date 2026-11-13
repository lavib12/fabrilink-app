import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShoppingBag,
  ArrowRight,
  Clock,
  CheckCircle2,
  Scissors,
  Truck,
  Package,
  ShieldCheck,
  CreditCard,
  FileCheck,
  Sparkles,
  AlertCircle,
  Building,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatBDT } from "@/lib/utils";
import { useAuthStore } from "@/features/auth/store";

interface SourcingRequestData {
  id: string;
  fabric_name: string;
  target_gsm: number | null;
  required_yards: string | null;
  color_preference: string;
  notes: string;
  status: "OPEN" | "FULFILLED" | "CLOSED";
  created_at: string;
}

interface CreditSummary {
  credit_limit: string;
  outstanding: string;
  available: string;
  credit_terms_days: number;
  credit_status: string;
  can_use_credit: boolean;
}

interface OrderItem {
  id: string;
  roll_code: string;
  roll_title: string;
  color_name: string;
  color_hex?: string;
  primary_image?: string;
  requested_yards: string | number;
  unit_price: string | number;
  subtotal: string | number;
  status: string;
}

interface TrackingEvent {
  id: string;
  from_status?: string;
  to_status: string;
  title: string;
  description: string;
  location: string;
  created_at: string;
}

interface OrderData {
  id: string;
  order_number: string;
  status: string;
  items_subtotal: string | number;
  platform_commission_fee: string | number;
  cutting_fee: string | number;
  delivery_fee: string | number;
  vat_tax_amount: string | number;
  total_amount: string | number;
  currency: string;
  payment_method: string;
  delivery_notes?: string;
  items: OrderItem[];
  tracking_events: TrackingEvent[];
  created_at: string;
}

interface CustomFabricProfile {
  id: string;
  roll_code: string;
  title: string;
  fabric_type_name: string;
  mill_name: string;
  factory_id: string;
  mill_location: string;
  composition: string;
  gsm: number;
  width_inches: number | string;
  color_name: string;
  color_hex: string;
  pattern: string;
  finish: string;
  available_yards: number | string;
  min_cut_length_yards: number | string;
  price_per_yard: number | string;
  quality_grade: string;
  buyer_spec_notes?: string;
  primary_image?: string;
  created_at: string;
}

export const BuyerOrdersPage: React.FC = () => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const getInitialTab = () => {
    if (location.pathname.includes("/credit")) return "credit";
    if (location.pathname.includes("/requests")) return "requests";
    if (location.pathname.includes("/profiles")) return "profiles";
    return "orders";
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab());
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [customProfiles, setCustomProfiles] = useState<CustomFabricProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom Request Form
  const [sourcingRequest, setSourcingRequest] = useState({
    fabric_name: "",
    target_gsm: "180",
    required_yards: "50",
    color_preference: "",
    notes: "",
  });
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [myRequests, setMyRequests] = useState<SourcingRequestData[]>([]);
  const [credit, setCredit] = useState<CreditSummary | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const [ordersRes, profilesRes] = await Promise.all([
        apiClient.get("/orders/"),
        apiClient.get("/catalog/rolls/?custom_only=true"),
      ]);
      setOrders(ordersRes.data.data || []);
      setCustomProfiles(profilesRes.data.data || []);
    } catch (err) {
      console.error("Error fetching orders", err);
    } finally {
      setLoading(false);
    }
    // Secondary panels load independently so one failure doesn't blank the page.
    apiClient
      .get("/matching/requests/")
      .then((res) => setMyRequests(res.data.data || []))
      .catch(() => setMyRequests([]));
    apiClient
      .get("/orders/credit/")
      .then((res) => setCredit(res.data.data))
      .catch(() => setCredit(null));
  };

  useEffect(() => {
    setActiveTab(getInitialTab());
    fetchOrders();
  }, [location.pathname]);

  const handleSourcingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    setIsSubmittingRequest(true);
    try {
      const res = await apiClient.post("/matching/requests/", {
        fabric_name: sourcingRequest.fabric_name,
        target_gsm: sourcingRequest.target_gsm ? Number(sourcingRequest.target_gsm) : null,
        required_yards: sourcingRequest.required_yards || null,
        color_preference: sourcingRequest.color_preference,
        notes: sourcingRequest.notes,
      });
      setMyRequests((prev) => [res.data.data, ...prev]);
      setRequestSubmitted(true);
      setSourcingRequest({
        fabric_name: "",
        target_gsm: "180",
        required_yards: "50",
        color_preference: "",
        notes: "",
      });
      setTimeout(() => setRequestSubmitted(false), 4000);
    } catch (err: any) {
      setRequestError(err.response?.data?.error?.message || "Couldn't post your request. Try again.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCloseRequest = async (id: string) => {
    try {
      const res = await apiClient.post(`/matching/requests/${id}/close/`, {});
      setMyRequests((prev) => prev.map((r) => (r.id === id ? res.data.data : r)));
    } catch (err: any) {
      alert(err.response?.data?.error?.message || "Couldn't close this request.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID_CREDIT_APPROVED":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            PAID • HOLD CONFIRMED
          </span>
        );
      case "AT_HUB":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            RECEIVED AT TEJGAON HUB
          </span>
        );
      case "CUTTING":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            PRECISION CUTTING IN PROGRESS
          </span>
        );
      case "PACKED":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            CUT COMPLETE • PACKED & TAGGED
          </span>
        );
      case "OUT_FOR_DELIVERY":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
            COURIER EN ROUTE TO BOUTIQUE
          </span>
        );
      case "DELIVERED":
      case "COMPLETED":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            DELIVERED & VERIFIED
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
            {status.replace("_", " ")}
          </span>
        );
    }
  };

  // Server-computed: only unsettled B2B-credit orders count against the limit.
  const creditLimitNum = Number(credit?.credit_limit ?? user?.company?.credit_limit ?? 0);
  const availableCredit = Number(credit?.available ?? 0);
  const creditTerms = credit?.credit_terms_days || 30;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Boutique Buyer Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {user?.company?.name || "Boutique"} Orders & Logistics
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Track small-batch precision machine cuts, dispatch status, and manage your B2B credit line.
          </p>
        </div>

        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary/90 transition-all self-start"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Browse Surplus Rolls</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "orders"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>My Orders</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-white font-mono">
            {orders.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("profiles")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "profiles"
              ? "bg-purple-600 text-white shadow-sm shadow-purple-500/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Exclusive Profiles</span>
          {customProfiles.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/20 text-white font-mono font-bold">
              {customProfiles.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("credit")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "credit"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>B2B Credit Line</span>
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "requests"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Custom Sourcing Request</span>
        </button>
      </div>

      {/* Tab: Exclusive Fabric Profiles Built for Buyer */}
      {activeTab === "profiles" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-purple-500/10 via-purple-600/5 to-indigo-500/10 border border-purple-500/20">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-600 text-white text-[11px] font-bold mb-2">
                <Sparkles className="w-3 h-3" />
                <span>Dedicated Merchandiser Formulations</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
                Fabric Profiles Built Specifically for {user?.company?.name || "Your Boutique"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                Garment mills formulated these exclusive rolls and small-batch fabric profiles tailored to your boutique's specs. You have priority breakdown cutting access.
              </p>
            </div>

            <button
              onClick={() => setActiveTab("requests")}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm shadow-purple-500/20 transition-all self-start whitespace-nowrap"
            >
              Request Custom Sourcing
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">Loading your exclusive fabric profiles...</p>
            </div>
          ) : customProfiles.length === 0 ? (
            <div className="bg-card rounded-3xl border border-border p-16 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 mx-auto flex items-center justify-center">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">No Custom Profiles Formulated Yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  When export garment factories build dedicated fabric profiles or reserve custom surplus formulations for your boutique, they will appear here with exclusive pricing.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab("requests")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Submit Sourcing Request</span>
                </button>
                <Link
                  to="/catalog"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-all"
                >
                  <span>Browse General Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {customProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-card rounded-3xl border-2 border-purple-500/30 hover:border-purple-500/60 p-6 shadow-sm transition-all duration-300 flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    {/* Top Row: Mill & Code */}
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/stores/${profile.factory_id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors group/mill"
                      >
                        <Building className="w-3.5 h-3.5 text-primary" />
                        <span className="group-hover/mill:underline">{profile.mill_name}</span>
                      </Link>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                        {profile.roll_code}
                      </span>
                    </div>

                    {/* Real Fabric Image Banner */}
                    <div className="h-36 w-full rounded-2xl overflow-hidden relative bg-muted shadow-2xs">
                      <img
                        src={
                          profile.primary_image ||
                          "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=600&q=80"
                        }
                        alt={profile.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=600&q=80";
                        }}
                      />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white text-[10px]">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-white"
                          style={{ backgroundColor: profile.color_hex }}
                        />
                        <span>{profile.color_name}</span>
                      </div>
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-purple-600 text-white text-[10px] font-bold shadow-xs">
                        {formatBDT(Number(profile.price_per_yard))}/yd
                      </div>
                    </div>

                    {/* Title & Type */}
                    <div>
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-600/10 text-purple-600 text-[10px] font-extrabold mb-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Exclusive for {user?.company?.name}</span>
                      </div>
                      <h3 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors">
                        {profile.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {profile.composition} • {profile.fabric_type_name}
                      </p>
                    </div>

                    {/* Specs Pills */}
                    <div className="grid grid-cols-3 gap-2 py-2 text-center text-xs border-y border-border/60">
                      <div className="p-1.5 rounded-xl bg-muted/40">
                        <span className="text-[10px] text-muted-foreground block">Weight</span>
                        <span className="font-bold text-foreground">{profile.gsm} GSM</span>
                      </div>
                      <div className="p-1.5 rounded-xl bg-muted/40">
                        <span className="text-[10px] text-muted-foreground block">Width</span>
                        <span className="font-bold text-foreground">{profile.width_inches}"</span>
                      </div>
                      <div className="p-1.5 rounded-xl bg-muted/40">
                        <span className="text-[10px] text-muted-foreground block">Available</span>
                        <span className="font-bold text-primary">{Number(profile.available_yards)} Yds</span>
                      </div>
                    </div>

                    {/* Merchandiser Spec Notes */}
                    {profile.buyer_spec_notes && (
                      <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-foreground/90 font-mono">
                        <span className="font-bold text-purple-600 dark:text-purple-400 block mb-1">
                          Merchandiser Formulation Note:
                        </span>
                        {profile.buyer_spec_notes}
                      </div>
                    )}
                  </div>

                  {/* Pricing & CTA */}
                  <div className="pt-4 border-t border-border flex items-center justify-between">
                    <div>
                      <span className="text-lg font-black text-primary">
                        {formatBDT(profile.price_per_yard)}
                      </span>
                      <span className="text-[10px] text-muted-foreground"> / yard</span>
                      <p className="text-[10px] text-muted-foreground">
                        Min Cut: {profile.min_cut_length_yards} Yds
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/stores/${profile.factory_id}`}
                        className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Visit Mill Storefront"
                      >
                        <Building className="w-4 h-4" />
                      </Link>
                      <Link
                        to={`/catalog/${profile.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Order Cuts</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Orders List */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">Loading your orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-card rounded-3xl border border-border p-16 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">No Active Orders Yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Browse export garment surplus rolls in the catalog, choose your custom length, and request precision cuts.
                </p>
              </div>
              <Link
                to="/catalog"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-2"
              >
                <span>Explore Catalog Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const isPaid = [
                  "PAID_CREDIT_APPROVED",
                  "PICKUP_SCHEDULED",
                  "PICKED_UP",
                  "AT_HUB",
                  "CUTTING",
                  "CUT_DONE",
                  "PACKED",
                  "OUT_FOR_DELIVERY",
                  "DELIVERED",
                  "COMPLETED",
                ].includes(order.status);
                const isAtHubOrCutting = [
                  "AT_HUB",
                  "CUTTING",
                  "CUT_DONE",
                  "PACKED",
                  "OUT_FOR_DELIVERY",
                  "DELIVERED",
                  "COMPLETED",
                ].includes(order.status);
                const isCutDone = [
                  "CUT_DONE",
                  "PACKED",
                  "OUT_FOR_DELIVERY",
                  "DELIVERED",
                  "COMPLETED",
                ].includes(order.status);
                const isDelivered = ["DELIVERED", "COMPLETED"].includes(order.status);

                return (
                  <div
                    key={order.id}
                    className="bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-extrabold text-lg text-foreground">
                            {order.order_number}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Placed on {new Date(order.created_at).toLocaleDateString()} • Payment:{" "}
                          <span className="font-semibold text-foreground">{order.payment_method}</span>
                          {order.delivery_notes && (
                            <span> • Note: {order.delivery_notes}</span>
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">Total Paid: </span>
                        <span className="text-2xl font-extrabold text-foreground">
                          {formatBDT(Number(order.total_amount))}
                        </span>
                      </div>
                    </div>

                    {/* Cut Pieces */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Purchased Cut Pieces
                      </p>
                      <div className="divide-y divide-border/60">
                        {order.items.map((item) => (
                          <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-xl border border-border flex-shrink-0 flex items-center justify-center shadow-2xs font-mono text-[10px] font-bold text-white drop-shadow-xs"
                                style={{ backgroundColor: item.color_hex || "#334155" }}
                              >
                                {item.roll_code.slice(-3)}
                              </div>
                              <div className="space-y-0.5">
                                <p className="font-bold text-foreground text-sm">{item.roll_title}</p>
                                <p className="text-muted-foreground font-mono">
                                  Roll Code: {item.roll_code} • Color: {item.color_name}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-extrabold text-foreground text-sm">
                                {item.requested_yards} Yards
                              </p>
                              <p className="text-muted-foreground">
                                {formatBDT(Number(item.unit_price))} /yd = {formatBDT(Number(item.subtotal))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Lifecycle Progress Bar */}
                    <div className="bg-muted/30 p-5 rounded-2xl border border-border/80 space-y-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-primary" />
                        Live Order Fulfillment Timeline
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        {/* Step 1 */}
                        <div
                          className={`p-3 rounded-xl border transition-all ${
                            isPaid
                              ? "bg-card border-emerald-500/30 text-emerald-600"
                              : "bg-muted/40 border-border text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 font-bold mb-1">
                            <CheckCircle2 className="w-4 h-4" />
                            1. Stock Hold Locked
                          </div>
                          <p className="text-[11px] text-muted-foreground">Payment escrow secured</p>
                        </div>

                        {/* Step 2 */}
                        <div
                          className={`p-3 rounded-xl border transition-all ${
                            isAtHubOrCutting
                              ? "bg-card border-primary/30 text-primary"
                              : "bg-muted/40 border-border text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 font-bold mb-1">
                            <Truck className="w-4 h-4" />
                            2. Mill Shuttle
                          </div>
                          <p className="text-[11px] text-muted-foreground">Received at Tejgaon Hub</p>
                        </div>

                        {/* Step 3 */}
                        <div
                          className={`p-3 rounded-xl border transition-all ${
                            isCutDone
                              ? "bg-card border-emerald-500/30 text-emerald-600"
                              : "bg-muted/40 border-border text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 font-bold mb-1">
                            <Scissors className="w-4 h-4" />
                            3. Precision Cut
                          </div>
                          <p className="text-[11px] text-muted-foreground">Laser cut & barcode tagged</p>
                        </div>

                        {/* Step 4 */}
                        <div
                          className={`p-3 rounded-xl border transition-all ${
                            isDelivered
                              ? "bg-card border-emerald-500/30 text-emerald-600"
                              : "bg-muted/40 border-border text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 font-bold mb-1">
                            <Package className="w-4 h-4" />
                            4. Handover
                          </div>
                          <p className="text-[11px] text-muted-foreground">Delivered to boutique</p>
                        </div>
                      </div>

                      {order.tracking_events && order.tracking_events.length > 0 && (
                        <div className="pt-2 text-xs text-muted-foreground space-y-1">
                          <p className="font-semibold text-foreground">Latest Event Telemetry:</p>
                          <div className="space-y-1">
                            {order.tracking_events.map((ev) => (
                              <p key={ev.id} className="text-[11px]">
                                • <strong className="text-foreground">{ev.title}</strong> — {ev.description} ({ev.location})
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: B2B Credit Line */}
      {activeTab === "credit" && (
        <div className="bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <span>B2B Deferred Credit Line (Net 30)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Purchase surplus fabric rolls with zero upfront deposit. Settle monthly after cutting garments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-1 text-xs">
              <p className="text-muted-foreground font-semibold">Approved Credit Limit</p>
              <p className="text-2xl font-extrabold text-foreground">{formatBDT(creditLimitNum)}</p>
              <p
                className={`text-[11px] font-semibold ${
                  credit?.can_use_credit ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                {creditLimitNum > 0
                  ? credit?.can_use_credit
                    ? "Active"
                    : "Limit reached"
                  : "No credit line yet. Ask FabriLink to review your account."}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-1 text-xs">
              <p className="text-muted-foreground font-semibold">Available to Spend</p>
              <p className="text-2xl font-extrabold text-primary">{formatBDT(availableCredit)}</p>
              <p className="text-[11px] text-muted-foreground">
                {formatBDT(Number(credit?.outstanding ?? 0))} owed on unsettled credit orders
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-1 text-xs">
              <p className="text-muted-foreground font-semibold">Payment Terms</p>
              <p className="text-2xl font-extrabold text-foreground">Net {creditTerms} Days</p>
              <p className="text-[11px] text-muted-foreground">Interest-free trade credit</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2 text-xs">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>How FabriLink Credit Financing Works:</span>
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              When ordering fabric breakdown yardage, choose <strong>"B2B 30-Day Credit Line"</strong> at checkout. FabriLink Central Clearing guarantees mill payments while you manufacture small-batch fashion capsules and sell in your boutique. Settle invoices within 30 days via bKash, Nagad, or BEFTN bank transfer.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Custom Sourcing Requests */}
      {activeTab === "requests" && (
        <div className="bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              <span>Custom Fabric Sourcing Request</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Can't find a specific export weave in the catalog? Post your custom yardage requirement directly to RMG factory merchandisers.
            </p>
          </div>

          {requestSubmitted && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Request posted. Verified mills can now see it and build a fabric profile for you.</span>
            </div>
          )}
          {requestError && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{requestError}</span>
            </div>
          )}

          <form onSubmit={handleSourcingSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Desired Fabric Construction *</label>
                <input
                  type="text"
                  required
                  value={sourcingRequest.fabric_name}
                  onChange={(e) => setSourcingRequest({ ...sourcingRequest, fabric_name: e.target.value })}
                  placeholder="e.g. 100% French Flax Linen or Tencel Twill"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Target GSM</label>
                <input
                  type="number"
                  value={sourcingRequest.target_gsm}
                  onChange={(e) => setSourcingRequest({ ...sourcingRequest, target_gsm: e.target.value })}
                  placeholder="180"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Estimated Yardage Needed</label>
                <input
                  type="number"
                  value={sourcingRequest.required_yards}
                  onChange={(e) => setSourcingRequest({ ...sourcingRequest, required_yards: e.target.value })}
                  placeholder="50"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Color / Pattern Preferences</label>
                <input
                  type="text"
                  value={sourcingRequest.color_preference}
                  onChange={(e) => setSourcingRequest({ ...sourcingRequest, color_preference: e.target.value })}
                  placeholder="e.g. Sage Green, Terracotta, or Yarn-Dye Stripe"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-foreground">Additional Garment Application Notes</label>
                <textarea
                  rows={3}
                  value={sourcingRequest.notes}
                  onChange={(e) => setSourcingRequest({ ...sourcingRequest, notes: e.target.value })}
                  placeholder="e.g. Need lightweight breathable weave for Eid capsule collection."
                  className="w-full p-3 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingRequest}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-60"
            >
              {isSubmittingRequest ? "Posting…" : "Post Request to Mills"}
            </button>
          </form>

          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-bold text-foreground">Your Requests</h4>
            {myRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                You haven't posted any requests yet. Requests you post appear here.
              </p>
            ) : (
              myRequests.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{r.fabric_name}</p>
                    <p className="text-muted-foreground">
                      {[
                        r.target_gsm ? `${r.target_gsm} GSM` : null,
                        r.required_yards ? `${Number(r.required_yards)} yds` : null,
                        r.color_preference || null,
                      ]
                        .filter(Boolean)
                        .join(", ") || "No extra specs"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        r.status === "OPEN"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status === "OPEN" ? "Open" : r.status === "FULFILLED" ? "Fulfilled" : "Closed"}
                    </span>
                    {r.status === "OPEN" && (
                      <button
                        type="button"
                        onClick={() => handleCloseRequest(r.id)}
                        className="px-3 py-1.5 rounded-lg border border-border font-semibold hover:bg-muted"
                      >
                        Close Request
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
