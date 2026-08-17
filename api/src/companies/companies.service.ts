import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CompanyRole } from '../common/enums/company-role.enum';
import { UsersService } from '../users/users.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { AddMemberDto, UpdateMemberDto } from './dto/member.dto';
import { CompanyMember } from './entities/company-member.entity';
import { Company } from './entities/company.entity';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(CompanyMember)
    private readonly members: Repository<CompanyMember>,
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
  ) {}
  async create(dto: CreateCompanyDto, userId: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const company = await manager.save(
          Company,
          manager.create(Company, {
            ...dto,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
          }),
        );
        const membership = await manager.save(
          CompanyMember,
          manager.create(CompanyMember, {
            companyId: company.id,
            userId,
            role: CompanyRole.ADMIN,
          }),
        );
        this.logger.log({
          event: 'company.created',
          companyId: company.id,
          actorUserId: userId,
        });
        return { company, membership };
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === '23505'
      )
        throw new ConflictException('CNPJ já cadastrado');
      throw error;
    }
  }
  async list(userId: string) {
    return this.members
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.company', 'company')
      .where(
        'membership.userId = :userId AND membership.isActive = true AND company.isActive = true',
        { userId },
      )
      .getMany();
  }
  activeMembership(companyId: string, userId: string) {
    return this.members
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.company', 'company')
      .where(
        'membership.companyId = :companyId AND membership.userId = :userId AND membership.isActive = true AND company.isActive = true',
        { companyId, userId },
      )
      .getOne();
  }
  async get(companyId: string) {
    const company = await this.companies.findOneBy({
      id: companyId,
      isActive: true,
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }
  async update(companyId: string, dto: UpdateCompanyDto, actorId: string) {
    const company = await this.get(companyId);
    Object.assign(company, dto);
    const saved = await this.companies.save(company);
    this.logger.log({
      event: 'company.updated',
      companyId,
      actorUserId: actorId,
    });
    return saved;
  }
  async deactivate(companyId: string, actorId: string) {
    await this.companies.update({ id: companyId }, { isActive: false });
    this.logger.log({
      event: 'company.deactivated',
      companyId,
      actorUserId: actorId,
    });
  }
  listMembers(companyId: string) {
    return this.members
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.user', 'user')
      .where('membership.companyId = :companyId', { companyId })
      .select([
        'membership.id',
        'membership.userId',
        'membership.role',
        'membership.isActive',
        'membership.joinedAt',
        'user.id',
        'user.name',
        'user.email',
      ])
      .getMany();
  }
  async addMember(companyId: string, dto: AddMemberDto, actor: CompanyMember) {
    if (actor.role === CompanyRole.MANAGER && dto.role === CompanyRole.ADMIN)
      throw new ForbiddenException('Gestor não pode atribuir Administrador');
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    try {
      const member = await this.members.save(
        this.members.create({ companyId, userId: user.id, role: dto.role }),
      );
      this.logger.log({
        event: 'member.added',
        companyId,
        memberId: member.id,
        actorUserId: actor.userId,
      });
      return member;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === '23505'
      )
        throw new ConflictException('Usuário já associado à empresa');
      throw error;
    }
  }
  async updateMember(
    companyId: string,
    memberId: string,
    dto: UpdateMemberDto,
    actor: CompanyMember,
  ) {
    const target = await this.members.findOneBy({ id: memberId, companyId });
    if (!target) throw new NotFoundException('Membro não encontrado');
    if (
      actor.role === CompanyRole.MANAGER &&
      (target.role === CompanyRole.ADMIN || dto.role === CompanyRole.ADMIN)
    )
      throw new ForbiddenException('Gestor não pode alterar Administrador');
    if (
      actor.id === target.id &&
      dto.role &&
      this.rank(dto.role) > this.rank(actor.role)
    )
      throw new ForbiddenException(
        'Não é permitido elevar a própria permissão',
      );
    if (
      target.role === CompanyRole.ADMIN &&
      ((dto.role && dto.role !== CompanyRole.ADMIN) ||
        dto.isActive === false) &&
      (await this.activeAdminCount(companyId)) <= 1
    )
      throw new ConflictException(
        'A empresa deve manter ao menos um Administrador ativo',
      );
    Object.assign(target, dto);
    const saved = await this.members.save(target);
    this.logger.log({
      event: 'member.updated',
      companyId,
      memberId,
      actorUserId: actor.userId,
    });
    return saved;
  }
  async deactivateMember(
    companyId: string,
    memberId: string,
    actor: CompanyMember,
  ) {
    return this.updateMember(companyId, memberId, { isActive: false }, actor);
  }
  private activeAdminCount(companyId: string) {
    return this.members.countBy({
      companyId,
      role: CompanyRole.ADMIN,
      isActive: true,
    });
  }
  private rank(role: CompanyRole) {
    return [
      CompanyRole.VIEWER,
      CompanyRole.SUPPORT,
      CompanyRole.BILLING,
      CompanyRole.STOCKIST,
      CompanyRole.MANAGER,
      CompanyRole.ADMIN,
    ].indexOf(role);
  }
}
