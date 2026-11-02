"use client";

import { useRef, useState, type FormEvent } from "react";
import { useEveAgent } from "eve/react";
import { activeTurn, openInteractions } from "eve/events";
import { KitProposalCard } from "./kit-proposal-card";
import styles from "./concierge-chat.module.css";

export function ConciergeChat({
  initialSessionId,
}: {
  initialSessionId: string;
}) {
  const agent = useEveAgent({
    initialSession: {
      sessionId: initialSessionId,
      streamIndex: 0,
    },
    resume: true,
  });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(
    null,
  );
  const [uiError, setUiError] = useState("");

  // Prevent overlapping local actions before React updates the UI.
  const actionInFlight = useRef(false);

  const turnOpen = activeTurn(agent.view) !== undefined;
  const isResuming = agent.status === "resuming";
  const isResponding = respondingId !== null;

  const pendingApprovals = openInteractions(agent.view).filter(
    (interaction) =>
      interaction.request.kind === "approval" &&
      interaction.answer === undefined,
  );

  const hasPendingApproval = pendingApprovals.length > 0;

  const busy =
    sending ||
    cancelling ||
    isResponding ||
    turnOpen ||
    agent.status === "busy" ||
    isResuming;

  const composerDisabled = busy || hasPendingApproval;

  // An open turn must not, by itself, disable its approval buttons.
  const approvalDisabled =
    sending ||
    cancelling ||
    isResponding ||
    isResuming;

  const stopDisabled =
    !turnOpen ||
    sending ||
    cancelling ||
    isResponding ||
    isResuming;

  const toolCalls = agent.events.filter(
    (event) => event.type === "call.requested",
  ).length;

  const statusText = uiError
    ? uiError
    : agent.error
      ? "The agent encountered an error. Check the server logs."
      : cancelling
        ? "Stopping…"
        : isResuming
          ? "Synchronizing conversation…"
          : isResponding
            ? "Submitting your decision…"
            : hasPendingApproval
              ? "Waiting for your decision."
              : busy
                ? "Working…"
                : "Ready";

  async function answerApproval(
    interactionId: string,
    optionId: string,
  ) {
    if (actionInFlight.current || approvalDisabled) {
      return;
    }

    const interaction = pendingApprovals.find(
      (item) => item.interactionId === interactionId,
    );

    const optionExists = interaction?.request.options?.some(
      (option) => option.id === optionId,
    );

    if (!optionExists) {
      setUiError(
        "This approval option is no longer available. Check the current prompt.",
      );
      return;
    }

    actionInFlight.current = true;
    setUiError("");
    setRespondingId(interactionId);

    try {
      await agent.respond([
        {
          interactionId,
          optionId,
        },
      ]);
    } catch {
      setUiError(
        "Unable to confirm your decision. Check the approval status before trying again.",
      );
    } finally {
      actionInFlight.current = false;
      setRespondingId(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();

    if (
      !message ||
      composerDisabled ||
      actionInFlight.current
    ) {
      return;
    }

    actionInFlight.current = true;
    setUiError("");
    setSending(true);

    try {
      await agent.send(message);
      setInput("");
    } catch {
      setUiError(
        "Unable to confirm the message was sent. Check the conversation before retrying.",
      );
    } finally {
      actionInFlight.current = false;
      setSending(false);
    }
  }

    async function stop() {
    if (stopDisabled || actionInFlight.current) {
      return;
    }

    actionInFlight.current = true;
    setUiError("");
    setCancelling(true);

    try {
      await agent.cancel();
    } catch {
      setUiError(
        "Unable to confirm cancellation. The turn may still be running.",
      );
    } finally {
      actionInFlight.current = false;
      setCancelling(false);
    }
  }

  const latestKitCall = agent.messages
    .flatMap((message) =>
      message.parts.flatMap((part) =>
        part.type === "tool" &&
        part.name === "validate_kit"
          ? [part]
          : [],
      ),
    )
    .at(-1);

  

  return (
    <section
      className={styles.panel}
      aria-labelledby="concierge-title"
    >
      <header>
        <p className={styles.eyebrow}>
          Local integration preview
        </p>

        <h1 id="concierge-title">Swag Concierge</h1>

        <p>Explore the catalog and build a kit. Cart additions require your explicit approval on the review page.</p>
      </header>

      <div
        className={styles.transcript}
        role="log"
        aria-label="Conversation"
      >
        {agent.messages.length === 0 && (
          <p className={styles.empty}>
            Try: “Find a few desk accessories. No clothing.”
          </p>
        )}

        {agent.messages.map((message) => {
          if (
            message.role !== "user" &&
            message.role !== "assistant"
          ) {
            return null;
          }

          const textParts = message.parts.filter(
            (part) => part.type === "text",
          );

          if (textParts.length === 0) {
            return null;
          }

          return (
            <article
              key={message.id}
              className={styles.message}
            >
              <h2>
                {message.role === "user"
                  ? "You"
                  : "Concierge"}
              </h2>

              {textParts.map((part, index) => (
                <p key={part.id ?? index}>{part.text}</p>
              ))}
            </article>
          );
        })}
      </div>

      <div className={styles.activity}>
        <p className={styles.status} role="status">
          {statusText}
        </p>

        <p className={styles.toolCount}>
          Tool calls in this conversation: {toolCalls}
        </p>
      </div>
      {latestKitCall?.state === "completed" && (
        <KitProposalCard
          key={latestKitCall.callId}
          output={latestKitCall.output}
          disabled={composerDisabled}
        />
       )}

      {pendingApprovals.map(
        ({ interactionId, request }) => (
          <fieldset
            key={interactionId}
            className={styles.approval}
            disabled={approvalDisabled}
          >
            <legend>Review requested action</legend>

            <p className={styles.approvalPrompt}>
              {request.prompt}
            </p>

            <p className={styles.approvalNote}>
              Review the exact action before choosing an
              option. Sending another chat message does not
              approve it.
            </p>

            <div className={styles.approvalActions}>
              {request.options?.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    void answerApproval(
                      interactionId,
                      option.id,
                    );
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        ),
      )}

      <form onSubmit={submit} className={styles.form}>
        <label htmlFor="concierge-message">
          Ask about the catalog
        </label>

        <textarea
          id="concierge-message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={1000}
          rows={3}
          disabled={composerDisabled}
          placeholder="Find a few desk accessories. No clothing."
        />

        <div className={styles.actions}>
          <button
            type="submit"
            disabled={composerDisabled || !input.trim()}
          >
            Send
          </button>

          <button
            type="button"
            onClick={() => {
              void stop();
            }}
            disabled={stopDisabled}
          >
            {cancelling ? "Stopping…" : "Stop"}
          </button>
        </div>
      </form>
    </section>
  );
}