import Link from "next/link";
import styles from "./site-shell.module.css";
import { Suspense } from "react";
import { CartIndicator } from "./cart-indicator";
import { CartTrigger } from "./cart-trigger";

function VercelMark() {
  return (
    <svg
      width="24"
      height="22"
      viewBox="0 0 24 22"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 1 24 22H0L12 1Z" fill="currentColor" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="Vercel Swag Store homepage"
        >
          <VercelMark />
          <span>Swag Store</span>
        </Link>

        <nav className={styles.navigation} aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/search">Search</Link>
          <div className={styles.cartSlot} data-testid="cart-slot">
            <Suspense fallback={<CartTrigger loading />}>
                <CartIndicator />
            </Suspense>
          </div> 
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ year }: { year: number }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div>
          <Link href="/" className={styles.footerBrand}>
            <VercelMark />
            <span>Swag Store</span>
          </Link>

          <p className={styles.disclaimer}>
            A fictional storefront built for the Vercel take-home project.
          </p>
        </div>

        <p className={styles.copyright}>
          © {year} Vercel Swag Store
        </p>
      </div>
    </footer>
  );
}