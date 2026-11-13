import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Layers,
  MapPin,
  ShieldCheck,
  Scissors,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  ArrowLeft,
  ShoppingCart,
  CreditCard,
  FileText,
  BadgeCheck,
  Check,
  Sparkles,
  Building,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/features/auth/store";
import { formatBDT } from "@/lib/utils";

interface FabricRollDetail {
  id: string;
  roll_code: string;
  title: string;
  category_name: string;
  fabric_type_name: string;
  mill_name: string;
  factory_id?: string;
  mill_location: string;
  mill_contact_phone: string;
  composition: string;
  gsm: number;
  width_inches: string | number;
  color_name: string;
  color_hex: string;
  pattern: string;
  finish: string;
  total_yards: string | number;
  available_yards: string | number;
  min_cut_length_yards: string | number;
  price_per_yard: string | number;
  lot_batch_number: string;
  quality_grade: string;
  defect_notes: string;
  status: string;
  is_sample_available: boolean;
  sample_price: string | number;
  is_custom_profile?: boolean;
  target_buyer_name?: string;
  target_buyer_id?: string;
  buyer_spec_notes?: string;
  images: Array<{ id: string; image_url: string; is_primary: boolean }>;
}

export const FabricDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [roll, setRoll] = useState<FabricRollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Roll Breakdown State
  const [requestedYards, setRequestedYards] = useState<number>(10);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("BKASH");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    const fetchRoll = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/catalog/rolls/${id}/`);
        const data: FabricRollDetail = res.data.data;
        setRoll(data);
        const minCut = Number(data.min_cut_length_yards) || 10;
        setRequestedYards(minCut);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || "Failed to load fabric roll details.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchRoll();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Loading fabric roll specifications...</p>
        </div>
      </div>
    );
  }

  if (error || !roll) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Surplus Roll Not Available</h2>
        <p className="text-sm text-muted-foreground">{error || "The requested fabric roll is no longer available."}</p>
        <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to Fabric Catalog
        </Link>
      </div>
    );
  }

  const availYards = Number(roll.available_yards);
  const minCut = Number(roll.min_cut_length_yards);
  const unitPrice = Number(roll.price_per_yard);

  // Breakdown Invariants & Calculations
  const leftoverYards = Math.max(0, availYards - requestedYards);
  const isTooSmall = requestedYards < minCut;
  const isTooLarge = requestedYards > availYards;
  const isBadLeftover = leftoverYards > 0 && leftoverYards < minCut;
  const isValidBreakdown = !isTooSmall && !isTooLarge && !isBadLeftover;

  // Real-time Pricing Calculations
  const fabricCost = requestedYards * unitPrice;
  const platformCommission = fabricCost * 0.06;
  const cuttingFee = 150 + requestedYards * 5;
  const deliveryFee = 120;
  const vatAmount = (platformCommission + cuttingFee) * 0.15;
  const totalPayable = fabricCost + platformCommission + cuttingFee + deliveryFee + vatAmount;

  const handleYardsChange = (newVal: number) => {
    const clamped = Math.max(0, Math.min(availYards, newVal));
    setRequestedYards(Number(clamped.toFixed(1)));
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: `/catalog/${roll.id}` } } });
      return;
    }

    setIsAddingToCart(true);
    setCartSuccess(false);
    try {
      await apiClient.post("/orders/cart/items/", {
        fabric_roll_id: roll.id,
        requested_yards: requestedYards,
      });
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || "Failed to add to cart.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleInstantCheckout = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: `/catalog/${roll.id}` } } });
      return;
    }

    setIsCheckingOut(true);
    try {
      // 1. Add to cart first
      const cartRes = await apiClient.post("/orders/cart/items/", {
        fabric_roll_id: roll.id,
        requested_yards: requestedYards,
      });

      // 2. Check out ONLY this item — other things already in the cart stay there.
      const res = await apiClient.post("/orders/checkout/", {
        payment_method: paymentMethod,
        delivery_notes: `Direct checkout for ${requestedYards} yds of ${roll.roll_code}`,
        item_ids: [cartRes.data.data.id],
      });

      setShowCheckoutModal(false);
      navigate("/buyer/orders", { state: { newOrder: res.data.data } });
    } catch (err: any) {
      alert(err.response?.data?.error?.message || "Payment authorization failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const primaryImage =
    selectedImage ||
    roll.images.find((img) => img.is_primary)?.image_url ||
    roll.images[0]?.image_url ||
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/catalog" className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Catalog
        </Link>
        <span>/</span>
        <span>{roll.category_name || "Surplus Fabrics"}</span>
        <span>/</span>
        <span className="font-semibold text-foreground truncate">{roll.roll_code}</span>
      </nav>

      {/* Exclusive Profile VIP Banner */}
      {roll.is_custom_profile && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-500/15 via-purple-600/10 to-indigo-500/15 border-2 border-purple-500/30 flex items-start sm:items-center gap-4 shadow-sm">
          <div className="p-3 rounded-2xl bg-purple-600 text-white shrink-0 shadow-md shadow-purple-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-600 text-white uppercase tracking-wider">
                Exclusive Fabric Profile
              </span>
              {roll.target_buyer_name && (
                <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">
                  Formulated Specifically for {roll.target_buyer_name}
                </span>
              )}
            </div>
            <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
              This surplus roll was custom formulated and reserved by <strong>{roll.mill_name}</strong>. It includes priority hub receiving and customized precision cutting.
            </p>
            {roll.buyer_spec_notes && (
              <div className="mt-2 text-xs bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-foreground/90 font-mono">
                <span className="font-bold text-purple-600 dark:text-purple-400">Merchandiser Formulation Note: </span>
                {roll.buyer_spec_notes}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Product Gallery, Specs, Mill Details */}
        <div className="lg:col-span-7 space-y-8">
          {/* Main Photo Card */}
          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
              <img
                src={primaryImage}
                alt={roll.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/60 text-white backdrop-blur-md">
                  {roll.quality_grade.replace("_", " ")}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-md">
                  Certified Export Surplus
                </span>
              </div>
              <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-white font-mono text-xs">
                {roll.roll_code}
              </div>
            </div>

            {/* Multiple Photos Thumbnails */}
            {roll.images && roll.images.length > 1 && (
              <div className="px-5 py-3 bg-muted/40 border-t border-border flex items-center gap-2.5 overflow-x-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1 shrink-0">
                  Views ({roll.images.length}):
                </span>
                {roll.images.map((img, idx) => {
                  const isActive = primaryImage === img.image_url;
                  return (
                    <button
                      key={img.id || idx}
                      type="button"
                      onClick={() => setSelectedImage(img.image_url)}
                      className={`relative w-16 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 focus:outline-none ${
                        isActive
                          ? "border-primary ring-2 ring-primary/40 shadow-sm scale-105"
                          : "border-border hover:border-foreground/50 opacity-70 hover:opacity-100"
                      }`}
                      title={img.is_primary ? "Primary View" : `View Angle ${idx + 1}`}
                    >
                      <img
                        src={img.image_url}
                        alt={`Fabric view ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {img.is_primary && (
                        <span className="absolute bottom-0.5 left-0.5 text-[8px] font-extrabold bg-black/70 text-white px-1 py-0.2 rounded">
                          Main
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Color Swatch Bar */}
            <div className="p-5 bg-card border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border-2 border-white shadow-md flex-shrink-0"
                  style={{ backgroundColor: roll.color_hex }}
                />
                <div>
                  <p className="font-bold text-sm text-foreground">{roll.color_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{roll.color_hex}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-muted-foreground">Available in this Roll</p>
                <p className="font-extrabold text-base text-primary">{availYards} Yards</p>
              </div>
            </div>
          </div>

          {/* Mill & Origin Card */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base text-foreground">{roll.mill_name}</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                Verified BGMEA Mill
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              Location: {roll.mill_location}
            </p>
            {roll.defect_notes && (
              <div className="p-4 rounded-xl bg-muted/40 border border-border/80 text-xs text-foreground/80 leading-relaxed">
                <span className="font-bold text-foreground">Factory Inspection Log: </span>
                {roll.defect_notes}
              </div>
            )}
            {roll.factory_id && (
              <div className="pt-2 border-t border-border/60">
                <Link
                  to={`/stores/${roll.factory_id}`}
                  className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                >
                  <Building className="w-4 h-4" />
                  <span>Visit {roll.mill_name} Storefront & All Inventory →</span>
                </Link>
              </div>
            )}
          </div>

          {/* Technical Specifications Table */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="p-5 border-b border-border bg-muted/20">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Certified Fabric Specifications
              </h3>
            </div>
            <div className="divide-y divide-border text-xs">
              <div className="grid grid-cols-2 p-3.5 hover:bg-muted/10">
                <span className="text-muted-foreground">Fabric Type</span>
                <span className="font-semibold text-foreground text-right">{roll.fabric_type_name}</span>
              </div>
              <div className="grid grid-cols-2 p-3.5 hover:bg-muted/10">
                <span className="text-muted-foreground">Material Composition</span>
                <span className="font-semibold text-foreground text-right">{roll.composition}</span>
              </div>
              <div className="grid grid-cols-2 p-3.5 hover:bg-muted/10">
                <span className="text-muted-foreground">Weight (Certified GSM)</span>
                <span className="font-semibold text-foreground text-right">{roll.gsm} GSM</span>
              </div>
              <div className="grid grid-cols-2 p-3.5 hover:bg-muted/10">
                <span className="text-muted-foreground">Cuttable Width</span>
                <span className="font-semibold text-foreground text-right">{roll.width_inches} Inches</span>
              </div>
              <div className="grid grid-cols-2 p-3.5 hover:bg-muted/10">
                <span className="text-muted-foreground">Pattern / Construction</span>
                <span className="font-semibold text-foreground text-right">{roll.pattern}</span>
              </div>
              <div className="grid grid-cols-2 p-3.5 hover:bg-muted/10">
                <span className="text-muted-foreground">Chemical / Mechanical Finish</span>
                <span className="font-semibold text-foreground text-right">{roll.finish}</span>
              </div>
              <div className="grid grid-cols-2 p-3.5 hover:bg-muted/10">
                <span className="text-muted-foreground">Batch / Lot Identifier</span>
                <span className="font-mono text-foreground text-right">{roll.lot_batch_number || "SQ-BATCH-A1"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Roll Breakdown Interactive Calculator & Card Checkout */}
        <div className="lg:col-span-5 sticky top-24 space-y-6">
          <div className="bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-xl space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Precision Roll Breakdown
              </span>
              <h2 className="text-2xl font-extrabold text-foreground mt-1">{roll.title}</h2>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-foreground">{formatBDT(unitPrice)}</span>
                <span className="text-xs text-muted-foreground font-medium">per yard</span>
              </div>
            </div>

            {/* Stepper Input */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-foreground">Requested Cut Length (Yards)</label>
                <span className="text-muted-foreground">
                  Min Cut: <strong>{minCut} yd</strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleYardsChange(requestedYards - 5)}
                  disabled={requestedYards <= minCut}
                  className="w-12 h-12 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center font-bold text-foreground disabled:opacity-40 transition-all"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={minCut}
                    max={availYards}
                    step={1}
                    value={requestedYards}
                    onChange={(e) => handleYardsChange(parseFloat(e.target.value) || 0)}
                    className="w-full py-3 px-4 text-center text-xl font-extrabold rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
                    YARDS
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleYardsChange(requestedYards + 5)}
                  disabled={requestedYards >= availYards}
                  className="w-12 h-12 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center font-bold text-foreground disabled:opacity-40 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleYardsChange(minCut)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
                >
                  Min ({minCut} yd)
                </button>
                <button
                  type="button"
                  onClick={() => handleYardsChange(25)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
                >
                  25 yd
                </button>
                <button
                  type="button"
                  onClick={() => handleYardsChange(50)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
                >
                  50 yd
                </button>
                <button
                  type="button"
                  onClick={() => handleYardsChange(availYards)}
                  className="px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20"
                >
                  Take All ({availYards} yd)
                </button>
              </div>

              {/* Invariant Rule Status Tag */}
              <div className="pt-2">
                {!isValidBreakdown ? (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                    {isTooSmall && <p>• Requested yardage is below the minimum cut length ({minCut} yd).</p>}
                    {isTooLarge && <p>• Exceeds total available stock in roll ({availYards} yd).</p>}
                    {isBadLeftover && (
                      <p>
                        • Leaving an unsellable remnant of {leftoverYards.toFixed(1)} yards. Remaining piece must be 0 yards (take whole roll) or at least {minCut} yards.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      Breakdown Rule Satisfied
                    </span>
                    <span className="font-mono font-bold">
                      Leftover: {leftoverYards.toFixed(1)} yd
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Itemized Price Preview */}
            <div className="bg-muted/40 p-4 rounded-2xl border border-border space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fabric Cost ({requestedYards} yd × ৳{unitPrice})</span>
                <span className="font-semibold text-foreground">{formatBDT(fabricCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hub Precision Cutting & Inspection Fee</span>
                <span className="font-semibold text-foreground">{formatBDT(cuttingFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Quality Escrow Fee (6%)</span>
                <span className="font-semibold text-foreground">{formatBDT(platformCommission)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direct Courier Delivery (Dhaka / Metro)</span>
                <span className="font-semibold text-foreground">{formatBDT(deliveryFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bangladesh VAT (15% on services)</span>
                <span className="font-semibold text-foreground">{formatBDT(vatAmount)}</span>
              </div>
              <div className="pt-2 border-t border-border flex justify-between text-sm font-extrabold text-foreground">
                <span>Total Payable</span>
                <span className="text-primary text-base">{formatBDT(totalPayable)}</span>
              </div>
            </div>

            {/* Action Buttons: Add to Cart & Card Checkout */}
            <div className="space-y-3">
              {cartSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Added {requestedYards} yards to your cart!</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!isValidBreakdown || isAddingToCart}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border-2 border-primary text-primary hover:bg-primary/5 transition-all disabled:opacity-40"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{isAddingToCart ? "Adding to Cart..." : "Add to Cart / Card"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCheckoutModal(true)}
                disabled={!isValidBreakdown}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all disabled:opacity-40"
              >
                <CreditCard className="w-4 h-4" />
                <span>Request Breakdown & Pay {formatBDT(totalPayable)}</span>
              </button>
            </div>

            {/* Guarantees */}
            <div className="pt-2 grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>Machine Precision Cut</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span>Money-Back Defect Escrow</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout / Payment Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-border p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-foreground">Confirm Fabric Breakdown Order</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Reserving {requestedYards} yards from {roll.roll_code}
                </p>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Order Summary Snapshot */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2 text-xs">
              <div className="flex justify-between font-semibold">
                <span>{roll.title}</span>
                <span>{requestedYards} yd</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Mill Source</span>
                <span>{roll.mill_name}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-primary pt-2 border-t border-border">
                <span>Total Amount Due</span>
                <span>{formatBDT(totalPayable)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                Select Bangladeshi Payment Method
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("BKASH")}
                  className={`p-3.5 rounded-xl border text-left font-semibold transition-all ${
                    paymentMethod === "BKASH"
                      ? "border-pink-600 bg-pink-500/10 text-pink-600 shadow-sm"
                      : "border-border hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="block text-sm">bKash</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Direct Mobile Wallet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("NAGAD")}
                  className={`p-3.5 rounded-xl border text-left font-semibold transition-all ${
                    paymentMethod === "NAGAD"
                      ? "border-amber-600 bg-amber-500/10 text-amber-600 shadow-sm"
                      : "border-border hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="block text-sm">Nagad Pay</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Post Office Digital Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("SSLCOMMERZ")}
                  className={`p-3.5 rounded-xl border text-left font-semibold transition-all ${
                    paymentMethod === "SSLCOMMERZ"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="block text-sm">Credit / Debit Card</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Visa, Mastercard, Amex</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("B2B_CREDIT")}
                  className={`p-3.5 rounded-xl border text-left font-semibold transition-all ${
                    paymentMethod === "B2B_CREDIT"
                      ? "border-emerald-600 bg-emerald-500/10 text-emerald-600 shadow-sm"
                      : "border-border hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="block text-sm">Net-30 B2B Credit</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Available limit: ৳50,000</span>
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={handleInstantCheckout}
                disabled={isCheckingOut}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isCheckingOut ? "Authorizing Payment & Reserving Yardage..." : `Confirm & Pay ${formatBDT(totalPayable)}`}
              </button>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel & Review Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
