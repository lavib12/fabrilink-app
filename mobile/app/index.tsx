import { Redirect, type Href } from "expo-router";

import { homeRouteFor } from "@/lib/routing";
import { useAuth } from "@/store/auth";

export default function Index() {
  const user = useAuth((s) => s.user);
  return <Redirect href={homeRouteFor(user) as Href} />;
}
