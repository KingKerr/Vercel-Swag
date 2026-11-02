"use client";

import { useActionState } from "react";

import { approveProposalAction } from "@/app/actions/concierge";
import type { CommitProposalResult } from "@/lib/concierge-cart";

const initialState: CommitProposalResult = {
  status: "error",
  message: "",
  locked: false,
};

export function ProposalApprovalForm({
  proposalId,
  disabled = false,
}: {
  proposalId: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    approveProposalAction,
    initialState,
  );

  return (
    <form action={formAction}>
      <input
        type="hidden"
        name="proposalId"
        value={proposalId}
      />

      <p>
        This adds the exact products and quantities listed above.
        It does not place an order.
      </p>

      <button
        type="submit"
        disabled={disabled || pending || state.locked}
        aria-busy={pending}
        style={{
          minHeight: 44,
          padding: "12px 20px",
        }}
      >
        {pending ? "Adding reviewed items…" : "Add these items"}
      </button>

      <p role="status" aria-live="polite">
        {state.message}
      </p>
    </form>
  );
}