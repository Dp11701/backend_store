import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import type { ProductListQuery } from './product-list.query';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>
  ) {}

  private toDto(doc: ProductDocument | (Product & { productId: string })) {
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
      isNew: doc.isNew,
    };
  }

  private buildListFilter(query?: ProductListQuery): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (query?.category) filter.categorySlug = query.category;
    if (query?.isNew === true) filter.isNew = true;
    if (query?.isSale === true) filter.isSale = true;
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

  async getFacets(categorySlug: string) {
    const docs = await this.productModel
      .find({ categorySlug })
      .select('price colors sizes inStock isSale isNew')
      .lean();

    const colorMap = new Map<string, string>();
    const sizeSet = new Set<string>();
    let priceMin = Infinity;
    let priceMax = 0;

    for (const doc of docs) {
      if (doc.price < priceMin) priceMin = doc.price;
      if (doc.price > priceMax) priceMax = doc.price;
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
      saleCount: docs.filter((d) => d.isSale).length,
      newCount: docs.filter((d) => d.isNew).length,
      inStockCount: docs.filter((d) => d.inStock !== false).length,
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
    const doc = await this.productModel.create({
      ...dto,
      images: dto.images ?? [],
      colors: dto.colors ?? [],
      sizes: dto.sizes ?? [],
      rating: dto.rating ?? 0,
      reviews: dto.reviews ?? 0,
      sold: dto.sold ?? 0,
      inStock: dto.inStock ?? true,
      isSale: dto.isSale ?? false,
      isNew: dto.isNew ?? false,
    });
    return this.toDto(doc);
  }

  async update(productId: string, dto: UpdateProductDto) {
    const doc = await this.productModel
      .findOneAndUpdate({ productId }, { $set: dto }, { new: true })
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
      ops as Parameters<typeof this.productModel.bulkWrite>[0]
    );
    return {
      upserted: result.upsertedCount + result.modifiedCount,
    };
  }
}
