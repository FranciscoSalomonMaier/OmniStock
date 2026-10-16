/* eslint-disable @typescript-eslint/unbound-method -- Reflector receives method metadata; handlers are never invoked unbound */
import { Reflector } from '@nestjs/core';
import { CompanyRolesGuard } from '../../companies/guards/company-roles.guard';
import { MarketplaceWebhookAdminController } from './marketplace-webhook-admin.controller';
import { CompanyRole } from '../../common/enums/company-role.enum';
describe('Webhook admin permissions', () => {
  const guard = new CompanyRolesGuard(new Reflector());
  it.each(['retry', 'ignore'] as const)('denies VIEWER on %s', (action) => {
    const context = {
      getHandler: () => MarketplaceWebhookAdminController.prototype[action],
      getClass: () => MarketplaceWebhookAdminController,
      switchToHttp: () => ({
        getRequest: () => ({ membership: { role: CompanyRole.VIEWER } }),
      }),
    };
    expect(() => guard.canActivate(context as never)).toThrow(
      'Você não possui permissão',
    );
  });
  it.each(['retry', 'ignore'] as const)('permits SUPPORT on %s', (action) => {
    const context = {
      getHandler: () => MarketplaceWebhookAdminController.prototype[action],
      getClass: () => MarketplaceWebhookAdminController,
      switchToHttp: () => ({
        getRequest: () => ({ membership: { role: CompanyRole.SUPPORT } }),
      }),
    };
    expect(guard.canActivate(context as never)).toBe(true);
  });
});
