import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";

import { getActivePromotion } from "@/lib/swag-api";
import styles from "@/app/home.module.css";

export async function PromotionBanner() {
  await connection();

  let promotion: Awaited<
    ReturnType<typeof getActivePromotion>
  > = null;

  let requestFailed = false;

  try {
    promotion = await getActivePromotion();
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[storefront/promotion] Request or validation failed:",
      error,
    );

    requestFailed = true;
  }

  if (requestFailed) {
    return (
      <div
        className={styles.promotion}
        data-testid="promotion-ready"
      >
        <p className={styles.promotionMessage}>
          Explore the latest developer essentials.
        </p>
      </div>
    );
  }

  if (promotion === null) {
    return (
      <div
        className={styles.promotion}
        data-testid="promotion-ready"
      >
        <p className={styles.promotionMessage}>
          Thoughtful gear for the things you build.
        </p>
      </div>
    );
  }

  return (
    <aside
      className={styles.promotion}
      aria-label="Current promotion"
      data-testid="promotion-ready"
    >
      <div className={styles.promotionSummary}>
        <div className={styles.promotionCopy}>
          <p className={styles.promotionTitle}>
            {promotion.title}
          </p>
          <p className={styles.promotionDescription}>
            {promotion.description}
          </p>
          <p className={styles.promotionCodeLine}>
            {promotion.code ? (
                <>
                    Code:{" "}
                    <code className={styles.promotionInlineCode}>
                        {promotion.code}
                    </code>
                </>
            ) : null}
          </p>
        </div>
        

        <button
          type="button"
          className={styles.promotionDetailsButton}
          popoverTarget="store-promotion-details"
        >
          Details
          <span aria-hidden="true"> ↗</span>
        </button>
      </div>

      <div
        id="store-promotion-details"
        popover="auto"
        className={styles.promotionPopover}
        role="region"
        aria-labelledby="store-promotion-title"
      >
        <h2 id="store-promotion-title">
          {promotion.title}
        </h2>

        <p>{promotion.description}</p>

        {promotion.code && (
          <p>
            Promotion code:{" "}
            <code className={styles.promotionCode}>
              {promotion.code}
            </code>
          </p>
        )}

        <button
          type="button"
          className={styles.promotionClose}
          popoverTarget="store-promotion-details"
          popoverTargetAction="hide"
        >
          Close details
        </button>
      </div>
    </aside>
  );
}

export function PromotionFallback() {
  return (
    <div
      className={styles.promotion}
      role="status"
      data-testid="promotion-loading"
    >
      <span className={styles.promotionSkeleton} aria-hidden="true" />
      <span className={styles.visuallyHidden}>
        Loading the latest promotion…
      </span>
    </div>
  );
}