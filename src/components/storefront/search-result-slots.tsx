import {
  type StorefrontProduct,
} from "@/lib/swag-api";

import { ProductCard } from "./product-grid";

import styles from "@/app/search/search.module.css";

export function SearchResultSlots({
  products,
}: {
  products: StorefrontProduct[];
}) {
  const visibleProducts = products.slice(0, 5);
  const emptyCount = 5 - visibleProducts.length;

  return (
    <>
      {visibleProducts.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}

      {Array.from({ length: emptyCount }, (_, index) => (
        <li
          key={`empty-slot:${index}`}
          className={styles.emptySlot}
          aria-hidden="true"
        >
          <CardPlaceholder />
        </li>
      ))}
    </>
  );
}

export function SearchResultSkeletons() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <li key={`loading-slot:${index}`} aria-hidden="true">
          <CardPlaceholder />
        </li>
      ))}
    </>
  );
}

function CardPlaceholder() {
  return (
    <div>
      <div className={styles.cardImagePlaceholder} />

      <div className={styles.cardMetaPlaceholder}>
        <span className={styles.cardTextPlaceholder} />
      </div>
    </div>
  );
}