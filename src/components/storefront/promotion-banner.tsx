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
      <div className={styles.promotion}>
        Explore the latest developer essentials.
      </div>
    );
  }

  if (promotion === null) {
    return (
      <div className={styles.promotion}>
        Thoughtful gear for the things you build.
      </div>
    );
  }

  return (
    <aside
      className={styles.promotion}
      aria-label="Current promotion"
    >
      <span className={styles.promotionTitle}>
        {promotion.title}
      </span>

      <span>{promotion.description}</span>

      {promotion.code && (
        <span className={styles.promotionCode}>
          Code: <code>{promotion.code}</code>
        </span>
      )}
    </aside>
  );
}

export function PromotionFallback() {
  return (
    <div
      className={`${styles.promotion} ${styles.promotionPending}`}
      role="status"
    >
      Loading the latest promotion…
    </div>
  );
}