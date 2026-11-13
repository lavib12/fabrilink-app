import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import { Navbar } from "@/components/shared/Navbar";
import {
  LayoutDashboard,
  Layers,
  Truck,
  CreditCard,
  FileCheck,
  Scissors,
  Users,
  Settings,
  Sparkles,
  Factory,
  AlertTriangle,
} from "lucide-react";

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const getNavLinks = () => {
    if (!user) return [];
    switch (user.role) {
      case "FACTORY":
        return [
          { name: "Overview", path: "/factory/dashboard", icon: LayoutDashboard },
          { name: "My Fabric Stock", path: "/factory/stock", icon: Layers },
          { name: "Pickup Schedules", path: "/factory/pickups", icon: Truck },
          { name: "Payouts & Ledger", path: "/factory/payouts", icon: CreditCard },
          { name: "Buyer Requests", path: "/factory/requests", icon: FileCheck },
          ...(user?.company?.id
            ? [{ name: "My Storefront", path: `/stores/${user.company.id}`, icon: Factory }]
            : []),
        ];
      case "BUYER":
        return [
          { name: "My Orders", path: "/buyer/orders", icon: LayoutDashboard },
          { name: "Exclusive Profiles", path: "/buyer/profiles", icon: Sparkles },
          { name: "Browse Surplus", path: "/catalog", icon: Layers },
          { name: "Custom Requests", path: "/buyer/requests", icon: FileCheck },
          { name: "B2B Credit Line", path: "/buyer/credit", icon: CreditCard },
        ];
      case "HUB_STAFF":
        return [
          { name: "Incoming Receiving", path: "/hub/receiving", icon: Truck },
          { name: "Cutting Jobs Queue", path: "/hub/queue", icon: Scissors },
          { name: "Dispatch Handover", path: "/hub/dispatch", icon: Layers },
        ];
      case "ADMIN":
        return [
          { name: "KYC Queue", path: "/admin/kyc", icon: Users },
          { name: "Sourcing Requests", path: "/admin/matching", icon: FileCheck },
          { name: "All Orders", path: "/admin/orders", icon: LayoutDashboard },
          { name: "Company Directory", path: "/admin/companies", icon: Settings },
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* Warning if company verification is pending */}
      {user?.company && user.company.verification_status !== "APPROVED" && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2.5 px-4 text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>
            Your company verification is currently <strong>{user.company.verification_status}</strong>. Full trading and cut requests will unlock once trade license is approved.
          </span>
          <Link to="/approval-pending" className="underline font-bold ml-1">
            View Details
          </Link>
        </div>
      )}

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-64 hidden md:block flex-shrink-0">
          <div className="sticky top-24 bg-card rounded-2xl border border-border p-4 shadow-sm space-y-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
                {user?.role} Portal
              </p>
              <p className="text-sm font-bold text-foreground px-3 truncate mt-1">
                {user?.company?.name || user?.email}
              </p>
            </div>

            <nav className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "text-foreground/70 hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Dashboard Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
