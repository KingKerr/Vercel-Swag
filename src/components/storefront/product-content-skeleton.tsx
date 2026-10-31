import { PurchasePanelSkeleton } from "./purchase-panel-skeleton";

import styles from "@/app/products/[param]/product.module.css";

export function ProductContentSkeleton() {
  return (
    <div role="status" aria-label="Loading product">
      <div className={styles.layout} aria-hidden="true">
        <div
          className={`${styles.imageFrame} ${styles.imagePlaceholder}`}
        />

        <div className={styles.details}>
          <p className={styles.eyebrow}>Vercel collection</p>

          <div className={styles.titlePlaceholder} />
          <div className={styles.pricePlaceholder} />
          <div className={styles.descriptionPlaceholder} />

          <div className={styles.purchasePanel}>
            <PurchasePanelSkeleton />

            <p className={styles.purchaseNote}>
              Availability is checked when this panel loads.
              Items are not reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}