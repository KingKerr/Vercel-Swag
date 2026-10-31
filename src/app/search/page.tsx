import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  getCategories,
  searchProducts,
} from "@/lib/swag-api";
import {
  getSearchState,
  type SearchParams,
} from "@/lib/search-state";

import { SearchForm } from "@/components/storefront/search-form";
import {
  SearchResultSkeletons,
  SearchResultSlots,
} from "@/components/storefront/search-result-slots";

import cardStyles from "@/app/home.module.css";
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

type SearchPageProps = {
  searchParams: Promise<SearchParams>;
};

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

      <div
        className={styles.controlsFrame}
        data-testid="search-controls-frame"
      >
        <Suspense fallback={<SearchControlsSkeleton />}>
          <SearchControls searchParams={searchParams} />
        </Suspense>
      </div>

      <section
        className={styles.resultsFrame}
        aria-labelledby="search-results-title"
        data-testid="search-results-frame"
      >
        <div className={styles.resultsHeading}>
          <h2 id="search-results-title">Search results</h2>
        </div>

        <Suspense fallback={<SearchResultsFallback />}>
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

async function SearchControls({
  searchParams,
}: SearchPageProps) {
  let data: {
    params: SearchParams;
    categories: Awaited<ReturnType<typeof getCategories>>;
  } | null = null;

  try {
    const [params, categories] = await Promise.all([
      searchParams,
      getCategories(),
    ]);

    data = { params, categories };
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[storefront/search] Controls failed:",
      error,
    );
  }

  if (data === null) {
    return <SearchControlsSkeleton failed />;
  }

  const state = getSearchState(data.params, data.categories);

  return (
    <>
      <SearchForm
        key={`search-form:${JSON.stringify([
          state.query,
          state.category,
        ])}`}
        query={state.query}
        category={state.category}
        categories={data.categories}
      />

      <p className={styles.controlsStatus} role="status">
        {state.validationMessage}
      </p>
    </>
  );
}

async function SearchResults({
  searchParams,
}: SearchPageProps) {
  await connection();

  let products: Awaited<
    ReturnType<typeof searchProducts>
  > = [];

  let message = "";
  let failed = false;

  try {
    const [params, categories] = await Promise.all([
      searchParams,
      getCategories(),
    ]);

    const state = getSearchState(params, categories);

    if (state.validationMessage) {
      message = state.validationMessage;
    } else {
      products = await searchProducts({
        query: state.query,
        category: state.category,
      });

      if (products.length === 0) {
        message = "No matching products. Try another search or category.";
      } else {
        const filtered = Boolean(state.query || state.category);

        message = filtered
          ? `Showing ${products.length} ${
              products.length === 1 ? "product" : "products"
            } · up to 5 matches`
          : `Explore the collection · showing ${products.length} products`;
      }
    }
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "[storefront/search] Results failed:",
      error,
    );

    failed = true;
    message =
      "We couldn’t load the products. Submit your search again or refresh.";
  }

  return (
    <div data-testid="search-results-ready">
      <p
        className={styles.resultsStatus}
        role="status"
        tabIndex={0}
      >
        {message}
      </p>

      <ul className={cardStyles.productGrid}>
        <SearchResultSlots products={failed ? [] : products} />
      </ul>
    </div>
  );
}

function SearchResultsFallback() {
  return (
    <div
      role="status"
      aria-label="Loading products"
      data-testid="search-results-loading"
    >
      <p className={styles.resultsStatus}>Loading products…</p>

      <ul className={cardStyles.productGrid}>
        <SearchResultSkeletons />
      </ul>
    </div>
  );
}

function SearchControlsSkeleton({
  failed = false,
}: {
  failed?: boolean;
}) {
  return (
    <>
      <div
        className={styles.form}
        aria-hidden="true"
      >
        <div className={styles.field}>
          <span>Search products</span>
          <input disabled placeholder="Search products" />
        </div>

        <div className={styles.field}>
          <span>Category</span>
          <select disabled>
            <option>All categories</option>
          </select>
        </div>

        <button className={styles.submit} disabled type="button">
          Search
        </button>

        <span className={styles.reset}>Clear</span>
      </div>

      <p className={styles.controlsStatus} role="status">
        {failed
          ? "Search controls are unavailable. Refresh to try again."
          : "Loading search controls…"}
      </p>
    </>
  );
}