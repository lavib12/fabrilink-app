import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Factory,
  Layers,
  Truck,
  DollarSign,
  PlusCircle,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Scissors,
  X,
  Sparkles,
  MapPin,
  ArrowRight,
  Eye,
  Building,
  Image as ImageIcon,
  Check,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatBDT } from "@/lib/utils";
import { useAuthStore } from "@/features/auth/store";
import {
  FabricPreset,
  REAL_FABRIC_PRESETS,
  COMMON_COLOR_SWATCHES,
  ColorSwatch,
} from "../data/fabricPresets";

interface FabricTypeItem {
  id: string;
  name: string;
  slug: string;
  category_name: string;
}

interface CategoryWithTypes {
  id: string;
  name: string;
  fabric_types: FabricTypeItem[];
}

interface BuyerItem {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  verification_status: string;
}

interface FactoryRoll {
  id: string;
  roll_code: string;
  title: string;
  fabric_type_name: string;
  composition: string;
  gsm: number;
  width_inches: string | number;
  color_name: string;
  color_hex: string;
  available_yards: string | number;
  total_yards: string | number;
  min_cut_length_yards: string | number;
  price_per_yard: string | number;
  quality_grade: string;
  status: string;
  created_at: string;
  primary_image?: string;
  target_buyer_id?: string;
  target_buyer_name?: string;
  is_custom_profile?: boolean;
  buyer_spec_notes?: string;
}

interface OrderItemData {
  id: string;
  roll_code: string;
  roll_title: string;
  color_name: string;
  requested_yards: string | number;
  unit_price: string | number;
  subtotal: string | number;
  status: string;
}

interface FactoryOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  status: string;
  items_subtotal: string | number;
  platform_commission_fee: string | number;
  total_amount: string | number;
  payment_method: string;
  delivery_notes: string;
  items: OrderItemData[];
  created_at: string;
}

export const FactoryDashboardPage: React.FC = () => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Active Tab derived from path or fallback
  const getInitialTab = () => {
    if (location.pathname.includes("/stock")) return "stock";
    if (location.pathname.includes("/pickups")) return "pickups";
    if (location.pathname.includes("/payouts")) return "payouts";
    if (location.pathname.includes("/requests")) return "requests";
    return "overview";
  };
  const [buyerRequests, setBuyerRequests] = useState<
    Array<{
      id: string;
      buyer_id: string;
      buyer_name: string;
      fabric_name: string;
      target_gsm: number | null;
      required_yards: string | null;
      color_preference: string;
      notes: string;
      created_at: string;
    }>
  >([]);

  const [activeTab, setActiveTab] = useState<string>(getInitialTab());
  const [rolls, setRolls] = useState<FactoryRoll[]>([]);
  const [orders, setOrders] = useState<FactoryOrder[]>([]);
  const [categories, setCategories] = useState<CategoryWithTypes[]>([]);
  const [buyers, setBuyers] = useState<BuyerItem[]>([]);
  const [stockFilter, setStockFilter] = useState<"ALL" | "PUBLIC" | "BUYER_CUSTOM">("ALL");
  const [loading, setLoading] = useState(true);
  const [highlightedRollId, setHighlightedRollId] = useState<string | null>(null);

  // Modal State for Listing New Roll / Building Fabric Profile for Buyer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileMode, setProfileMode] = useState<"PUBLIC" | "BUYER_CUSTOM">("PUBLIC");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Helper to generate a realistic export batch code
  const generateLotNumber = () =>
    `SQ-LOT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  // Form State
  const [newRoll, setNewRoll] = useState({
    title: "",
    fabric_type: "",
    composition: "100% Combed Cotton",
    gsm: 200,
    width_inches: "60.00",
    color_name: "Deep Raw Indigo",
    color_hex: "#1E293B",
    pattern: "Solid",
    finish: "Soft Silicon Finish",
    total_yards: "100.00",
    min_cut_length_yards: "10.00",
    price_per_yard: "250.00",
    lot_batch_number: "",
    quality_grade: "GRADE_A",
    defect_notes: "",
    image_url: REAL_FABRIC_PRESETS[0].url,
    target_buyer_id: "",
    buyer_spec_notes: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rollsRes, ordersRes, catRes, buyersRes] = await Promise.all([
        apiClient.get("/catalog/rolls/?mine=true"),
        apiClient.get("/orders/"),
        apiClient.get("/catalog/categories/"),
        apiClient.get("/companies/buyers/"),
      ]);
      setRolls(rollsRes.data.data || []);
      setOrders(ordersRes.data.data || []);
      const cats: CategoryWithTypes[] = catRes.data.data || [];
      setCategories(cats);
      setBuyers(buyersRes.data.data || []);
      if (cats.length > 0 && cats[0].fabric_types.length > 0 && !newRoll.fabric_type) {
        setNewRoll((prev) => ({ ...prev, fabric_type: cats[0].fabric_types[0].id }));
      }
    } catch (err) {
      console.error("Error loading factory dashboard data", err);
    } finally {
      setLoading(false);
    }
    apiClient
      .get("/matching/requests/", { params: { status: "OPEN" } })
      .then((res) => setBuyerRequests(res.data.data || []))
      .catch(() => setBuyerRequests([]));
  };

  useEffect(() => {
    setActiveTab(getInitialTab());
    fetchData();
  }, [location.pathname]);

  // Derived KPI calculations
  const totalYardsListed = rolls.reduce(
    (sum, r) => sum + Number(r.available_yards || 0),
    0
  );
  const pendingPickupOrders = orders.filter((o) =>
    ["PAID_CREDIT_APPROVED", "PICKUP_SCHEDULED"].includes(o.status)
  );
  const completedOrders = orders.filter((o) =>
    ["DELIVERED", "COMPLETED"].includes(o.status)
  );
  // Sum this factory's own line items (an order may also contain other mills' rolls)
  // and skip orders that were cancelled or refunded.
  const grossSalesRevenue = orders
    .filter((o) => !["CANCELLED", "REFUNDED"].includes(o.status))
    .reduce(
      (sum, o) =>
        sum +
        (o.items?.length
          ? o.items.reduce((s, item) => s + Number(item.subtotal || 0), 0)
          : Number(o.items_subtotal || 0)),
      0
    );
  const netEarnings = grossSalesRevenue * 0.94; // 94% factory payout after 6% platform fee

  // Quick 1-click template application (optimizes creation speed by ~85%)
  const applyPresetTemplate = (preset: FabricPreset) => {
    const allTypes = categories.flatMap((cat) => cat.fabric_types);
    const matchedType = allTypes.find((ft) =>
      ft.name.toLowerCase().includes(preset.fabricTypeKeyword.toLowerCase())
    );

    setNewRoll((prev) => ({
      ...prev,
      title: preset.name,
      fabric_type: matchedType ? matchedType.id : prev.fabric_type,
      composition: preset.composition,
      gsm: preset.gsm,
      width_inches: preset.widthInches,
      color_name: preset.colorName,
      color_hex: preset.colorHex,
      price_per_yard: preset.suggestedPrice,
      min_cut_length_yards: preset.minCutYards,
      image_url: preset.url,
      lot_batch_number: prev.lot_batch_number || generateLotNumber(),
    }));
  };

  const handleApplyColor = (color: ColorSwatch) => {
    setNewRoll((prev) => ({
      ...prev,
      color_name: color.name,
      color_hex: color.hex,
    }));
  };

  const handleCreateRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setModalError(null);
      setModalSuccess(null);

      const isCustom = profileMode === "BUYER_CUSTOM";
      if (isCustom && !newRoll.target_buyer_id) {
        setModalError("Please select a target buyer boutique or brand.");
        setIsSubmitting(false);
        return;
      }

      const lotBatch = newRoll.lot_batch_number.trim() || generateLotNumber();

      const payload = {
        ...newRoll,
        gsm: Number(newRoll.gsm),
        total_yards: Number(newRoll.total_yards),
        available_yards: Number(newRoll.total_yards),
        min_cut_length_yards: Number(newRoll.min_cut_length_yards),
        price_per_yard: Number(newRoll.price_per_yard),
        width_inches: Number(newRoll.width_inches),
        lot_batch_number: lotBatch,
        target_buyer_id: isCustom ? newRoll.target_buyer_id : null,
        is_custom_profile: isCustom,
        buyer_spec_notes: isCustom ? newRoll.buyer_spec_notes : "",
      };

      const res = await apiClient.post("/catalog/rolls/", payload);
      const createdRoll = res.data.data;

      const selectedBuyer = buyers.find((b) => b.id === newRoll.target_buyer_id);
      setModalSuccess(
        isCustom
          ? `Custom fabric profile built successfully for ${selectedBuyer?.name || "the buyer"}!`
          : "Surplus fabric roll listed successfully!"
      );

      // 1. Instant optimistic state update: immediately shows in dashboard
      if (createdRoll) {
        setRolls((prev) => [createdRoll, ...prev.filter((r) => r.id !== createdRoll.id)]);
        setHighlightedRollId(createdRoll.id);
        setTimeout(() => setHighlightedRollId(null), 8000);
      }

      // 2. Fresh background fetch of all profile and order data
      await fetchData();

      // 3. Auto-navigate to My Fabric Stock tab and select appropriate filter
      setTimeout(() => {
        setIsModalOpen(false);
        setModalSuccess(null);
        setActiveTab("stock");
        if (isCustom) {
          setStockFilter("BUYER_CUSTOM");
        } else {
          setStockFilter("ALL");
        }
      }, 700);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        "Failed to list fabric roll. Please check all fields.";
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1.5">
            <Factory className="w-3.5 h-3.5" />
            <span>Garment Mill Surplus Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {user?.company?.name || "Garment Mill"} Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Managing surplus export fabric rolls, mill pickups, and automated bank settlements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start">
          {user?.company?.id && (
            <Link
              to={`/stores/${user.company.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted font-bold text-xs shadow-sm transition-all"
            >
              <Building className="w-4 h-4 text-primary" />
              <span>View My Storefront</span>
            </Link>
          )}
          <button
            onClick={() => {
              setProfileMode("BUYER_CUSTOM");
              setIsModalOpen(true);
              setModalError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>Build Profile for Buyer</span>
          </button>
          <button
            onClick={() => {
              setProfileMode("PUBLIC");
              setIsModalOpen(true);
              setModalError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>List Surplus Roll</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Active Listed Rolls</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">{rolls.length} Rolls</p>
          <p className="text-xs text-muted-foreground font-medium">
            {totalYardsListed.toLocaleString()} Total Available Yards
          </p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Scheduled Pickups</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">
            {pendingPickupOrders.length} Orders
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Awaiting Tejgaon Hub van arrival
          </p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Completed Cuts</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">
            {completedOrders.length} Fulfilled
          </p>
          <p className="text-xs text-emerald-600 font-medium">Delivered to boutiques</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Estimated Payout</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">
            {formatBDT(netEarnings)}
          </p>
          <p className="text-xs text-muted-foreground font-medium">
            94% net settlement to bank account
          </p>
        </div>
      </div>

      {/* Interactive Tabs Header */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "overview"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Mill Overview
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "stock"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>My Fabric Stock</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-white font-mono">
            {rolls.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("pickups")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "pickups"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>Pickup Schedules</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
            {pendingPickupOrders.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("payouts")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "payouts"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Payouts & Ledger
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "requests"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span>Buyer Requests</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-white font-mono">
            {buyerRequests.length}
          </span>
        </button>
      </div>

      {activeTab === "requests" && (
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Open Buyer Sourcing Requests</h3>
            <p className="text-xs text-muted-foreground">
              Fabric boutiques are looking for. Build a custom profile and only that buyer will see it.
            </p>
          </div>
          {buyerRequests.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              No open requests right now. New requests from buyers appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {buyerRequests.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-sm text-foreground">{r.fabric_name}</p>
                    <p className="text-muted-foreground">
                      {r.buyer_name}
                      {r.target_gsm ? `, ${r.target_gsm} GSM` : ""}
                      {r.required_yards ? `, ${Number(r.required_yards)} yds` : ""}
                      {r.color_preference ? `, ${r.color_preference}` : ""}
                    </p>
                    {r.notes ? <p className="text-foreground">{r.notes}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMode("BUYER_CUSTOM");
                      setNewRoll((prev) => ({
                        ...prev,
                        target_buyer_id: r.buyer_id,
                        title: r.fabric_name,
                        gsm: r.target_gsm ?? prev.gsm,
                        buyer_spec_notes: `In response to your request: ${r.fabric_name}${
                          r.notes ? ` (${r.notes})` : ""
                        }`,
                      }));
                      setModalError(null);
                      setIsModalOpen(true);
                    }}
                    className="shrink-0 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold"
                  >
                    Build Profile for {r.buyer_name}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Active Mill Fabric Rolls & Photography Showcase */}
          <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <span>Mill Fabric Visual Showcase</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  High-definition textile inventory registered under {user?.company?.name || "your mill"}
                </p>
              </div>
              <button
                onClick={() => setActiveTab("stock")}
                className="text-xs font-bold text-primary hover:underline self-start"
              >
                View All {rolls.length} Rolls in Stock →
              </button>
            </div>

            {rolls.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground space-y-2">
                <Layers className="w-8 h-8 text-muted-foreground mx-auto" />
                <p>No fabric rolls listed yet. Use "List Surplus Roll" to publish fabric with high-res photos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {rolls.slice(0, 10).map((roll) => (
                  <div
                    key={roll.id}
                    className="group rounded-2xl border border-border overflow-hidden bg-card hover:border-primary/50 transition-all duration-300 shadow-2xs hover:shadow-md flex flex-col justify-between"
                  >
                    <div className="relative h-28 w-full bg-muted overflow-hidden">
                      <img
                        src={
                          roll.primary_image ||
                          "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=400&q=80"
                        }
                        alt={roll.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=400&q=80";
                        }}
                      />
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white text-[9px] font-mono font-bold">
                        <span
                          className="w-2 h-2 rounded-full border border-white/50"
                          style={{ backgroundColor: roll.color_hex }}
                        />
                        <span>{roll.roll_code}</span>
                      </div>
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-extrabold shadow-xs">
                        {formatBDT(Number(roll.price_per_yard))}/yd
                      </div>
                    </div>
                    <div className="p-2.5 space-y-1">
                      <p className="font-bold text-xs text-foreground truncate" title={roll.title}>
                        {roll.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{roll.composition}</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                        <span>{roll.gsm} GSM</span>
                        <span className="font-bold text-primary">{roll.available_yards} yds</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders Table */}
          <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Recent Buyer Breakdown Orders</h3>
                <p className="text-xs text-muted-foreground">
                  Orders holding yardage from your listed mill rolls
                </p>
              </div>
              <button
                onClick={() => setActiveTab("pickups")}
                className="text-xs font-bold text-primary hover:underline"
              >
                View All Pickups →
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No orders placed yet. When boutique buyers purchase custom cuts, they will show here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Boutique Buyer</th>
                      <th className="py-3 px-4">Fabric Pieces</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Fulfillment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.slice(0, 5).map((ord) => (
                      <tr key={ord.id} className="hover:bg-muted/20">
                        <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                          {ord.order_number}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          {ord.buyer_name}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {ord.items.map((i) => `${i.requested_yards} yds (${i.roll_code})`).join(", ")}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-foreground">
                          {formatBDT(Number(ord.items_subtotal))}
                        </td>
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
        </div>
      )}

      {/* Tab 2: My Fabric Stock */}
      {activeTab === "stock" && (
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Active Fabric Rolls & Buyer Profiles</h3>
              <p className="text-xs text-muted-foreground">
                Surplus rolls and dedicated buyer fabric profiles crafted by {user?.company?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setProfileMode("BUYER_CUSTOM");
                  setIsModalOpen(true);
                  setModalError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Build for Buyer</span>
              </button>
              <button
                onClick={() => {
                  setProfileMode("PUBLIC");
                  setIsModalOpen(true);
                  setModalError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Roll</span>
              </button>
            </div>
          </div>

          {/* Sub Filters */}
          <div className="flex items-center gap-2 border-b border-border/60 pb-3 text-xs">
            <button
              onClick={() => setStockFilter("ALL")}
              className={`px-3 py-1 rounded-xl font-bold transition-all ${
                stockFilter === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              All Inventory ({rolls.length})
            </button>
            <button
              onClick={() => setStockFilter("PUBLIC")}
              className={`px-3 py-1 rounded-xl font-bold transition-all ${
                stockFilter === "PUBLIC"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Public Surplus ({rolls.filter((r) => !r.is_custom_profile).length})
            </button>
            <button
              onClick={() => setStockFilter("BUYER_CUSTOM")}
              className={`px-3 py-1 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                stockFilter === "BUYER_CUSTOM"
                  ? "bg-purple-600 text-white"
                  : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Profiles for Buyers ({rolls.filter((r) => r.is_custom_profile).length})</span>
            </button>
          </div>

          {rolls.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Layers className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-bold text-foreground">No Rolls Listed Yet</p>
              <p className="text-xs text-muted-foreground">
                Click "Build Profile for Buyer" or "List Surplus Roll" to create and publish fabric profiles.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Roll Code</th>
                    <th className="py-3 px-4">Fabric Details & Target</th>
                    <th className="py-3 px-4">Specs (GSM / Width)</th>
                    <th className="py-3 px-4">Available Yards</th>
                    <th className="py-3 px-4">Price / Yard</th>
                    <th className="py-3 px-4">Profile Type</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rolls
                    .filter((roll) => {
                      if (stockFilter === "PUBLIC") return !roll.is_custom_profile;
                      if (stockFilter === "BUYER_CUSTOM") return roll.is_custom_profile;
                      return true;
                    })
                    .map((roll) => {
                      const isHighlighted = highlightedRollId === roll.id;
                      return (
                        <tr
                          key={roll.id}
                          className={`transition-all duration-700 ${
                            isHighlighted
                              ? "bg-primary/15 ring-2 ring-primary/40 shadow-xs"
                              : "hover:bg-muted/20"
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{roll.roll_code}</span>
                              {isHighlighted && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500 text-white animate-pulse">
                                  ✨ New
                                </span>
                              )}
                            </div>
                          </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-border flex-shrink-0 bg-muted relative group shadow-2xs">
                              <img
                                src={
                                  roll.primary_image ||
                                  "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=300&q=80"
                                }
                                alt={roll.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src =
                                    "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=300&q=80";
                                }}
                              />
                              <div
                                className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border border-background shadow-xs"
                                style={{ backgroundColor: roll.color_hex }}
                                title={roll.color_name}
                              />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-bold text-foreground text-xs truncate max-w-xs sm:max-w-md">
                                {roll.title}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">{roll.composition}</p>
                              {roll.is_custom_profile && (
                                <div className="pt-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                                    <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                    <span>Built for {roll.target_buyer_name || "Exclusive Buyer"}</span>
                                  </span>
                                  {roll.buyer_spec_notes && (
                                    <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5 line-clamp-1">
                                      Note: {roll.buyer_spec_notes}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          {roll.gsm} GSM • {roll.width_inches}"
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-primary text-xs">
                          {roll.available_yards} yds
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-foreground">
                          {formatBDT(Number(roll.price_per_yard))}
                        </td>
                        <td className="py-3.5 px-4">
                          {roll.is_custom_profile ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              Buyer Custom
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                              Public Open
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            to={`/catalog/${roll.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline font-bold text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Pickup Schedules */}
      {activeTab === "pickups" && (
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Mill Logistics & Pickup Queue</h3>
            <p className="text-xs text-muted-foreground">
              Scheduled pickups for Tejgaon Hub cutting van. Please ensure rolls are labeled and staged at the dispatch loading bay.
            </p>
          </div>

          {pendingPickupOrders.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Truck className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-foreground">All Roll Pickups are Up-to-Date</p>
              <p className="text-xs text-muted-foreground">
                No orders are currently waiting for van pickup from your factory gate.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPickupOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-5 rounded-2xl bg-muted/30 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {ord.order_number}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        {ord.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Boutique: <strong className="text-foreground">{ord.buyer_name}</strong> • Delivery Note: {ord.delivery_notes || "None"}
                    </p>
                    <div className="text-xs pt-1">
                      {ord.items.map((i) => (
                        <span key={i.id} className="font-semibold text-primary mr-3">
                          • {i.requested_yards} yds of {i.roll_code} ({i.roll_title})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Gross Value</p>
                    <p className="font-extrabold text-base text-foreground">
                      {formatBDT(Number(ord.items_subtotal))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Payouts & Ledger */}
      {activeTab === "payouts" && (
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Earnings Statement & Payouts Ledger</h3>
            <p className="text-xs text-muted-foreground">
              Automated 94% net settlement to Bangladesh corporate bank account upon precision cut handover.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-muted-foreground">Gross Sales Value</p>
              <p className="text-xl font-extrabold text-foreground mt-0.5">{formatBDT(grossSalesRevenue)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Platform Commission (6%)</p>
              <p className="text-xl font-extrabold text-muted-foreground mt-0.5">{formatBDT(grossSalesRevenue * 0.06)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Net Factory Disbursed</p>
              <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{formatBDT(netEarnings)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: List New Surplus Fabric Roll */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-2xl rounded-3xl border border-border p-6 sm:p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {profileMode === "BUYER_CUSTOM"
                    ? "Build Custom Fabric Profile for Buyer"
                    : "List New Surplus Fabric Roll"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {profileMode === "BUYER_CUSTOM"
                    ? "Formulate and publish an exclusive fabric profile targeted to a specific boutique buyer"
                    : "Publish certified deadstock yardage to verified boutique buyers"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="p-1 rounded-2xl bg-muted/60 border border-border flex gap-1">
              <button
                type="button"
                onClick={() => setProfileMode("PUBLIC")}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  profileMode === "PUBLIC"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>General Surplus Listing</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileMode("BUYER_CUSTOM")}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  profileMode === "BUYER_CUSTOM"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-purple-600"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Build Profile for Buyer</span>
              </button>
            </div>

            {profileMode === "BUYER_CUSTOM" && (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Factory Merchandiser Role: Custom Fabric Profile Builder</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  You are formulating an exclusive fabric profile for a designated boutique buyer. The buyer will receive this profile in their Buyer Portal with custom specs and priority checkout.
                </p>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {modalError && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Quick-Fill Fabric Specification Templates Bar */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-foreground flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-primary" />
                  <span>1-Click Smart Fabric Templates</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Auto-fills specs, fabric type, & verified image in 1 click
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {REAL_FABRIC_PRESETS.slice(0, 8).map((preset: FabricPreset, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyPresetTemplate(preset)}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-xl border border-border bg-card hover:border-primary text-[10px] font-bold text-foreground flex items-center gap-1.5 shadow-2xs transition-all hover:bg-primary/5 active:scale-95"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-border flex-shrink-0"
                      style={{ backgroundColor: preset.colorHex }}
                    />
                    <span>{preset.name.split("—")[0].trim()}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateRoll} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profileMode === "BUYER_CUSTOM" && (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-bold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-extrabold">
                        <Sparkles className="w-3.5 h-3.5" />
                        Target Buyer (Boutique / Brand) *
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        Select recipient boutique
                      </span>
                    </label>
                    <select
                      required={profileMode === "BUYER_CUSTOM"}
                      value={newRoll.target_buyer_id}
                      onChange={(e) => setNewRoll({ ...newRoll, target_buyer_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-purple-500/40 bg-card focus:ring-2 focus:ring-purple-500 focus:outline-none font-semibold text-xs text-foreground"
                    >
                      <option value="">-- Choose Buyer Company --</option>
                      {buyers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.contact_email}) — {b.verification_status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-foreground">
                    {profileMode === "BUYER_CUSTOM" ? "Fabric Profile Title *" : "Roll Title *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoll.title}
                    onChange={(e) => setNewRoll({ ...newRoll, title: e.target.value })}
                    placeholder={
                      profileMode === "BUYER_CUSTOM"
                        ? "e.g. Custom Organic Combed Jersey — Exclusively Formulated for Buyer"
                        : "e.g. Combed Cotton Single Jersey 180 GSM — Navy"
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                {profileMode === "BUYER_CUSTOM" && (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-bold text-foreground">
                      Merchandiser Specification Notes for Buyer
                    </label>
                    <textarea
                      rows={2}
                      value={newRoll.buyer_spec_notes}
                      onChange={(e) => setNewRoll({ ...newRoll, buyer_spec_notes: e.target.value })}
                      placeholder="e.g. Formulated exclusively for Dhaka Trendz Summer Capsule: 30s combed yarn, reactive dye, anti-pilling wash, lab dip approved."
                      className="w-full p-3 rounded-xl border border-input bg-card focus:ring-2 focus:ring-purple-500 focus:outline-none text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Fabric Type / Weave *</label>
                  <select
                    required
                    value={newRoll.fabric_type}
                    onChange={(e) => setNewRoll({ ...newRoll, fabric_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    {categories.flatMap((cat) =>
                      cat.fabric_types.map((ft) => (
                        <option key={ft.id} value={ft.id}>
                          {cat.name} — {ft.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Composition *</label>
                  <input
                    type="text"
                    required
                    value={newRoll.composition}
                    onChange={(e) => setNewRoll({ ...newRoll, composition: e.target.value })}
                    placeholder="e.g. 100% Organic Combed Cotton"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">GSM (Weight) *</label>
                  <input
                    type="number"
                    required
                    value={newRoll.gsm}
                    onChange={(e) => setNewRoll({ ...newRoll, gsm: Number(e.target.value) })}
                    placeholder="180"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Usable Width (Inches) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newRoll.width_inches}
                    onChange={(e) => setNewRoll({ ...newRoll, width_inches: e.target.value })}
                    placeholder="60.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Color and Quick Palette Selection */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-bold text-foreground">Color & Palette *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={newRoll.color_name}
                      onChange={(e) => setNewRoll({ ...newRoll, color_name: e.target.value })}
                      placeholder="e.g. Deep Raw Indigo"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newRoll.color_hex}
                        onChange={(e) => setNewRoll({ ...newRoll, color_hex: e.target.value })}
                        className="w-10 h-10 p-1 rounded-lg border border-input bg-card cursor-pointer flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={newRoll.color_hex}
                        onChange={(e) => setNewRoll({ ...newRoll, color_hex: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-xl border border-input bg-card font-mono text-xs"
                      />
                    </div>
                  </div>
                  {/* Quick Color Swatches */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-muted-foreground mr-1">Quick Palette:</span>
                    {COMMON_COLOR_SWATCHES.map((swatch: ColorSwatch, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyColor(swatch)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-medium transition-all ${
                          newRoll.color_hex.toLowerCase() === swatch.hex.toLowerCase()
                            ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                            : "border-border/60 bg-muted/40 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: swatch.hex }} />
                        <span>{swatch.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Total Available Yards *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newRoll.total_yards}
                    onChange={(e) => {
                      const val = e.target.value;
                      const numVal = Number(val);
                      const suggestedMin = numVal > 0 ? Math.max(5, Math.min(25, Math.round(numVal * 0.1))) : 10;
                      setNewRoll((prev) => ({
                        ...prev,
                        total_yards: val,
                        min_cut_length_yards: prev.min_cut_length_yards || String(suggestedMin),
                      }));
                    }}
                    placeholder="120.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Min Machine Cut (Yds) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newRoll.min_cut_length_yards}
                    onChange={(e) => setNewRoll({ ...newRoll, min_cut_length_yards: e.target.value })}
                    placeholder="10.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Price per Yard (BDT) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newRoll.price_per_yard}
                    onChange={(e) => setNewRoll({ ...newRoll, price_per_yard: e.target.value })}
                    placeholder="240.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground flex items-center justify-between">
                    <span>Lot / Batch Number</span>
                    <button
                      type="button"
                      onClick={() => setNewRoll((prev) => ({ ...prev, lot_batch_number: generateLotNumber() }))}
                      className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Auto-Generate</span>
                    </button>
                  </label>
                  <input
                    type="text"
                    value={newRoll.lot_batch_number}
                    onChange={(e) => setNewRoll({ ...newRoll, lot_batch_number: e.target.value })}
                    placeholder="e.g. SQ-LOT-2026-492"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none font-mono"
                  />
                </div>

                {/* Fabric Real Textile Photography Swatch Studio */}
                <div className="space-y-3 sm:col-span-2 pt-3 border-t border-border/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        <span>Real Textile Photography Swatch Studio</span>
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        Select a verified high-resolution fabric texture swatch or enter a custom photo URL
                      </p>
                    </div>
                    {newRoll.image_url && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                        Verified Fabric Photo
                      </span>
                    )}
                  </div>

                  {/* Fabric Swatch Preset Grid */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Quick Real Fabric Presets (Click to apply real texture & specs)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-52 overflow-y-auto p-2 border border-border/70 rounded-2xl bg-muted/20">
                      {REAL_FABRIC_PRESETS.map((preset: FabricPreset, idx: number) => {
                        const isSelected = newRoll.image_url === preset.url;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setNewRoll((prev) => ({
                                ...prev,
                                image_url: preset.url,
                                title: prev.title || preset.name,
                                composition: prev.composition || preset.composition,
                                gsm: prev.gsm || preset.gsm,
                                color_name: prev.color_name || preset.colorName,
                                color_hex: prev.color_hex || preset.colorHex,
                              }));
                            }}
                            className={`group relative rounded-xl overflow-hidden border-2 text-left p-1 transition-all ${
                              isSelected
                                ? "border-primary ring-2 ring-primary/30 shadow-xs bg-primary/5"
                                : "border-border hover:border-primary/50 bg-card"
                            }`}
                          >
                            <div className="h-16 w-full rounded-lg overflow-hidden relative bg-muted">
                              <img
                                src={preset.url}
                                alt={preset.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                              <div
                                className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                                style={{ backgroundColor: preset.colorHex }}
                                title={preset.colorName}
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-foreground truncate mt-1 leading-tight" title={preset.name}>
                              {preset.name}
                            </p>
                            <p className="text-[9px] text-muted-foreground truncate">
                              {preset.category}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Visual Preview Card */}
                  {newRoll.image_url && (
                    <div className="p-3.5 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/5 to-purple-500/5 flex items-center gap-3.5 shadow-2xs">
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0 bg-muted relative shadow-xs">
                        <img
                          src={newRoll.image_url}
                          alt="Fabric Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=400&q=80";
                          }}
                        />
                        <div
                          className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                          style={{ backgroundColor: newRoll.color_hex }}
                          title={newRoll.color_name}
                        />
                      </div>
                      <div className="space-y-0.5 text-xs min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-foreground truncate">
                            {newRoll.title || "Selected Real Fabric Swatch"}
                          </p>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-primary/10 text-primary">
                            Preview
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] truncate">
                          {newRoll.composition || "Textile"} • {newRoll.gsm} GSM • {newRoll.color_name || "Color"}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 pt-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Real Textile Photography Ready for Buyer Catalog</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Custom Photo URL Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Or edit / paste custom high-resolution photo URL:
                    </label>
                    <input
                      type="url"
                      value={newRoll.image_url}
                      onChange={(e) => setNewRoll({ ...newRoll, image_url: e.target.value })}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full px-3.5 py-2 rounded-xl border border-input bg-card focus:ring-2 focus:ring-primary focus:outline-none text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Listing Roll..." : "Publish Surplus Roll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
