import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import type { ProductListQuery } from './product-list.query';
import {
  activeSaleMongoFilter,
  isSaleScheduleActive,
  resolveProductPricing,
} from './sale-pricing';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  private parseSaleDates(dto: {
    saleStartsAt?: string | null;
    saleEndsAt?: string | null;
  }) {
    const patch: Record<string, Date | null> = {};
    if (dto.saleStartsAt !== undefined) {
      patch.saleStartsAt = dto.saleStartsAt ? new Date(dto.saleStartsAt) : null;
    }
    if (dto.saleEndsAt !== undefined) {
      patch.saleEndsAt = dto.saleEndsAt ? new Date(dto.saleEndsAt) : null;
    }
    return patch;
  }

  private toDto(doc: ProductDocument | Product) {
    const pricing = resolveProductPricing(doc);
    return {
      id: doc.productId,
      slug: doc.slug,
      sku: doc.sku,
      title: doc.title,
      categorySlug: doc.categorySlug,
      collection: doc.collection,
      price: pricing.price,
      originalPrice: pricing.originalPrice,
      rating: doc.rating,
      reviews: doc.reviews,
      sold: doc.sold,
      image: doc.image,
      images: doc.images,
      colors: doc.colors,
      sizes: doc.sizes,
      description: doc.description,
      material: doc.material,
      origin: doc.origin,
      lining: doc.lining,
      fit: doc.fit,
      modelHeight: doc.modelHeight,
      inStock: doc.inStock,
      isSale: pricing.isSale,
      saleStartsAt: pricing.saleStartsAt,
      saleEndsAt: pricing.saleEndsAt,
      isNew: doc.isNew,
    };
  }

  private buildListFilter(query?: ProductListQuery): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (query?.category) filter.categorySlug = query.category;
    if (query?.isNew === true) filter.isNew = true;
    if (query?.isSale === true) {
      Object.assign(filter, activeSaleMongoFilter());
    }
    if (query?.inStock === true) filter.inStock = true;
    if (query?.search) {
      const q = query.search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { collection: { $regex: q, $options: 'i' } },
      ];
    }
    if (query?.minPrice != null || query?.maxPrice != null) {
      const price: Record<string, number> = {};
      if (query.minPrice != null) price.$gte = query.minPrice;
      if (query.maxPrice != null) price.$lte = query.maxPrice;
      filter.price = price;
    }
    if (query?.colors?.length) {
      filter['colors.name'] = { $in: query.colors };
    }
    if (query?.sizes?.length) {
      filter.sizes = {
        $elemMatch: {
          size: { $in: query.sizes },
          available: { $ne: false },
        },
      };
    }
    return filter;
  }

  private listSort(query?: ProductListQuery): Record<string, SortOrder> {
    switch (query?.sort) {
      case 'newest':
        return { isNew: -1, createdAt: -1 };
      case 'price-asc':
        return { price: 1 };
      case 'price-desc':
        return { price: -1 };
      case 'rating':
        return { rating: -1, reviews: -1 };
      case 'popular':
        return { sold: -1 };
      case 'featured':
      default:
        return { sold: -1, rating: -1, createdAt: -1 };
    }
  }

  async findAll(query?: ProductListQuery) {
    const filter = this.buildListFilter(query);
    const docs = await this.productModel.find(filter).sort(this.listSort(query)).lean();
    return docs.map((d) => this.toDto(d as ProductDocument));
  }

  async getFlashSaleMeta() {
    const now = new Date();
    const docs = await this.productModel
      .find({
        ...activeSaleMongoFilter(now),
        originalPrice: { $exists: true, $gt: 0 },
      })
      .select('saleEndsAt saleStartsAt price originalPrice isSale')
      .lean();

    const active = docs.filter((d) => isSaleScheduleActive(d as Product, now));
    const endTimes = active
      .map((d) => (d.saleEndsAt ? new Date(d.saleEndsAt).getTime() : null))
      .filter((t): t is number => t != null && t > now.getTime());

    return {
      active: active.length > 0,
      endsAt: endTimes.length > 0 ? new Date(Math.min(...endTimes)).toISOString() : null,
      productCount: active.length,
    };
  }

  async getFacets(categorySlug: string) {
    const docs = await this.productModel
      .find({ categorySlug })
      .select('price colors sizes inStock isSale isNew originalPrice saleStartsAt saleEndsAt')
      .lean();

    const colorMap = new Map<string, string>();
    const sizeSet = new Set<string>();
    let priceMin = Infinity;
    let priceMax = 0;
    let saleCount = 0;
    let newCount = 0;
    let inStockCount = 0;

    for (const doc of docs) {
      const pricing = resolveProductPricing(doc as Product);
      if (pricing.price < priceMin) priceMin = pricing.price;
      if (pricing.price > priceMax) priceMax = pricing.price;
      if (pricing.isSale) saleCount += 1;
      if (doc.isNew) newCount += 1;
      if (doc.inStock !== false) inStockCount += 1;
      for (const c of doc.colors ?? []) {
        if (c?.name && c?.code) colorMap.set(c.name, c.code);
      }
      for (const s of doc.sizes ?? []) {
        if (s?.size && s.available !== false) sizeSet.add(s.size);
      }
    }

    return {
      category: categorySlug,
      total: docs.length,
      priceMin: docs.length ? priceMin : 0,
      priceMax: docs.length ? priceMax : 0,
      colors: Array.from(colorMap.entries()).map(([name, code]) => ({ name, code })),
      sizes: Array.from(sizeSet).sort((a, b) => {
        const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size'];
        return order.indexOf(a) - order.indexOf(b);
      }),
      saleCount,
      newCount,
      inStockCount,
    };
  }

  async findBySlug(slug: string) {
    const doc = await this.productModel.findOne({ slug }).lean();
    if (!doc) throw new NotFoundException(`Product ${slug} not found`);
    return this.toDto(doc as ProductDocument);
  }

  async findByProductId(id: string) {
    const doc = await this.productModel.findOne({ productId: id }).lean();
    if (!doc) throw new NotFoundException(`Product ${id} not found`);
    return this.toDto(doc as ProductDocument);
  }

  /** Giá trị lưu DB — dùng cho CMS chỉnh sửa (không resolve sale theo thời gian) */
  private toStoredDto(doc: ProductDocument | Product) {
    return {
      id: doc.productId,
      slug: doc.slug,
      sku: doc.sku,
      title: doc.title,
      categorySlug: doc.categorySlug,
      collection: doc.collection,
      price: doc.price,
      originalPrice: doc.originalPrice,
      rating: doc.rating,
      reviews: doc.reviews,
      sold: doc.sold,
      image: doc.image,
      images: doc.images,
      colors: doc.colors,
      sizes: doc.sizes,
      description: doc.description,
      material: doc.material,
      origin: doc.origin,
      lining: doc.lining,
      fit: doc.fit,
      modelHeight: doc.modelHeight,
      inStock: doc.inStock,
      isSale: doc.isSale,
      saleStartsAt: doc.saleStartsAt ? new Date(doc.saleStartsAt).toISOString() : undefined,
      saleEndsAt: doc.saleEndsAt ? new Date(doc.saleEndsAt).toISOString() : undefined,
      isNew: doc.isNew,
    };
  }

  async findByProductIdStored(id: string) {
    const doc = await this.productModel.findOne({ productId: id }).lean();
    if (!doc) throw new NotFoundException(`Product ${id} not found`);
    return this.toStoredDto(doc as ProductDocument);
  }

  async count() {
    return this.productModel.countDocuments();
  }

  async create(dto: CreateProductDto) {
    const exists = await this.productModel.findOne({
      $or: [{ productId: dto.productId }, { slug: dto.slug }],
    });
    if (exists) {
      throw new ConflictException('productId hoặc slug đã tồn tại');
    }
    const saleDates = this.parseSaleDates(dto);
    const doc = await this.productModel.create({
      productId: dto.productId,
      slug: dto.slug,
      sku: dto.sku,
      title: dto.title,
      categorySlug: dto.categorySlug,
      collection: dto.collection,
      price: dto.price,
      originalPrice: dto.originalPrice,
      rating: dto.rating ?? 0,
      reviews: dto.reviews ?? 0,
      sold: dto.sold ?? 0,
      image: dto.image,
      images: dto.images ?? [],
      colors: dto.colors ?? [],
      sizes: dto.sizes ?? [],
      description: dto.description,
      material: dto.material,
      origin: dto.origin,
      lining: dto.lining,
      fit: dto.fit,
      modelHeight: dto.modelHeight,
      inStock: dto.inStock ?? true,
      isSale: dto.isSale ?? false,
      isNew: dto.isNew ?? false,
      saleStartsAt: saleDates.saleStartsAt ?? null,
      saleEndsAt: saleDates.saleEndsAt ?? null,
    });
    return this.toDto(doc);
  }

  async update(productId: string, dto: UpdateProductDto) {
    const patch: Record<string, unknown> = { ...dto };
    delete patch.saleStartsAt;
    delete patch.saleEndsAt;
    Object.assign(patch, this.parseSaleDates(dto));

    const doc = await this.productModel
      .findOneAndUpdate({ productId }, { $set: patch }, { new: true })
      .lean();
    if (!doc) throw new NotFoundException(`Product ${productId} not found`);
    return this.toDto(doc as ProductDocument);
  }

  async remove(productId: string) {
    const result = await this.productModel.deleteOne({ productId });
    if (!result.deletedCount) throw new NotFoundException(`Product ${productId} not found`);
    return { ok: true, productId };
  }

  async upsertMany(items: Record<string, unknown>[]) {
    const ops = items.map((item) => ({
      updateOne: {
        filter: { productId: item.productId },
        update: { $set: item },
        upsert: true,
      },
    }));
    if (ops.length === 0) return { upserted: 0 };
    const result = await this.productModel.bulkWrite(
      ops as Parameters<typeof this.productModel.bulkWrite>[0],
    );
    return {
      upserted: result.upsertedCount + result.modifiedCount,
    };
  }
}
