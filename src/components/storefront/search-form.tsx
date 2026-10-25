"use client";

import Form from "next/form";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import styles from "@/app/search/search.module.css";

type CategoryOption = {
  slug: string;
  name: string;
};

export function SearchForm({
  query,
  category,
  categories,
}: {
  query: string;
  category: string;
  categories: CategoryOption[];
}) {
  return (
    <Form action="/search" className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="product-query">Search products</label>

        <input
          id="product-query"
          name="q"
          type="search"
          placeholder="Try hoodie, bag, or desk"
          defaultValue={query}
          maxLength={120}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="product-category">Category</label>

        <select
          id="product-category"
          name="category"
          defaultValue={category}
        >
          <option value="">All categories</option>

          {categories.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <SearchButton />

      <Link href="/search" className={styles.reset}>
        Clear
      </Link>
    </Form>
  );
}

function SearchButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={styles.submit}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Searching…" : "Search"}
    </button>
  );
}