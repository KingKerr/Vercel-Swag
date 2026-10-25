import { getFeaturedProducts } from "@/lib/swag-api";

import { ProductGrid } from "./product-grid";

export async function FeaturedProducts() {
  const products = await getFeaturedProducts();

  return <ProductGrid products={products} />;
}