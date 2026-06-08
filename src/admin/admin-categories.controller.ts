import { Body, BadRequestException, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CategoriesService } from '../categories/categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../categories/dto/category.dto';
import { UploadsService } from '../uploads/uploads.service';

@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly uploads: UploadsService,
  ) {}

  @Get()
  list() {
    return this.categoriesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Thiếu field file');
    }
    const { url } = await this.uploads.upload(file, 'categories');
    return this.categoriesService.update(id, { image: url });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
