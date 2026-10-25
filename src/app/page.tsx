import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FeaturedProducts } from "@/components/storefront/featured-products";
import {
  PromotionBanner,
  PromotionFallback,
} from "@/components/storefront/promotion-banner";

import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Vercel Swag Store",
  description:
    "Developer apparel, desk essentials, and everyday gear inspired by the things you build.",
  openGraph: {
    title: "Vercel Swag Store",
    description:
      "Developer apparel, desk essentials, and everyday gear.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.home}>
      <Suspense fallback={<PromotionFallback />}>
        <PromotionBanner />
      </Suspense>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>The developer collection</p>

          <h1 id="hero-title">
            For the things
            <br />
            you build.
          </h1>

          <p className={styles.heroDescription}>
            Everyday essentials for people who turn ideas into
            something real. At your desk. On the move. Between deploys.
          </p>

          <Link href="/search" className={styles.primaryButton}>
            Explore the collection
            <span aria-hidden="true">↗</span>
          </Link>

          <p className={styles.heroNote}>
            Apparel. Accessories. A little shipping energy.
          </p>
        </div>

        <div className={styles.heroArtwork} aria-hidden="true">
          <div className={styles.artGrid} />

          <div className={styles.artObject}>
            <svg viewBox="0 0 240 220" focusable="false">
              <path d="M120 24 224 204H16Z" fill="currentColor" />
            </svg>
          </div>

          <div className={styles.artCaption}>
            <span>VERCEL / EVERYDAY OBJECTS</span>
            <span>DESIGNED TO SHIP ↗</span>
          </div>
        </div>
      </section>

      <section
        id="featured"
        className={styles.featured}
        aria-labelledby="featured-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>The essentials</p>
            <h2 id="featured-title">Featured products</h2>
          </div>

          <Link href="/search" className={styles.textLink}>
            View all products <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <FeaturedProducts />
      </section>
    </main>
  );
}