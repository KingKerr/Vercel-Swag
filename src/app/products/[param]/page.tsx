import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  formatPrice,
  getFeaturedProducts,
  getProductBySlug,
} from "@/lib/swag-api";
import { ProductStockPanel } from "@/components/storefront/product-stock-panel";
import { PurchasePanelSkeleton } from "@/components/storefront/purchase-panel-skeleton";
import { ProductContentSkeleton } from "@/components/storefront/product-content-skeleton";
import styles from "./product.module.css";

type ProductPageProps = {
  params: Promise<{ param: string }>;
};

export async function generateStaticParams() {
  const products = await getFeaturedProducts();

  return products.map((product) => ({
    param: product.slug,
  }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { param } = await params;
  const product = await getProductBySlug(param);

  if (!product) {
    notFound();
  }

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      type: "website",
      images: [
        {
          url: product.images[0],
          alt: product.name,
        },
      ],
    },
  };
}

export default function ProductPage({
  params,
}: ProductPageProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={styles.page}
    >
      <Link href="/" className={styles.backLink}>
        ← Back to the collection
      </Link>

      <Suspense fallback={<ProductContentSkeleton />}>
        <ProductContent params={params} />
      </Suspense>
    </main>
  );
}

async function ProductContent({
  params,
}: ProductPageProps) {
  const { param } = await params;
  const product = await getProductBySlug(param);

  if (!product) {
    notFound();
  }

  return (
    <div className={styles.layout}>
      <div className={styles.imageFrame}>
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(max-width: 760px) 100vw, 55vw"
          className={styles.image}
        />
      </div>

      <section
        className={styles.details}
        aria-labelledby="product-title"
      >
        <p className={styles.eyebrow}>Vercel collection</p>

        <h1 id="product-title">{product.name}</h1>

        <p className={styles.price}>
          {formatPrice(product.price, product.currency)}
        </p>

        <p className={styles.description}>
          {product.description}
        </p>
        <div className={styles.purchasePanel} data-testid="purchase-frame">
            <Suspense fallback={<PurchasePanelSkeleton />}>
              <ProductStockPanel productId={product.id} />  
            </Suspense>
            <p className={styles.purchaseNote}>
                Availability is checked when this panel loads.
                Items are not reserved.
            </p>
        </div>
      </section>
    </div>
  );
}