"use client";

import { useActionState } from "react";

import {
  startConciergeAction,
  type StartConciergeState,
} from "@/app/actions/concierge-session";

import { ConciergeChat } from "./concierge-chat";
import styles from "./concierge-chat.module.css";

const initialState: StartConciergeState = {
  status: "idle",
  message: "",
};

export function ConciergeEntry() {
  const [state, formAction, pending] = useActionState(
    startConciergeAction,
    initialState,
  );

  if (state.status === "ready" && state.sessionId) {
    return (
      <ConciergeChat
        key={state.sessionId}
        initialSessionId={state.sessionId}
      />
    );
  }

  return (
    <section
      className={styles.panel}
      aria-labelledby="concierge-start-title"
    >
      <h1 id="concierge-start-title">Swag Concierge</h1>

      <p>
        Explore the catalog and prepare a kit for review.
        Cart additions require your explicit approval.
      </p>

      <form action={formAction} className={styles.actions}>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "Connecting…" : "Start concierge"}
        </button>
      </form>

      <p role="status">{state.message}</p>
    </section>
  );
}