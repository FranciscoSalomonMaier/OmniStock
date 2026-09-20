import { NotFoundException } from '@nestjs/common';
import { InventoryOutboxEvent } from '../../inventory/entities/inventory-outbox-event.entity';
import { MarketplaceStockSyncService } from './marketplace-stock-sync.service';

describe('MarketplaceStockSyncService', () => {
  function setup(
    product: unknown = { id: 'product-1' },
    balance: unknown = {
      currentQuantity: '35.000',
      reservedQuantity: '1.000',
      version: 7,
    },
  ) {
    const saved: unknown[] = [];
    const manager = {
      findOneBy: jest.fn().mockResolvedValue(product),
      getRepository: jest.fn(() => ({
        createQueryBuilder: () => ({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(balance),
        }),
      })),
      create: jest.fn(
        (_entity: unknown, value: Record<string, unknown>) => value,
      ),
      save: jest.fn((_entity: unknown, value: Record<string, unknown>) => {
        const result = { id: 'event-1', ...value };
        saved.push(result);
        return Promise.resolve(result);
      }),
    };
    const service = new MarketplaceStockSyncService(
      {
        transaction: jest.fn(
          (fn: (value: typeof manager) => Promise<unknown>) => fn(manager),
        ),
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, saved };
  }
  it('records the current available quantity and inventory version in the outbox', async () => {
    const { service, saved } = setup();
    await expect(
      service.requestProduct('company-1', 'product-1', 'user-1'),
    ).resolves.toEqual({ eventId: 'event-1', status: 'PENDING' });
    const event = saved[0] as InventoryOutboxEvent;
    expect(event.payload).toMatchObject({
      companyId: 'company-1',
      productId: 'product-1',
      currentAvailable: 34,
      inventoryVersion: 7,
      source: 'MANUAL',
    });
  });
  it('does not accept a product outside the active company', async () => {
    const { service } = setup(null);
    await expect(
      service.requestProduct('company-2', 'product-1', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('does not enqueue a fabricated quantity supplied by a caller', async () => {
    const { service, saved } = setup(
      { id: 'product-1' },
      { currentQuantity: '8.000', reservedQuantity: '3.000', version: 9 },
    );
    await service.requestProduct('company-1', 'product-1', 'user-1');
    expect((saved[0] as InventoryOutboxEvent).payload.currentAvailable).toBe(5);
  });
});
