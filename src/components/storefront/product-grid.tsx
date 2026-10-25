import Image from "next/image";
import Link from "next/link";

import {
  formatPrice,
  type StorefrontProduct,
} from "@/lib/swag-api";

import styles from "@/app/home.module.css";

export function ProductGrid({
  products,
}: {
  products: StorefrontProduct[];
}) {
  return (
    <ul className={styles.productGrid}>
      {products.map((product) => (
        <li key={product.id}>
          <Link
            href={`/products/${encodeURIComponent(product.slug)}`}
            className={styles.productCard}
          >
            <div className={styles.productImage}>
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
                className={styles.productPhoto}
              />

              <span
                className={styles.productArrow}
                aria-hidden="true"
              >
                ↗
              </span>
            </div>

            <div className={styles.productDetails}>
              <h3>{product.name}</h3>
              <p>
                {formatPrice(product.price, product.currency)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}