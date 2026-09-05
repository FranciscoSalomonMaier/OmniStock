import { Injectable } from '@nestjs/common';
import {
  FiscalStatus,
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from '../enums/order.enums';

export interface MappedOrderStatuses {
  order: OrderStatus;
  payment: PaymentStatus;
  shipping: ShippingStatus;
  fiscal: FiscalStatus;
  unknown: string[];
}
@Injectable()
export class MercadoLivreOrderStatusMapper {
  map(order: string, payment: string, shipping: string): MappedOrderStatuses {
    const o: Record<string, OrderStatus> = {
      confirmed: OrderStatus.NEW,
      payment_required: OrderStatus.NEW,
      payment_in_process: OrderStatus.NEW,
      paid: OrderStatus.PAID,
      partially_refunded: OrderStatus.PAID,
      cancelled: OrderStatus.CANCELED,
      canceled: OrderStatus.CANCELED,
      invalid: OrderStatus.ERROR,
    };
    const p: Record<string, PaymentStatus> = {
      pending: PaymentStatus.PENDING,
      in_process: PaymentStatus.PENDING,
      authorized: PaymentStatus.AUTHORIZED,
      approved: PaymentStatus.PAID,
      paid: PaymentStatus.PAID,
      partially_refunded: PaymentStatus.PARTIALLY_REFUNDED,
      refunded: PaymentStatus.REFUNDED,
      cancelled: PaymentStatus.CANCELED,
      canceled: PaymentStatus.CANCELED,
      rejected: PaymentStatus.REJECTED,
      charged_back: PaymentStatus.CHARGEBACK,
    };
    const s: Record<string, ShippingStatus> = {
      not_applicable: ShippingStatus.NOT_REQUIRED,
      not_required: ShippingStatus.NOT_REQUIRED,
      pending: ShippingStatus.PENDING,
      ready_to_ship: ShippingStatus.READY_TO_SHIP,
      shipped: ShippingStatus.SHIPPED,
      handling: ShippingStatus.IN_TRANSIT,
      delivered: ShippingStatus.DELIVERED,
      not_delivered: ShippingStatus.DELIVERY_FAILED,
      returning_to_sender: ShippingStatus.RETURNING,
      returned: ShippingStatus.RETURNED,
      cancelled: ShippingStatus.CANCELED,
      canceled: ShippingStatus.CANCELED,
    };
    const unknown: string[] = [];
    if (!o[order]) unknown.push(`order:${order}`);
    if (!p[payment]) unknown.push(`payment:${payment}`);
    if (!s[shipping]) unknown.push(`shipping:${shipping}`);
    const shippingMapped = s[shipping] ?? ShippingStatus.UNKNOWN;
    let orderMapped = o[order] ?? OrderStatus.NEW;
    if (shippingMapped === ShippingStatus.DELIVERED)
      orderMapped = OrderStatus.DELIVERED;
    else if (
      [ShippingStatus.SHIPPED, ShippingStatus.IN_TRANSIT].includes(
        shippingMapped,
      )
    )
      orderMapped = OrderStatus.SHIPPED;
    else if (shippingMapped === ShippingStatus.READY_TO_SHIP)
      orderMapped = OrderStatus.READY_TO_SHIP;
    return {
      order: orderMapped,
      payment: p[payment] ?? PaymentStatus.UNKNOWN,
      shipping: shippingMapped,
      fiscal: FiscalStatus.NOT_ISSUED,
      unknown,
    };
  }
}
