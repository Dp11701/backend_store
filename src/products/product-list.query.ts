export type ProductSort =
  | 'featured'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'rating'
  | 'popular';

export interface ProductListQuery {
  category?: string;
  search?: string;
  isNew?: boolean;
  isSale?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  sort?: ProductSort;
}

export function parseProductListQuery(raw: Record<string, string | undefined>): ProductListQuery {
  const num = (v?: string) => {
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const colors = raw.colors
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const sizes = raw.sizes
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const sort = raw.sort as ProductSort | undefined;
  const allowed: ProductSort[] = [
    'featured',
    'newest',
    'price-asc',
    'price-desc',
    'rating',
    'popular',
  ];

  return {
    category: raw.category?.trim() || undefined,
    search: raw.search?.trim() || undefined,
    isNew: raw.isNew === 'true' ? true : undefined,
    isSale: raw.isSale === 'true' ? true : undefined,
    inStock: raw.inStock === 'true' ? true : undefined,
    minPrice: num(raw.minPrice),
    maxPrice: num(raw.maxPrice),
    colors: colors?.length ? colors : undefined,
    sizes: sizes?.length ? sizes : undefined,
    sort: sort && allowed.includes(sort) ? sort : undefined,
  };
}
