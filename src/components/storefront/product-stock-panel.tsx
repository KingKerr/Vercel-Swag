import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";

import { getProductStock } from "@/lib/swag-api";
import { ProductPurchaseForm } from "./product-purchase-form";

import styles from "@/app/products/[param]/product.module.css";

export async function ProductStockPanel({
  productId,
}: {
  productId: string;
}) {
  await connection();

  let stock: Awaited<
    ReturnType<typeof getProductStock>
  > | null = null;

  try {
    stock = await getProductStock(productId);
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[storefront/stock] Unable to load availability:",
      error,
    );
  }

  if (stock === null) {
    return (
      <div data-testid="purchase-ready">
        <p
          className={`${styles.stockStatus} ${styles.outOfStock}`}
        >
          Availability temporarily unavailable
        </p>

        <ProductPurchaseForm
          key={productId}
          productId={productId}
          stock={0}
          availabilityUnavailable
        />
      </div>
    );
  }

  // The null case returned above, so stock is now non-null.
  const available = stock.inStock && stock.stock > 0;

  const statusText = available
    ? stock.lowStock
      ? `Only ${stock.stock} available`
      : `${stock.stock} available`
    : "Currently out of stock";

  return (
    <div data-testid="purchase-ready">
      <p
        className={`${styles.stockStatus} ${
          available ? styles.inStock : styles.outOfStock
        }`}
      >
        {statusText}
      </p>

      <ProductPurchaseForm
        key={productId}
        productId={productId}
        stock={available ? stock.stock : 0}
      />
    </div>
  );
}