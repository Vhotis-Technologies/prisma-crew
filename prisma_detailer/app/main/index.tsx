import { useEffect } from "react";
import { router } from "expo-router";

/**
 * Default main route: redirect to dashboard so /main opens the dashboard tab.
 */
export default function MainIndex() {
  useEffect(() => {
    router.replace("/main/dashboard/DashboardScreen");
  }, []);

  return null;
}
