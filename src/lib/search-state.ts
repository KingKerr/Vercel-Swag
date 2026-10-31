export type SearchParams = Record<
  string,
  string | string[] | undefined
>;

type Category = {
  slug: string;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function getSearchState(
  params: SearchParams,
  categories: Category[],
) {
  const query = first(params.q).trim();
  const requestedCategory = first(params.category).trim();

  const validCategory =
    requestedCategory === "" ||
    categories.some(
      (category) => category.slug === requestedCategory,
    );

  return {
    query,
    category: validCategory ? requestedCategory : "",
    validationMessage:
      query.length > 120
        ? "Please keep your search to 120 characters or fewer."
        : !validCategory
          ? "That category is not available. Choose another category."
          : null,
  };
}