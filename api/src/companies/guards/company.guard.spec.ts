import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { CompaniesService } from '../companies.service';
import { CompanyRole } from '../../common/enums/company-role.enum';
import { CompanyGuard } from './company.guard';
import { CompanyRolesGuard } from './company-roles.guard';
import { Reflector } from '@nestjs/core';

describe('Company authorization', () => {
  const companyId = 'f43bcae2-d08c-4e79-b88e-8713926619f6';
  const service = { activeMembership: jest.fn() };
  const context = (header?: string, param = companyId) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-company-id': header },
          params: { companyId: param },
          user: { id: 'user-1' },
        }),
      }),
    }) as unknown as ExecutionContext;
  beforeEach(() => jest.clearAllMocks());
  it('exige X-Company-Id', async () =>
    expect(
      new CompanyGuard(service as unknown as CompaniesService).canActivate(
        context(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException));
  it('rejeita UUID inválido', async () =>
    expect(
      new CompanyGuard(service as unknown as CompaniesService).canActivate(
        context('invalid'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException));
  it('impede UUID da URL diferente do contexto', async () =>
    expect(
      new CompanyGuard(service as unknown as CompaniesService).canActivate(
        context(companyId, 'ff1d51b3-8db4-4f2d-9041-c112ddbc4ce4'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException));
  it('impede acesso de não membro', async () => {
    service.activeMembership.mockResolvedValue(null);
    await expect(
      new CompanyGuard(service as unknown as CompaniesService).canActivate(
        context(companyId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('aceita somente associação ativa validada', async () => {
    service.activeMembership.mockResolvedValue({ id: 'member' });
    await expect(
      new CompanyGuard(service as unknown as CompaniesService).canActivate(
        context(companyId),
      ),
    ).resolves.toBe(true);
  });
  it('VIEWER não passa em operação de escrita', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => [
        CompanyRole.ADMIN,
        CompanyRole.MANAGER,
      ]),
    } as unknown as Reflector;
    const request = { membership: { role: CompanyRole.VIEWER } };
    const ctx = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    expect(() => new CompanyRolesGuard(reflector).canActivate(ctx)).toThrow(
      ForbiddenException,
    );
  });
});
