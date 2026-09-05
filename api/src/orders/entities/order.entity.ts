import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CommissionStatus,
  DocumentType,
  FiscalStatus,
  OrderAddressType,
  OrderHistorySource,
  OrderIssueCode,
  OrderIssueSeverity,
  OrderIssueStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ShippingStatus,
} from '../enums/order.enums';

@Entity('company_order_sequences')
export class CompanyOrderSequence {
  @PrimaryColumn({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'next_number', type: 'bigint' }) nextNumber: string;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
@Entity('orders')
@Index(['companyId', 'internalNumber'], { unique: true })
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'internal_number', type: 'bigint' }) internalNumber: string;
  @Column({ type: 'enum', enum: OrderSource }) source: OrderSource;
  @Column({ name: 'sales_channel_id', type: 'uuid', nullable: true })
  salesChannelId: string | null;
  @Column({ name: 'sales_channel_connection_id', type: 'uuid', nullable: true })
  salesChannelConnectionId: string | null;
  @Column({ name: 'marketplace_order_import_id', type: 'uuid', nullable: true })
  marketplaceOrderImportId: string | null;
  @Column({
    name: 'external_order_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalOrderId: string | null;
  @Column({
    name: 'external_order_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalOrderNumber: string | null;
  @Column({ type: 'enum', enum: OrderStatus }) status: OrderStatus;
  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus })
  paymentStatus: PaymentStatus;
  @Column({ name: 'shipping_status', type: 'enum', enum: ShippingStatus })
  shippingStatus: ShippingStatus;
  @Column({ name: 'fiscal_status', type: 'enum', enum: FiscalStatus })
  fiscalStatus: FiscalStatus;
  @Column({
    name: 'external_status',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  externalStatus: string | null;
  @Column({
    name: 'external_payment_status',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  externalPaymentStatus: string | null;
  @Column({
    name: 'external_shipping_status',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  externalShippingStatus: string | null;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ name: 'items_subtotal', type: 'numeric', precision: 15, scale: 2 })
  itemsSubtotal: string;
  @Column({ name: 'shipping_amount', type: 'numeric', precision: 15, scale: 2 })
  shippingAmount: string;
  @Column({ name: 'discount_amount', type: 'numeric', precision: 15, scale: 2 })
  discountAmount: string;
  @Column({
    name: 'commission_amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  commissionAmount: string | null;
  @Column({ name: 'commission_status', type: 'enum', enum: CommissionStatus })
  commissionStatus: CommissionStatus;
  @Column({
    name: 'other_fees_amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  otherFeesAmount: string;
  @Column({ name: 'total_amount', type: 'numeric', precision: 15, scale: 2 })
  totalAmount: string;
  @Column({ name: 'paid_amount', type: 'numeric', precision: 15, scale: 2 })
  paidAmount: string;
  @Column({ name: 'refunded_amount', type: 'numeric', precision: 15, scale: 2 })
  refundedAmount: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true })
  errorCode: string | null;
  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errorMessage: string | null;
  @Column({ name: 'purchased_at', type: 'timestamptz', nullable: true })
  purchasedAt: Date | null;
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;
  @Column({ name: 'invoiced_at', type: 'timestamptz', nullable: true })
  invoicedAt: Date | null;
  @Column({ name: 'ready_to_ship_at', type: 'timestamptz', nullable: true })
  readyToShipAt: Date | null;
  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt: Date | null;
  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;
  @Column({ name: 'external_created_at', type: 'timestamptz', nullable: true })
  externalCreatedAt: Date | null;
  @Column({ name: 'external_updated_at', type: 'timestamptz', nullable: true })
  externalUpdatedAt: Date | null;
  @Column({ name: 'imported_at', type: 'timestamptz', nullable: true })
  importedAt: Date | null;
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;
  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
@Entity('order_customers')
export class OrderCustomer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'order_id', type: 'uuid', unique: true }) orderId: string;
  @Column({
    name: 'external_customer_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalCustomerId: string | null;
  @Column({ type: 'varchar', length: 180 }) name: string;
  @Column({ type: 'varchar', length: 254, nullable: true }) email:
    string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) phone: string | null;
  @Column({
    name: 'document_type',
    type: 'enum',
    enum: DocumentType,
    nullable: true,
  })
  documentType: DocumentType | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) document:
    string | null;
  @Column({
    name: 'state_registration',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  stateRegistration: string | null;
  @Column({ name: 'is_company', type: 'boolean', default: false })
  isCompany: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
@Entity('order_addresses')
@Index(['companyId', 'orderId', 'type'], { unique: true })
export class OrderAddress {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @Column({ type: 'enum', enum: OrderAddressType }) type: OrderAddressType;
  @Column({ name: 'recipient_name', type: 'varchar', length: 180 })
  recipientName: string;
  @Column({ type: 'varchar', length: 180 }) street: string;
  @Column({ type: 'varchar', length: 40 }) number: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) complement:
    string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) district:
    string | null;
  @Column({ type: 'varchar', length: 120 }) city: string;
  @Column({ type: 'varchar', length: 80 }) state: string;
  @Column({ name: 'postal_code', type: 'varchar', length: 20 })
  postalCode: string;
  @Column({ name: 'country_code', type: 'varchar', length: 2 })
  countryCode: string;
  @Column({ type: 'varchar', length: 250, nullable: true }) reference:
    string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId:
    string | null;
  @Column({ name: 'product_marketplace_link_id', type: 'uuid', nullable: true })
  productMarketplaceLinkId: string | null;
  @Column({ name: 'marketplace_listing_id', type: 'uuid', nullable: true })
  marketplaceListingId: string | null;
  @Column({
    name: 'external_item_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalItemId: string | null;
  @Column({
    name: 'external_variation_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalVariationId: string | null;
  @Column({
    name: 'external_sku',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  externalSku: string | null;
  @Column({ name: 'sku_snapshot', type: 'varchar', length: 160 })
  skuSnapshot: string;
  @Column({ name: 'name_snapshot', type: 'varchar', length: 240 })
  nameSnapshot: string;
  @Column({ name: 'description_snapshot', type: 'text', nullable: true })
  descriptionSnapshot: string | null;
  @Column({ name: 'unit_of_measure_snapshot', type: 'varchar', length: 20 })
  unitOfMeasureSnapshot: string;
  @Column({ type: 'numeric', precision: 15, scale: 3 }) quantity: string;
  @Column({ name: 'unit_price', type: 'numeric', precision: 15, scale: 2 })
  unitPrice: string;
  @Column({ name: 'gross_amount', type: 'numeric', precision: 15, scale: 2 })
  grossAmount: string;
  @Column({ name: 'discount_amount', type: 'numeric', precision: 15, scale: 2 })
  discountAmount: string;
  @Column({
    name: 'commission_amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  commissionAmount: string | null;
  @Column({
    name: 'shipping_allocation_amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  shippingAllocationAmount: string | null;
  @Column({ name: 'net_amount', type: 'numeric', precision: 15, scale: 2 })
  netAmount: string;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ type: 'varchar', length: 60, nullable: true }) status:
    string | null;
  @Column({ name: 'ncm_snapshot', type: 'varchar', length: 8, nullable: true })
  ncmSnapshot: string | null;
  @Column({ name: 'cest_snapshot', type: 'varchar', length: 7, nullable: true })
  cestSnapshot: string | null;
  @Column({ name: 'cfop_snapshot', type: 'varchar', length: 4, nullable: true })
  cfopSnapshot: string | null;
  @Column({
    name: 'merchandise_origin_snapshot',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  merchandiseOriginSnapshot: string | null;
  @Column({
    name: 'tax_unit_snapshot',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  taxUnitSnapshot: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
@Entity('order_payments')
export class OrderPayment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @Column({
    name: 'external_payment_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalPaymentId: string | null;
  @Column({ type: 'enum', enum: PaymentMethod }) method: PaymentMethod;
  @Column({
    name: 'method_detail',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  methodDetail: string | null;
  @Column({ type: 'enum', enum: PaymentStatus }) status: PaymentStatus;
  @Column({ type: 'numeric', precision: 15, scale: 2 }) amount: string;
  @Column({ type: 'integer', nullable: true }) installments: number | null;
  @Column({
    name: 'authorization_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  authorizationCode: string | null;
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;
  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;
  @Column({ name: 'external_created_at', type: 'timestamptz', nullable: true })
  externalCreatedAt: Date | null;
  @Column({ name: 'external_updated_at', type: 'timestamptz', nullable: true })
  externalUpdatedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
@Entity('order_shipments')
export class OrderShipment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @Column({
    name: 'external_shipment_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalShipmentId: string | null;
  @Column({ type: 'enum', enum: ShippingStatus }) status: ShippingStatus;
  @Column({ type: 'varchar', length: 80, nullable: true }) substatus:
    string | null;
  @Column({
    name: 'logistic_type',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  logisticType: string | null;
  @Column({
    name: 'shipping_mode',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  shippingMode: string | null;
  @Column({
    name: 'carrier_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  carrierName: string | null;
  @Column({
    name: 'tracking_number',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  trackingNumber: string | null;
  @Column({ name: 'tracking_url', type: 'text', nullable: true }) trackingUrl:
    string | null;
  @Column({ name: 'shipping_amount', type: 'numeric', precision: 15, scale: 2 })
  shippingAmount: string;
  @Column({
    name: 'estimated_delivery_at',
    type: 'timestamptz',
    nullable: true,
  })
  estimatedDeliveryAt: Date | null;
  @Column({ name: 'ready_to_ship_at', type: 'timestamptz', nullable: true })
  readyToShipAt: Date | null;
  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt: Date | null;
  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
  @Column({ name: 'returned_at', type: 'timestamptz', nullable: true })
  returnedAt: Date | null;
  @Column({ name: 'external_updated_at', type: 'timestamptz', nullable: true })
  externalUpdatedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
@Entity('order_fiscal_data')
export class OrderFiscalData {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'order_id', type: 'uuid', unique: true }) orderId: string;
  @Column({
    name: 'customer_document',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  customerDocument: string | null;
  @Column({
    name: 'customer_state_registration',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  customerStateRegistration: string | null;
  @Column({ name: 'fiscal_name', type: 'varchar', length: 180 })
  fiscalName: string;
  @Column({
    name: 'fiscal_email',
    type: 'varchar',
    length: 254,
    nullable: true,
  })
  fiscalEmail: string | null;
  @Column({
    name: 'operation_nature',
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  operationNature: string | null;
  @Column({ name: 'default_cfop', type: 'varchar', length: 4, nullable: true })
  defaultCfop: string | null;
  @Column({ name: 'fiscal_status', type: 'enum', enum: FiscalStatus })
  fiscalStatus: FiscalStatus;
  @Column({ name: 'invoice_id', type: 'uuid', nullable: true }) invoiceId:
    string | null;
  @Column({
    name: 'invoice_access_key',
    type: 'varchar',
    length: 44,
    nullable: true,
  })
  invoiceAccessKey: string | null;
  @Column({
    name: 'invoice_number',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  invoiceNumber: string | null;
  @Column({
    name: 'invoice_series',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  invoiceSeries: string | null;
  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
@Entity('order_issues')
export class OrderIssue {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @Column({ name: 'order_item_id', type: 'uuid', nullable: true }) orderItemId:
    string | null;
  @Column({ type: 'enum', enum: OrderIssueCode }) code: OrderIssueCode;
  @Column({ type: 'enum', enum: OrderIssueSeverity })
  severity: OrderIssueSeverity;
  @Column({ type: 'varchar', length: 500 }) message: string;
  @Column({ type: 'enum', enum: OrderIssueStatus }) status: OrderIssueStatus;
  @Column({
    name: 'resolution_note',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  resolutionNote: string | null;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
  @Column({ name: 'resolved_by_user_id', type: 'uuid', nullable: true })
  resolvedByUserId: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @Column({
    name: 'previous_order_status',
    type: 'enum',
    enum: OrderStatus,
    nullable: true,
  })
  previousOrderStatus: OrderStatus | null;
  @Column({ name: 'new_order_status', type: 'enum', enum: OrderStatus })
  newOrderStatus: OrderStatus;
  @Column({
    name: 'previous_payment_status',
    type: 'enum',
    enum: PaymentStatus,
    nullable: true,
  })
  previousPaymentStatus: PaymentStatus | null;
  @Column({
    name: 'new_payment_status',
    type: 'enum',
    enum: PaymentStatus,
    nullable: true,
  })
  newPaymentStatus: PaymentStatus | null;
  @Column({
    name: 'previous_shipping_status',
    type: 'enum',
    enum: ShippingStatus,
    nullable: true,
  })
  previousShippingStatus: ShippingStatus | null;
  @Column({
    name: 'new_shipping_status',
    type: 'enum',
    enum: ShippingStatus,
    nullable: true,
  })
  newShippingStatus: ShippingStatus | null;
  @Column({
    name: 'previous_fiscal_status',
    type: 'enum',
    enum: FiscalStatus,
    nullable: true,
  })
  previousFiscalStatus: FiscalStatus | null;
  @Column({
    name: 'new_fiscal_status',
    type: 'enum',
    enum: FiscalStatus,
    nullable: true,
  })
  newFiscalStatus: FiscalStatus | null;
  @Column({ type: 'enum', enum: OrderHistorySource })
  source: OrderHistorySource;
  @Column({
    name: 'external_event_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  externalEventId: string | null;
  @Column({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) reason:
    string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<
    string,
    unknown
  > | null;
  @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
