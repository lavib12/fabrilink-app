import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { RoleGuard } from "./guards/RoleGuard";

import { LandingPage } from "@/features/public/LandingPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { PendingApprovalPage } from "@/features/auth/pages/PendingApprovalPage";

import { CatalogBrowsePage } from "@/features/catalog/pages/CatalogBrowsePage";
import { FabricDetailPage } from "@/features/catalog/pages/FabricDetailPage";
import { FactoryStorePage } from "@/features/catalog/pages/FactoryStorePage";
import { FactoryDashboardPage } from "@/features/factory-dashboard/pages/FactoryDashboardPage";
import { BuyerOrdersPage } from "@/features/buyer-dashboard/pages/BuyerOrdersPage";
import { HubQueuePage } from "@/features/hub/pages/HubQueuePage";
import { AdminKYCPage } from "@/features/admin/pages/AdminKYCPage";
import { RouteError } from "@/components/shared/RouteError";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
      {
        path: "approval-pending",
        element: <PendingApprovalPage />,
      },
      {
        path: "catalog",
        element: <CatalogBrowsePage />,
      },
      {
        path: "catalog/:id",
        element: <FabricDetailPage />,
      },
      {
        path: "stores/:id",
        element: <FactoryStorePage />,
      },
      {
        path: "mills/:id",
        element: <FactoryStorePage />,
      },
      {
        path: "how-it-works",
        element: <LandingPage />,
      },
    ],
  },
  {
    path: "/factory",
    element: (
      <RoleGuard allowedRoles={["FACTORY", "ADMIN"]}>
        <DashboardLayout />
      </RoleGuard>
    ),
    errorElement: <RouteError />,
    children: [
      {
        path: "dashboard",
        element: <FactoryDashboardPage />,
      },
      {
        path: "stock",
        element: <FactoryDashboardPage />,
      },
      {
        path: "pickups",
        element: <FactoryDashboardPage />,
      },
      {
        path: "payouts",
        element: <FactoryDashboardPage />,
      },
      {
        path: "requests",
        element: <FactoryDashboardPage />,
      },
    ],
  },
  {
    path: "/buyer",
    element: (
      <RoleGuard allowedRoles={["BUYER", "ADMIN"]}>
        <DashboardLayout />
      </RoleGuard>
    ),
    errorElement: <RouteError />,
    children: [
      {
        path: "orders",
        element: <BuyerOrdersPage />,
      },
      {
        path: "profiles",
        element: <BuyerOrdersPage />,
      },
      {
        path: "requests",
        element: <BuyerOrdersPage />,
      },
      {
        path: "credit",
        element: <BuyerOrdersPage />,
      },
    ],
  },
  {
    path: "/hub",
    element: (
      <RoleGuard allowedRoles={["HUB_STAFF", "ADMIN"]}>
        <DashboardLayout />
      </RoleGuard>
    ),
    errorElement: <RouteError />,
    children: [
      {
        path: "queue",
        element: <HubQueuePage />,
      },
      {
        path: "receiving",
        element: <HubQueuePage />,
      },
      {
        path: "dispatch",
        element: <HubQueuePage />,
      },
    ],
  },
  {
    path: "/admin",
    element: (
      <RoleGuard allowedRoles={["ADMIN"]}>
        <DashboardLayout />
      </RoleGuard>
    ),
    errorElement: <RouteError />,
    children: [
      {
        path: "kyc",
        element: <AdminKYCPage />,
      },
      {
        path: "matching",
        element: <AdminKYCPage />,
      },
      {
        path: "orders",
        element: <AdminKYCPage />,
      },
      {
        path: "companies",
        element: <AdminKYCPage />,
      },
      {
        // Old link; shows the company directory.
        path: "settings",
        element: <AdminKYCPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
