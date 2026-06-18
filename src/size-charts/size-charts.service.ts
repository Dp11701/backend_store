import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SizeChart, SizeChartDocument } from './schemas/size-chart.schema';
import { CreateSizeChartDto, UpdateSizeChartDto } from './dto/size-chart.dto';

@Injectable()
export class SizeChartsService {
  constructor(
    @InjectModel(SizeChart.name)
    private readonly sizeChartModel: Model<SizeChartDocument>,
  ) {}

  private toDto(doc: SizeChartDocument | SizeChart) {
    return {
      id: doc.sizeChartId,
      slug: doc.slug,
      name: doc.name,
      categorySlug: doc.categorySlug,
      description: doc.description ?? '',
      rows: (doc.rows ?? []).map((r) => ({
        size: r.size,
        bust: r.bust,
        waist: r.waist,
        hip: r.hip,
        heightMin: r.heightMin,
        heightMax: r.heightMax,
      })),
      isDefault: doc.isDefault ?? false,
    };
  }

  async findAll() {
    const docs = await this.sizeChartModel.find().sort({ name: 1 }).lean();
    return docs.map((d) => this.toDto(d as SizeChartDocument));
  }

  async findById(sizeChartId: string) {
    const doc = await this.sizeChartModel.findOne({ sizeChartId }).lean();
    if (!doc) throw new NotFoundException(`Size chart ${sizeChartId} not found`);
    return this.toDto(doc as SizeChartDocument);
  }

  async findBySlug(slug: string) {
    const doc = await this.sizeChartModel.findOne({ slug }).lean();
    if (!doc) throw new NotFoundException(`Size chart ${slug} not found`);
    return this.toDto(doc as SizeChartDocument);
  }

  async findDefault() {
    const doc = await this.sizeChartModel.findOne({ isDefault: true }).lean();
    if (!doc) {
      const first = await this.sizeChartModel.findOne().sort({ createdAt: 1 }).lean();
      if (!first) throw new NotFoundException('No size charts configured');
      return this.toDto(first as SizeChartDocument);
    }
    return this.toDto(doc as SizeChartDocument);
  }

  /** Chart gắn sản phẩm → category → default */
  async resolveForProduct(sizeChartId?: string | null, categorySlug?: string | null) {
    if (sizeChartId) {
      try {
        return await this.findById(sizeChartId);
      } catch {
        /* fallback below */
      }
    }
    if (categorySlug) {
      const byCategory = await this.sizeChartModel
        .findOne({ categorySlug })
        .lean();
      if (byCategory) return this.toDto(byCategory as SizeChartDocument);
    }
    return this.findDefault();
  }

  async create(dto: CreateSizeChartDto) {
    const exists = await this.sizeChartModel.findOne({
      $or: [{ sizeChartId: dto.sizeChartId }, { slug: dto.slug }],
    });
    if (exists) throw new ConflictException('sizeChartId hoặc slug đã tồn tại');

    if (dto.isDefault) {
      await this.sizeChartModel.updateMany({}, { $set: { isDefault: false } });
    }

    const doc = await this.sizeChartModel.create({
      ...dto,
      description: dto.description ?? '',
      isDefault: dto.isDefault ?? false,
    });
    return this.toDto(doc);
  }

  async update(sizeChartId: string, dto: UpdateSizeChartDto) {
    if (dto.isDefault) {
      await this.sizeChartModel.updateMany(
        { sizeChartId: { $ne: sizeChartId } },
        { $set: { isDefault: false } },
      );
    }

    const doc = await this.sizeChartModel
      .findOneAndUpdate({ sizeChartId }, { $set: dto }, { new: true })
      .lean();
    if (!doc) throw new NotFoundException(`Size chart ${sizeChartId} not found`);
    return this.toDto(doc as SizeChartDocument);
  }

  async remove(sizeChartId: string) {
    const result = await this.sizeChartModel.deleteOne({ sizeChartId });
    if (!result.deletedCount) {
      throw new NotFoundException(`Size chart ${sizeChartId} not found`);
    }
    return { ok: true, sizeChartId };
  }

  async upsertMany(items: Record<string, unknown>[]) {
    const ops = items.map((item) => ({
      updateOne: {
        filter: { sizeChartId: item.sizeChartId },
        update: { $set: item },
        upsert: true,
      },
    }));
    if (ops.length === 0) return { upserted: 0 };
    const result = await this.sizeChartModel.bulkWrite(
      ops as Parameters<typeof this.sizeChartModel.bulkWrite>[0],
    );
    return { upserted: result.upsertedCount + result.modifiedCount };
  }
}
