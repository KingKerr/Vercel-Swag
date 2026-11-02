import "server-only";

export function conciergeEnabled() {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.CONCIERGE_DEMO_ENABLED === "true"
  );
}