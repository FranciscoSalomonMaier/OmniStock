import {
  OrderStatus,
  PaymentStatus,
  ShippingStatus,
} from '../enums/order.enums';
import { MercadoLivreOrderStatusMapper } from './mercado-livre-order-status.mapper';

describe('MercadoLivreOrderStatusMapper', () => {
  const mapper = new MercadoLivreOrderStatusMapper();
  it('keeps operational, payment and shipping statuses separate', () => {
    const result = mapper.map('paid', 'approved', 'pending');
    expect(result.order).toBe(OrderStatus.PAID);
    expect(result.payment).toBe(PaymentStatus.PAID);
    expect(result.shipping).toBe(ShippingStatus.PENDING);
    expect(result.unknown).toEqual([]);
  });
  it('uses safe values and reports unknown statuses', () => {
    const result = mapper.map('future', 'future', 'future');
    expect(result.order).toBe(OrderStatus.NEW);
    expect(result.payment).toBe(PaymentStatus.UNKNOWN);
    expect(result.shipping).toBe(ShippingStatus.UNKNOWN);
    expect(result.unknown).toHaveLength(3);
  });
});
