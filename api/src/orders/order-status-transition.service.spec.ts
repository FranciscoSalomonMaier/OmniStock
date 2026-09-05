import { ConflictException } from '@nestjs/common';
import { OrderStatus } from './enums/order.enums';
import { OrderStatusTransitionService } from './order-status-transition.service';

describe('OrderStatusTransitionService', () => {
  const policy = new OrderStatusTransitionService();
  it('accepts a valid transition', () =>
    expect(() =>
      policy.assert(OrderStatus.NEW, OrderStatus.PAID),
    ).not.toThrow());
  it('rejects skipping workflow stages', () =>
    expect(() => policy.assert(OrderStatus.NEW, OrderStatus.DELIVERED)).toThrow(
      ConflictException,
    ));
  it('keeps final states final', () =>
    expect(policy.can(OrderStatus.CANCELED, OrderStatus.PAID)).toBe(false));
});
