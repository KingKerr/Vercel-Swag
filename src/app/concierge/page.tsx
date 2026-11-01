import { notFound } from "next/navigation";

import { ConciergeChat } from "@/components/storefront/concierge-chat";

export default function ConciergePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <main id="main-content" tabIndex={-1}>
      <ConciergeChat />
    </main>
  );
}