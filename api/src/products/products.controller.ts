import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyRole } from '../common/enums/company-role.enum';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CurrentMembership } from '../companies/decorators/current-membership.decorator';
import { CompanyMember } from '../companies/entities/company-member.entity';
import { CompanyGuard } from '../companies/guards/company.guard';
import { CompanyRolesGuard } from '../companies/guards/company-roles.guard';
import { User } from '../users/entities/user.entity';
import { ReorderImagesDto } from './dto/image.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import {
  ChangeProductStatusDto,
  CreateProductDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';
@ApiTags('Products')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Company-Id', required: true })
@UseGuards(JwtAuthGuard, CompanyGuard, CompanyRolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}
  @Post()
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  create(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Body() dto: CreateProductDto,
  ) {
    return this.service.create(m.companyId, u.id, dto);
  }
  @Get() list(
    @CurrentMembership() m: CompanyMember,
    @Query() q: ListProductsQueryDto,
  ) {
    return this.service.list(m.companyId, m.role, q);
  }
  @Get(':id') get(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
  ) {
    return this.service.get(m.companyId, id, m.role);
  }
  @Patch(':id')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  update(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(m.companyId, id, u.id, dto);
  }
  @Patch(':id/status')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER)
  status(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Body() dto: ChangeProductStatusDto,
  ) {
    return this.service.status(m.companyId, id, u.id, dto.status);
  }
  @Post(':id/images')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  upload(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatório');
    return this.service.addImage(m.companyId, id, u.id, file);
  }
  @Get(':id/images') images(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
  ) {
    return this.service.listImages(m.companyId, id);
  }
  @Get(':id/images/:imageId/file') async file(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    const file = await this.service.imageFile(m.companyId, id, imageId);
    return new StreamableFile(file.buffer, { type: file.mimeType });
  }
  @Patch(':id/images/:imageId/primary')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  primary(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.service.primary(m.companyId, id, imageId);
  }
  @Patch(':id/images/reorder')
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  reorder(
    @CurrentMembership() m: CompanyMember,
    @Param('id') id: string,
    @Body() dto: ReorderImagesDto,
  ) {
    return this.service.reorder(m.companyId, id, dto.imageIds);
  }
  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CompanyRoles(CompanyRole.ADMIN, CompanyRole.MANAGER, CompanyRole.STOCKIST)
  async remove(
    @CurrentMembership() m: CompanyMember,
    @CurrentUser() u: User,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    await this.service.removeImage(m.companyId, id, imageId, u.id);
  }
}
