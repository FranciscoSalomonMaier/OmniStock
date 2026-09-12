import { BadRequestException } from '@nestjs/common';
import { MercadoLivreWebhookService } from './mercado-livre-webhook.service';

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */

describe('MercadoLivreWebhookService', () => {
  const connection = { id: 'account-1', companyId: 'company-1' };
  let stored: Record<string, unknown>[];
  let events: Record<string, jest.Mock>;
  let queue: { enqueueOrder: jest.Mock };
  let service: MercadoLivreWebhookService;

  beforeEach(() => {
    stored = [];
    events = {
      findOne: jest.fn().mockResolvedValue(null),
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 'event-1', ...value })),
      save: jest.fn(async (value) => {
        stored.push({ ...value });
        return value;
      }),
    };
    const query = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(connection),
    };
    queue = {
      enqueueOrder: jest
        .fn()
        .mockResolvedValue({ jobId: 'job-1', correlationId: 'correlation-1' }),
    };
    service = new MercadoLivreWebhookService(
      events as never,
      { createQueryBuilder: jest.fn(() => query) } as never,
      queue as never,
      { getOrThrow: jest.fn(() => '123') } as never,
    );
  });

  const notification = {
    _id: 'external-event-1',
    resource: '/orders/456',
    topic: 'orders_v2',
    user_id: 789,
    application_id: 123,
    attempts: 1,
    sent: '2026-09-05T12:00:00Z',
  };

  it('stores and enqueues a valid notification without importing inline', async () => {
    await expect(service.receive(notification)).resolves.toMatchObject({
      received: true,
      eventId: 'event-1',
      jobId: 'job-1',
    });
    expect(queue.enqueueOrder).toHaveBeenCalledWith(
      'company-1',
      'account-1',
      '456',
      'WEBHOOK',
      { webhookEventId: 'event-1' },
    );
    expect(stored[0]).not.toHaveProperty('accessToken');
  });

  it('rejects a notification for another application', async () => {
    await expect(
      service.receive({ ...notification, application_id: 999 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queue.enqueueOrder).not.toHaveBeenCalled();
  });

  it('does not enqueue an event already queued', async () => {
    events.findOne.mockResolvedValue({ id: 'existing', status: 'QUEUED' });
    await expect(service.receive(notification)).resolves.toEqual({
      received: true,
      duplicate: true,
      eventId: 'existing',
    });
    expect(queue.enqueueOrder).not.toHaveBeenCalled();
  });

  it('ignores topics that are not order notifications', async () => {
    await expect(
      service.receive({ ...notification, topic: 'items' }),
    ).resolves.toEqual({ received: true, ignored: true });
    expect(queue.enqueueOrder).not.toHaveBeenCalled();
  });
});
