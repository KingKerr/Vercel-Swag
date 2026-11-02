import { notFound } from "next/navigation";
import { ConciergeEntry } from "@/components/storefront/concierge-entry";
import { conciergeEnabled } from "@/lib/concierge-access";


export default function ConciergePage() {
  if (!conciergeEnabled()) {
    notFound();
  }

  return (
    <main id="main-content" tabIndex={-1}>
      <ConciergeEntry /> 
    </main>
  );
}