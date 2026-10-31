import styles from "./cart-trigger.module.css";

type CartTriggerProps = {
  count?: number | null;
  loading?: boolean;
  onClick?: () => void;
};

export function CartTrigger({
  count = null,
  loading = false,
  onClick,
}: CartTriggerProps) {
  const badge =
    loading || count === null
      ? "—"
      : count > 99
        ? "99+"
        : String(count);

  const label = loading
    ? "Loading cart"
    : count === null
      ? "Cart unavailable"
      : `Cart: ${count} ${count === 1 ? "item" : "items"}`;

  return (
    <button
      type="button"
      className={styles.trigger}
      aria-label={label}
      aria-haspopup="dialog"
      aria-busy={loading}
      disabled={loading}
      onClick={onClick}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <path d="M5 7h14l1 14H4L5 7Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>

      <span>Cart</span>

      <span className={styles.badge} aria-hidden="true">
        {badge}
      </span>
    </button>
  );
}