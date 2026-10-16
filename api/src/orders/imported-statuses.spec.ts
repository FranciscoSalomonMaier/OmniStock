import { preserveImportedProgress } from './imported-statuses';
import {
  OrderStatus as O,
  PaymentStatus as P,
  ShippingStatus as S,
  FiscalStatus as F,
} from './enums/order.enums';
const current = {
  status: O.SHIPPED,
  paymentStatus: P.PAID,
  shippingStatus: S.SHIPPED,
  fiscalStatus: F.AUTHORIZED,
};
const next = {
  order: O.NEW,
  payment: P.PENDING,
  shipping: S.PENDING,
  fiscal: F.NOT_ISSUED,
  unknown: [],
};
describe('Imported status progress', () => {
  it('does not reset shipment, payment or fiscal data with an incomplete order response', () => {
    expect(preserveImportedProgress(current, next)).toMatchObject({
      order: O.SHIPPED,
      payment: P.PAID,
      shipping: S.SHIPPED,
      fiscal: F.AUTHORIZED,
    });
  });
  it('allows authoritative cancellation and refund', () => {
    expect(
      preserveImportedProgress(current, {
        ...next,
        order: O.CANCELED,
        payment: P.REFUNDED,
      }),
    ).toMatchObject({ order: O.CANCELED, payment: P.REFUNDED });
  });
  it('does not resurrect a cancelled order', () => {
    expect(
      preserveImportedProgress(
        { ...current, status: O.CANCELED },
        { ...next, order: O.PAID },
      ),
    ).toMatchObject({ order: O.CANCELED });
  });
  it('allows progress to delivered', () => {
    expect(
      preserveImportedProgress(current, {
        ...next,
        order: O.DELIVERED,
        shipping: S.DELIVERED,
        payment: P.PAID,
      }),
    ).toMatchObject({ order: O.DELIVERED, shipping: S.DELIVERED });
  });
});
