import React, { useState, useEffect } from "react";
import {
  Scissors,
  CheckCircle2,
  Barcode,
  AlertCircle,
  Truck,
  Package,
  Layers,
  Clock,
  Printer,
  X,
  Search,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatBDT } from "@/lib/utils";

interface OrderItem {
  id: string;
  roll_code: string;
  roll_title: string;
  color_name: string;
  requested_yards: string | number;
  unit_price: string | number;
  subtotal: string | number;
  status: string;
}

interface TrackingEvent {
  id: string;
  to_status: string;
  title: string;
  description: string;
  location: string;
  created_at: string;
}

interface HubOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  status: string;
  items_subtotal: string | number;
  cutting_fee: string | number;
  delivery_notes: string;
  items: OrderItem[];
  tracking_events: TrackingEvent[];
  created_at: string;
}

export const HubQueuePage: React.FC = () => {
  const [orders, setOrders] = useState<HubOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [barcodeModalOrder, setBarcodeModalOrder] = useState<HubOrder | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/orders/");
      setOrders(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch hub orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAdvanceStatus = async (
    orderId: string,
    newStatus: string,
    notes: string,
    location: string = "Tejgaon Central Hub"
  ) => {
    try {
      setUpdatingOrderId(orderId);
      await apiClient.patch(`/orders/${orderId}/status/`, {
        status: newStatus,
        notes,
        location,
      });

      setActionSuccess(`Order status updated to ${newStatus.replace(/_/g, " ")}`);
      await fetchOrders();
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || "Failed to update order status.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Metrics
  const cuttingInProgress = orders.filter((o) => o.status === "CUTTING").length;
  const awaitingCut = orders.filter((o) => ["PAID_CREDIT_APPROVED", "AT_HUB"].includes(o.status)).length;
  const readyForCourier = orders.filter((o) => ["CUT_DONE", "PACKED"].includes(o.status)).length;
  const dispatched = orders.filter((o) => ["OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"].includes(o.status)).length;

  const filteredOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1.5">
            <Scissors className="w-3.5 h-3.5" />
            <span>Tejgaon Central Hub — Machine Cutting Workbench</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Precision Cutting & Hub Logistics Queue
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Receiving surplus rolls from mill trucks, executing millimeter-accurate breakdown cuts, and barcode dispatch.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-xs font-bold hover:bg-muted self-start"
        >
          <Clock className="w-4 h-4 text-primary" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Awaiting Cut / At Hub</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">{awaitingCut}</p>
          <p className="text-xs text-muted-foreground">En-route or staged at inspection bay</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Active Machine Cuts</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-primary">{cuttingInProgress}</p>
          <p className="text-xs text-muted-foreground">Cutter tables in operation</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Packed & Barcoded</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Barcode className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600">{readyForCourier}</p>
          <p className="text-xs text-muted-foreground">Ready for courier pickup</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-xs font-semibold">Dispatched Today</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">{dispatched}</p>
          <p className="text-xs text-muted-foreground">In transit to boutiques</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          All Jobs ({orders.length})
        </button>
        <button
          onClick={() => setStatusFilter("PAID_CREDIT_APPROVED")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "PAID_CREDIT_APPROVED"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          New Holds ({orders.filter((o) => o.status === "PAID_CREDIT_APPROVED").length})
        </button>
        <button
          onClick={() => setStatusFilter("AT_HUB")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "AT_HUB"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Received at Hub ({orders.filter((o) => o.status === "AT_HUB").length})
        </button>
        <button
          onClick={() => setStatusFilter("CUTTING")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "CUTTING"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          On Cutter Table ({cuttingInProgress})
        </button>
        <button
          onClick={() => setStatusFilter("PACKED")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            statusFilter === "PACKED"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Ready for Courier ({readyForCourier})
        </button>
      </div>

      {/* Orders Queue Cards */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Loading hub cutting queue...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border p-16 text-center space-y-3 shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="font-bold text-base text-foreground">No Jobs in this Queue Status</h3>
          <p className="text-xs text-muted-foreground">Select another tab to inspect orders across other workflow stages.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const isUpdating = updatingOrderId === ord.id;
            return (
              <div
                key={ord.id}
                className="bg-card rounded-3xl border border-border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Order Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono font-extrabold text-base text-foreground">
                      {ord.order_number}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                      {ord.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Buyer: <strong className="text-foreground">{ord.buyer_name}</strong>
                    </span>
                  </div>

                  {/* Cut Specifications */}
                  <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 space-y-1.5 text-xs">
                    <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                      Cut Specifications:
                    </p>
                    {ord.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {item.roll_title} ({item.roll_code})
                        </span>
                        <span className="font-mono font-extrabold text-primary text-sm">
                          {item.requested_yards} Yards Requested
                        </span>
                      </div>
                    ))}
                  </div>

                  {ord.delivery_notes && (
                    <p className="text-xs text-muted-foreground">
                      <strong>Delivery Instructions:</strong> {ord.delivery_notes}
                    </p>
                  )}
                </div>

                {/* Operator Actions Column */}
                <div className="flex flex-col gap-2 min-w-[200px] border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                  {ord.status === "PAID_CREDIT_APPROVED" && (
                    <button
                      onClick={() =>
                        handleAdvanceStatus(
                          ord.id,
                          "AT_HUB",
                          "Roll arrived at Tejgaon Central Hub via mill shuttle. Initial QR check passed."
                        )
                      }
                      disabled={isUpdating}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all shadow-sm"
                    >
                      Receive Roll at Hub
                    </button>
                  )}

                  {ord.status === "AT_HUB" && (
                    <button
                      onClick={() =>
                        handleAdvanceStatus(
                          ord.id,
                          "CUTTING",
                          "Roll loaded on precision laser cutter table #2."
                        )
                      }
                      disabled={isUpdating}
                      className="w-full py-2.5 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                    >
                      Start Precision Cut
                    </button>
                  )}

                  {ord.status === "CUTTING" && (
                    <button
                      onClick={() =>
                        handleAdvanceStatus(
                          ord.id,
                          "PACKED",
                          "Machine precision cut verified. Roll remainder restocked. Barcode tag generated."
                        )
                      }
                      disabled={isUpdating}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-sm"
                    >
                      Complete Cut & Tag
                    </button>
                  )}

                  {ord.status === "PACKED" && (
                    <button
                      onClick={() =>
                        handleAdvanceStatus(
                          ord.id,
                          "OUT_FOR_DELIVERY",
                          "Handed over to Pathao / SteadFast B2B courier. Tracking active."
                        )
                      }
                      disabled={isUpdating}
                      className="w-full py-2.5 px-3 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition-all shadow-sm"
                    >
                      Handover to Courier
                    </button>
                  )}

                  {ord.status === "OUT_FOR_DELIVERY" && (
                    <button
                      onClick={() =>
                        handleAdvanceStatus(
                          ord.id,
                          "DELIVERED",
                          "Package received and signed at boutique workshop.",
                          "Boutique Delivery Point"
                        )
                      }
                      disabled={isUpdating}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-sm"
                    >
                      Mark as Delivered
                    </button>
                  )}

                  {/* Print Barcode Action */}
                  <button
                    onClick={() => setBarcodeModalOrder(ord)}
                    className="w-full py-2 px-3 rounded-xl border border-border text-foreground/80 hover:bg-muted font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Barcode className="w-3.5 h-3.5 text-primary" />
                    <span>Print Barcode Slip</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Barcode Tag Modal */}
      {barcodeModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-start pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-base text-foreground">Precision Cut Barcode Slip</h3>
                <p className="text-xs text-muted-foreground">Hub Operator Tag: #{barcodeModalOrder.order_number}</p>
              </div>
              <button
                onClick={() => setBarcodeModalOrder(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Printable Tag Visual */}
            <div className="p-6 rounded-2xl bg-white text-black border-2 border-dashed border-zinc-400 space-y-4 font-mono text-xs">
              <div className="flex justify-between items-center border-b border-black pb-2">
                <span className="font-extrabold text-sm tracking-wider">FABRILINK CUT HUB</span>
                <span className="text-[10px] font-bold">TEJGAON #01</span>
              </div>

              <div>
                <p className="text-[10px] text-zinc-600 uppercase">Order Reference</p>
                <p className="text-base font-extrabold">{barcodeModalOrder.order_number}</p>
              </div>

              <div>
                <p className="text-[10px] text-zinc-600 uppercase">Boutique Recipient</p>
                <p className="font-bold">{barcodeModalOrder.buyer_name}</p>
              </div>

              <div className="space-y-1 pt-2 border-t border-zinc-300">
                {barcodeModalOrder.items.map((i) => (
                  <div key={i.id} className="flex justify-between">
                    <span>{i.roll_code} ({i.color_name})</span>
                    <span className="font-bold">{i.requested_yards} YD</span>
                  </div>
                ))}
              </div>

              {/* Barcode Mock Visual */}
              <div className="pt-3 text-center border-t border-black space-y-1">
                <div className="h-10 w-full flex items-center justify-center gap-1 overflow-hidden">
                  {[4, 2, 6, 1, 3, 5, 2, 4, 1, 6, 3, 2, 5, 2, 4, 1, 3, 6, 2, 4, 2, 5].map((w, idx) => (
                    <div
                      key={idx}
                      className="bg-black h-full"
                      style={{ width: `${w * 2}px` }}
                    />
                  ))}
                </div>
                <p className="text-[10px] tracking-widest font-bold">*{barcodeModalOrder.order_number}*</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Physical Label</span>
              </button>
              <button
                onClick={() => setBarcodeModalOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-border text-foreground font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
