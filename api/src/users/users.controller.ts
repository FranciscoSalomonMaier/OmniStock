import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { compare, hash } from 'bcrypt';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() profile(@CurrentUser() user: User) {
    return this.users.toProfile(user);
  }
  @Patch() async update(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.toProfile(await this.users.updateName(user.id, dto.name));
  }
  @Patch('password') @HttpCode(HttpStatus.OK) async password(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const current = await this.users.findByEmailWithSecrets(user.email);
    if (!current || !(await compare(dto.currentPassword, current.passwordHash)))
      throw new UnauthorizedException('Senha atual incorreta');
    if (await compare(dto.newPassword, current.passwordHash))
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    await this.users.changePassword(user.id, await hash(dto.newPassword, 12));
    response.clearCookie('omnistock_refresh_token', { path: '/api/auth' });
    return { message: 'Senha alterada com sucesso. Entre novamente.' };
  }
}
