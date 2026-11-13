import { Redirect, type Href } from "expo-router";
import type { ReactNode } from "react";

import type { Role } from "@/api/types";
import { homeRouteFor, needsKyc } from "@/lib/routing";
import { useAuth } from "@/store/auth";

/**
 * Guards a role's route group. `allowAnonymous` lets signed-out visitors in
 * (used for the public catalog in the buyer group).
 */
export function RoleGate({
  roles,
  allowAnonymous = false,
  requireKyc = false,
  children,
}: {
  roles: Role[];
  allowAnonymous?: boolean;
  requireKyc?: boolean;
  children: ReactNode;
}) {
  const user = useAuth((s) => s.user);

  if (!user) {
    return allowAnonymous ? <>{children}</> : <Redirect href="/login" />;
  }
  // Admins may look at any area; everyone else only at their own.
  if (!roles.includes(user.role) && user.role !== "ADMIN") {
    return <Redirect href={homeRouteFor(user) as Href} />;
  }
  if (requireKyc && needsKyc(user)) {
    return <Redirect href="/pending-approval" />;
  }
  return <>{children}</>;
}
