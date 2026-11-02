import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProposalApprovalForm } from "@/components/storefront/proposal-approval-form";
import { readShopperProposal } from "@/lib/concierge-proposals";
import { readShopperOperation } from "@/lib/concierge-cart";

type PageProps = {
  params: Promise<{ proposalId: string }>;
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function price(cents: number) {
  return usd.format(cents / 100);
}

async function ProposalReview({ params }: PageProps) {
  const { proposalId } = await params;
  const [proposal, operation] = await Promise.all([
    readShopperProposal(proposalId),
    readShopperOperation(proposalId),
  ]);
  if (operation) {
    const messages = {
        claimed:
          "This proposal has been submitted. Do not submit it again.",
        running:
          "This operation started. Refresh to check its recorded outcome; do not resubmit it.",
        succeeded:    
          "All reviewed additions were confirmed. No purchase was made.",
        failed:
          "Execution stopped before any cart mutation was attempted. Prepare a fresh proposal.",
        needs_review:
          "Execution stopped after a cart mutation was attempted. Inspect your cart before continuing. This proposal cannot be retried.",
    };

    return (
        <section aria-labelledby="operation-title">
          <h1 id="operation-title">Cart operation</h1>
          <p role="status">
            {messages[operation.status]}
          </p>
          <ul>
            {operation.items.map((item) =>(
                <li key={item.productId}>
                  {item.productId}
                  {" - "}
                  {item.quantity} requested 
                  {" — "}
                  {item.status}
                </li>
            ))}
          </ul>
          <p>
            “Attempting” or “uncertain” does not mean an addition
            failed. Do not repeat those additions without checking
            the cart.
          </p>
          <Link href="/concierge">Back to concierge</Link>
        </section>
    );
  }
  if (!proposal) {
    notFound();
  }

  return (
    <section aria-labelledby="proposal-title">
      <h1 id="proposal-title">Review your kit</h1>

      <p>
        These are proposed additions. Your cart has not changed.
      </p>

      {!proposal.cartIdentityMatches && (
        <p role="alert">
          Your cart session has changed. Prepare a new proposal
          before adding these items.
        </p>
      )}

      <ul>
        {proposal.items.map((item) => (
          <li key={item.productId}>
            <h2>
              <Link
                href={`/products/${encodeURIComponent(item.slug)}`}
              >
                {item.name}
              </Link>
            </h2>

            <p>
              {item.quantity} × {price(item.unitPriceCents)}
              {" — "}
              {price(item.lineTotalCents)}
            </p>
          </li>
        ))}
      </ul>

      <p>
        Merchandise subtotal: {price(proposal.subtotalCents)}
      </p>

      <p>
        Merchandise budget: {price(proposal.budgetCents)}
      </p>

      <p>
        Tax and shipping are excluded. Stock was checked when
        this proposal was prepared, but has not been reserved.
      </p>

      <p>
        Review expires at{" "}
        <time dateTime={proposal.expiresAt}>
          {proposal.expiresAt}
        </time>
        .
      </p>

      <ProposalApprovalForm
        proposalId={proposal.id}
        disabled={!proposal.cartIdentityMatches}
       />

      <Link href="/concierge">Back to concierge</Link>
    </section>
  );
}

export default function ProposalReviewPage(props: PageProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      style={{
        maxWidth: 800,
        margin: "40px auto",
        paddingInline: 20,
      }}
    >
      <Suspense
        fallback={
          <section
            aria-label="Loading proposal"
            style={{ minHeight: 420 }}
          >
            <p role="status">Loading your proposal…</p>
          </section>
        }
      >
        <ProposalReview {...props} />
      </Suspense>
    </main>
  );
}