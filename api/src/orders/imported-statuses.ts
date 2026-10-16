import {
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from './enums/order.enums';
import type { MappedOrderStatuses } from './mappers/mercado-livre-order-status.mapper';
export function preserveImportedProgress(
  current: {
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    shippingStatus: ShippingStatus;
    fiscalStatus: MappedOrderStatuses['fiscal'];
  },
  next: MappedOrderStatuses,
): MappedOrderStatuses {
  const orderRank: Partial<Record<OrderStatus, number>> = {
    [OrderStatus.NEW]: 0,
    [OrderStatus.PAID]: 1,
    [OrderStatus.AWAITING_INVOICE]: 2,
    [OrderStatus.INVOICED]: 3,
    [OrderStatus.READY_TO_SHIP]: 4,
    [OrderStatus.SHIPPED]: 5,
    [OrderStatus.DELIVERED]: 6,
  };
  const shippingRank: Partial<Record<ShippingStatus, number>> = {
    [ShippingStatus.NOT_REQUIRED]: 0,
    [ShippingStatus.UNKNOWN]: 0,
    [ShippingStatus.PENDING]: 0,
    [ShippingStatus.READY_TO_SHIP]: 1,
    [ShippingStatus.SHIPPED]: 2,
    [ShippingStatus.IN_TRANSIT]: 2,
    [ShippingStatus.DELIVERED]: 3,
  };
  const order =
    current.status === OrderStatus.CANCELED
      ? current.status
      : next.order === OrderStatus.CANCELED
        ? next.order
        : (orderRank[next.order] ?? 99) < (orderRank[current.status] ?? -1)
          ? current.status
          : next.order;
  const shipping =
    (shippingRank[next.shipping] ?? 99) <
    (shippingRank[current.shippingStatus] ?? -1)
      ? current.shippingStatus
      : next.shipping;
  const payment =
    current.paymentStatus === PaymentStatus.PAID &&
    [
      PaymentStatus.PENDING,
      PaymentStatus.AUTHORIZED,
      PaymentStatus.UNKNOWN,
    ].includes(next.payment)
      ? current.paymentStatus
      : next.payment;
  return { ...next, order, shipping, payment, fiscal: current.fiscalStatus };
}
