"use server";

import { unstable_rethrow } from "next/navigation";
import { refresh } from "next/cache";
import {
  commitShopperProposal,
  type CommitProposalResult,
} from "@/lib/concierge-cart";
import {
  createShopperProposal,
  ProposalInputError,
} from "@/lib/concierge-proposals";

import { ensureShopperSession } from "@/lib/concierge-session";
import { reserveConciergeUsage } from "../../../shared/concierge-usage";
import { conciergeEnabled } from "@/lib/concierge-access";

export type PrepareProposalState = {
  status: "idle" | "success" | "error";
  message: string;
  proposalId?: string;
};

export async function prepareProposalAction(
  _previousState: PrepareProposalState,
  formData: FormData,
): Promise<PrepareProposalState> {
  // Temporary restriction while we verify ownership and review.
  // Remove only when reviewer access and rate controls are connected.
  if (!conciergeEnabled()) {
    return {
      status: "error",
      message: "Proposal preparation is not enabled on this deployment.",
    };
  }

  const payload = formData.get("payload");

  if (typeof payload !== "string" || payload.length > 6000) {
    return {
      status: "error",
      message: "Provide a valid proposal payload.",
    };
  }

  let input: unknown;

  try {
    input = JSON.parse(payload);
  } catch {
    return {
      status: "error",
      message: "The proposal payload must be valid JSON.",
    };
  }

  try {
    const shopper = await ensureShopperSession();
    const allowed = await reserveConciergeUsage(
        "proposal", 
        shopper.id,  
    );
    if (!allowed) {
        return {
            status: "error",
            message:
              "This demo's proposal allowance has been reached. " +
              "Please wait before preparing another kit.",
           
        };
    }
    const result = await createShopperProposal(input);

    return {
      status: "success",
      message: "Proposal prepared. No cart changes were made.",
      proposalId: result.proposalId,
    };
  } catch (error) {
    unstable_rethrow(error);

    return {
      status: "error",
      message:
        error instanceof ProposalInputError
          ? error.message
          : "Unable to prepare the proposal. Check the catalog, " +
            "cart session, and database configuration.",
    };
  }
}

export async function approveProposalAction(
  _previousState: CommitProposalResult,
  formData: FormData,
): Promise<CommitProposalResult> {
  if (!conciergeEnabled()) {
    return {
      status: "error",
      message: "Cart execution is not enabled on this deployment.",
      locked: true,
    };
  }

  const proposalId = formData.get("proposalId");

  if (typeof proposalId !== "string") {
    return {
      status: "error",
      message: "Invalid proposal.",
      locked: false,
    };
  }

  let result: CommitProposalResult;

  try {
    result = await commitShopperProposal(proposalId);
  } catch (error) {
    unstable_rethrow(error);

    return {
      status: "review",
      message:
        "Unable to confirm the operation status. Inspect your cart " +
        "and operation record before trying again.",
      locked: true,
    };
  }

  refresh();
  return result;
}