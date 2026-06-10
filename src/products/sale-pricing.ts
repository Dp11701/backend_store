export interface ProductSaleFields {
  isSale: boolean;
  price: number;
  originalPrice?: number;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
}

export interface ResolvedProductPricing {
  price: number;
  originalPrice?: number;
  isSale: boolean;
  saleStartsAt?: string;
  saleEndsAt?: string;
}

export function isSaleScheduleActive(doc: ProductSaleFields, now = new Date()): boolean {
  if (!doc.isSale) return false;
  const startMs = doc.saleStartsAt ? new Date(doc.saleStartsAt).getTime() : null;
  const endMs = doc.saleEndsAt ? new Date(doc.saleEndsAt).getTime() : null;
  if (startMs == null && endMs == null) return true;
  const t = now.getTime();
  if (startMs != null && t < startMs) return false;
  if (endMs != null && t >= endMs) return false;
  return true;
}

export function resolveProductPricing(
  doc: ProductSaleFields,
  now = new Date(),
): ResolvedProductPricing {
  const saleStartsAt = doc.saleStartsAt
    ? new Date(doc.saleStartsAt).toISOString()
    : undefined;
  const saleEndsAt = doc.saleEndsAt ? new Date(doc.saleEndsAt).toISOString() : undefined;
  const active = isSaleScheduleActive(doc, now);

  if (active && doc.originalPrice != null && doc.originalPrice > doc.price) {
    return {
      price: doc.price,
      originalPrice: doc.originalPrice,
      isSale: true,
      saleStartsAt,
      saleEndsAt,
    };
  }

  const listPrice = doc.originalPrice ?? doc.price;
  return {
    price: listPrice,
    originalPrice: undefined,
    isSale: false,
    saleStartsAt,
    saleEndsAt,
  };
}

/** Mongo filter: sản phẩm đang trong khung giờ sale */
export function activeSaleMongoFilter(now = new Date()) {
  return {
    isSale: true,
    $and: [
      {
        $or: [
          { saleStartsAt: { $exists: false } },
          { saleStartsAt: null },
          { saleStartsAt: { $lte: now } },
        ],
      },
      {
        $or: [
          { saleEndsAt: { $exists: false } },
          { saleEndsAt: null },
          { saleEndsAt: { $gt: now } },
        ],
      },
    ],
  };
}
