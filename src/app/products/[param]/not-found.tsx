import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main id="main-content" tabIndex={-1}>
      <h1>Product not found</h1>
      <p>This product does not exist or is no longer available.</p>
      <Link href="/">Return to the collection</Link>
    </main>
  );
}