import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  getCategories,
  searchProducts,
} from "@/lib/swag-api";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SearchForm } from "@/components/storefront/search-form";

import styles from "./search.module.css";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Explore Vercel apparel, accessories, and everyday essentials.",
  openGraph: {
    title: "Search the Vercel Swag Store",
    description:
      "Find developer apparel, accessories, and everyday essentials.",
    type: "website",
  },
};

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

type SearchPageProps = {
  searchParams: Promise<SearchParams>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function SearchPage({
  searchParams,
}: SearchPageProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={styles.page}
    >
      <header className={styles.heading}>
        <p className={styles.eyebrow}>The collection</p>
        <h1>Find your everyday essentials.</h1>
        <p>Browse the collection or search for something specific.</p>
      </header>

      <Suspense fallback={<SearchLoading />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchContent({
  searchParams,
}: SearchPageProps) {
  const params = await searchParams;

  const query = first(params.q).trim();
  const requestedCategory = first(params.category).trim();

  let categories: Awaited<
    ReturnType<typeof getCategories>
  > | null = null;

  try {
    categories = await getCategories();
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[storefront/search] Category request failed:",
      error,
    );
  }

  if (categories === null) {
    return (
      <div className={styles.notice}>
        <h2>Search is temporarily unavailable</h2>
        <p>We couldn’t load the categories. Refresh to try again.</p>
      </div>
    );
  }

  const validCategory =
    requestedCategory === "" ||
    categories.some(
      (category) => category.slug === requestedCategory,
    );

  const category = validCategory ? requestedCategory : "";

  const validationMessage =
    query.length > 120
      ? "Please keep your search to 120 characters or fewer."
      : !validCategory
        ? "That category is not available. Choose another category."
        : null;

  return (
    <>
      <SearchForm
        key={`search-form:${JSON.stringify([query, category])}`}
        query={query}
        category={category}
        categories={categories}
      />

      {validationMessage ? (
        <div className={styles.notice} role="status">
          <p>{validationMessage}</p>
        </div>
      ) : (
        <Suspense
          key={`search-results:${JSON.stringify([query, category])}`}
          fallback={<SearchLoading />}
        >
          <SearchResults query={query} category={category} />
        </Suspense>
      )}
    </>
  );
}

async function SearchResults({
  query,
  category,
}: {
  query: string;
  category: string;
}) {
  await connection();

  let products: Awaited<
    ReturnType<typeof searchProducts>
  > | null = null;

  try {
    products = await searchProducts({ query, category });
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[storefront/search] Product request failed:",
      error,
    );
  }

  if (products === null) {
    return (
      <div className={styles.notice}>
        <h2>We couldn’t load the products</h2>
        <p>Submit your search again or refresh the page.</p>
      </div>
    );
  }

  const filtered = Boolean(query || category);

  if (products.length === 0) {
    return (
      <section
        className={styles.notice}
        aria-labelledby="empty-search-title"
      >
        <h2 id="empty-search-title">No matching products</h2>

        <p>
          Try a different search term or choose another category.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="search-results-title">
      <div className={styles.resultsHeading}>
        <h2 id="search-results-title">
          {filtered ? "Search results" : "Explore the collection"}
        </h2>

        <p role="status">
          Showing {products.length}{" "}
          {products.length === 1 ? "product" : "products"}
          {filtered ? " · up to 5 matches" : ""}
        </p>
      </div>

      <ProductGrid products={products} />
    </section>
  );
}

function SearchLoading() {
  return (
    <div className={styles.loading} role="status">
      Loading products…
    </div>
  );
}