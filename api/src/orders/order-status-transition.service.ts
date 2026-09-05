import { ConflictException, Injectable } from '@nestjs/common';
import { OrderStatus } from './enums/order.enums';

@Injectable()
export class OrderStatusTransitionService {
  private readonly allowed: Record<OrderStatus, OrderStatus[]> = {
    NEW: [OrderStatus.PAID, OrderStatus.CANCELED, OrderStatus.ERROR],
    PAID: [
      OrderStatus.AWAITING_INVOICE,
      OrderStatus.CANCELED,
      OrderStatus.ERROR,
    ],
    AWAITING_INVOICE: [
      OrderStatus.INVOICED,
      OrderStatus.CANCELED,
      OrderStatus.ERROR,
    ],
    INVOICED: [
      OrderStatus.READY_TO_SHIP,
      OrderStatus.CANCELED,
      OrderStatus.ERROR,
    ],
    READY_TO_SHIP: [
      OrderStatus.SHIPPED,
      OrderStatus.CANCELED,
      OrderStatus.ERROR,
    ],
    SHIPPED: [OrderStatus.DELIVERED, OrderStatus.ERROR],
    DELIVERED: [],
    CANCELED: [],
    ERROR: [],
  };
  assert(from: OrderStatus, to: OrderStatus) {
    if (from !== to && !this.allowed[from].includes(to))
      throw new ConflictException(`Transição inválida: ${from} → ${to}.`);
  }
  can(from: OrderStatus, to: OrderStatus) {
    return from === to || this.allowed[from].includes(to);
  }
}
