import styles from "@/app/products/[param]/product.module.css";

export function PurchasePanelSkeleton() {
  return (
    <div role="status" aria-label="Checking availability">
      <div className={styles.stockStatus} aria-hidden="true">
        <span className={styles.stockPlaceholder} />
      </div>

      <div className={styles.purchaseForm} aria-hidden="true">
        <div className={styles.quantityField}>
          <span className={styles.quantityLabel}>Quantity</span>
          <div className={styles.quantityPlaceholder} />
        </div>

        <button
          type="button"
          className={styles.addButton}
          disabled
          tabIndex={-1}
        >
          Checking availability…
        </button>

        <div className={styles.actionMessage} />
      </div>
    </div>
  );
}