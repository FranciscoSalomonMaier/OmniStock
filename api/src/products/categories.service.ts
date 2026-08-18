import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { ProductCategory } from './entities/product-category.entity';
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly repo: Repository<ProductCategory>,
  ) {}
  private normalized(name: string) {
    return name.trim().toLocaleLowerCase('pt-BR');
  }
  async create(companyId: string, dto: CreateCategoryDto) {
    try {
      return await this.repo.save(
        this.repo.create({
          companyId,
          name: dto.name.trim(),
          normalizedName: this.normalized(dto.name),
          description: dto.description?.trim() || null,
        }),
      );
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === '23505'
      )
        throw new ConflictException(
          'Já existe uma categoria com este nome nesta empresa.',
        );
      throw error;
    }
  }
  list(companyId: string) {
    return this.repo.find({ where: { companyId }, order: { name: 'ASC' } });
  }
  async get(companyId: string, id: string) {
    const category = await this.repo.findOneBy({ id, companyId });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }
  async update(companyId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.get(companyId, id);
    if (dto.name) {
      category.name = dto.name.trim();
      category.normalizedName = this.normalized(dto.name);
    }
    if (dto.description !== undefined)
      category.description = dto.description?.trim() || null;
    try {
      return await this.repo.save(category);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === '23505'
      )
        throw new ConflictException(
          'Já existe uma categoria com este nome nesta empresa.',
        );
      throw error;
    }
  }
  async deactivate(companyId: string, id: string) {
    const category = await this.get(companyId, id);
    category.isActive = false;
    return this.repo.save(category);
  }
}
