import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>
  ) {}

  private toDto(doc: CategoryDocument) {
    return {
      id: doc.categoryId,
      slug: doc.slug,
      name: doc.name,
      description: doc.description,
      image: doc.image,
    };
  }

  async findAll() {
    const docs = await this.categoryModel.find().sort({ name: 1 }).lean();
    return docs.map((d) => this.toDto(d as CategoryDocument));
  }

  async findBySlug(slug: string) {
    const doc = await this.categoryModel.findOne({ slug }).lean();
    if (!doc) throw new NotFoundException(`Category ${slug} not found`);
    return this.toDto(doc as CategoryDocument);
  }

  async create(dto: CreateCategoryDto) {
    const exists = await this.categoryModel.findOne({
      $or: [{ categoryId: dto.categoryId }, { slug: dto.slug }],
    });
    if (exists) throw new ConflictException('categoryId hoặc slug đã tồn tại');
    const doc = await this.categoryModel.create(dto);
    return this.toDto(doc);
  }

  async update(categoryId: string, dto: UpdateCategoryDto) {
    const doc = await this.categoryModel
      .findOneAndUpdate({ categoryId }, { $set: dto }, { new: true })
      .lean();
    if (!doc) throw new NotFoundException(`Category ${categoryId} not found`);
    return this.toDto(doc as CategoryDocument);
  }

  async remove(categoryId: string) {
    const result = await this.categoryModel.deleteOne({ categoryId });
    if (!result.deletedCount) throw new NotFoundException(`Category ${categoryId} not found`);
    return { ok: true, categoryId };
  }

  async upsertMany(items: Record<string, unknown>[]) {
    const ops = items.map((item) => ({
      updateOne: {
        filter: { categoryId: item.categoryId },
        update: { $set: item },
        upsert: true,
      },
    }));
    if (ops.length === 0) return { upserted: 0 };
    const result = await this.categoryModel.bulkWrite(
      ops as Parameters<typeof this.categoryModel.bulkWrite>[0]
    );
    return { upserted: result.upsertedCount + result.modifiedCount };
  }
}
