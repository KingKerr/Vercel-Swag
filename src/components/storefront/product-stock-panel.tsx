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

  let stock: Awaited<ReturnType<typeof getProductStock>> | null = null;

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
      <div className={styles.purchasePanel}>
        <p className={styles.outOfStock}>
          Availability is temporarily unavailable.
        </p>

        <p className={styles.purchaseNote}>
          Refresh the page to try again.
        </p>
      </div>
    );
  }

  const available = stock.inStock && stock.stock > 0;

  return (
    <div className={styles.purchasePanel}>
      <p
        className={
          available ? styles.inStock : styles.outOfStock
        }
      >
        {available
          ? stock.lowStock
            ? `Only ${stock.stock} available`
            : `${stock.stock} available`
          : "Currently out of stock"}
      </p>

      <ProductPurchaseForm
        key={productId}
        productId={productId}
        stock={available ? stock.stock : 0}
      />  
      
      <p className={styles.purchaseNote}>
        Availability is checked when this panel loads.
        Items are not reserved.
      </p>
    </div>
  );
}