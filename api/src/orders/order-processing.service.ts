import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import {
  BillingOutboxStatus,
  OrderHistorySource,
  OrderIssueCode,
  OrderIssueSeverity,
  OrderIssueStatus,
  OrderProcessingStatus,
  OrderStatus,
  PaymentStatus,
} from './enums/order.enums';
import {
  Order,
  OrderBillingOutbox,
  OrderIssue,
  OrderItem,
  OrderStatusHistory,
} from './entities/order.entity';

@Injectable()
export class OrderProcessingService {
  constructor(
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(OrderItem) private items: Repository<OrderItem>,
    @InjectRepository(OrderIssue) private issues: Repository<OrderIssue>,
    private inventory: InventoryService,
    private db: DataSource,
  ) {}
  async process(
    companyId: string,
    orderId: string,
    correlationId: string = randomUUID(),
  ) {
    const order = await this.orders.findOneByOrFail({ id: orderId, companyId }),
      items = await this.items.findBy({ companyId, orderId });
    if (order.status === OrderStatus.CANCELED) {
      await this.cancelReservations(companyId, items);
      return order;
    }
    if (items.some((i) => !i.productId)) {
      order.processingStatus = OrderProcessingStatus.PENDING_PRODUCT_LINK;
      return this.orders.save(order);
    }
    if (order.paymentStatus !== PaymentStatus.PAID) {
      order.processingStatus = OrderProcessingStatus.RECEIVED;
      return this.orders.save(order);
    }
    try {
      const reservations = await this.inventory.reserveOrderItems(
        companyId,
        items.map((i) => ({
          orderItemId: i.id,
          productId: i.productId!,
          quantity: i.quantity,
        })),
      );
      const byReference = new Map(
        reservations.map((r) => [r.referenceId, r.id]),
      );
      await this.db.transaction(async (m) => {
        for (const item of items) {
          item.inventoryReservationId =
            byReference.get(`ORDER_ITEM:${item.id}`) ??
            item.inventoryReservationId;
          await m.save(item);
        }
        const locked = await m
            .getRepository(Order)
            .createQueryBuilder('o')
            .setLock('pessimistic_write')
            .where('o.id=:orderId AND o.company_id=:companyId', {
              orderId,
              companyId,
            })
            .getOneOrFail(),
          previous = locked.status;
        locked.processingStatus = OrderProcessingStatus.READY_FOR_BILLING;
        if (locked.status === OrderStatus.PAID)
          locked.status = OrderStatus.AWAITING_INVOICE;
        locked.billingQueuedAt ??= new Date();
        await m.save(locked);
        await m.getRepository(OrderBillingOutbox).upsert(
          {
            companyId,
            orderId,
            correlationId,
            status: BillingOutboxStatus.PENDING,
            payload: {
              companyId,
              orderId,
              correlationId,
              occurredAt: new Date().toISOString(),
            },
            attempts: 0,
            publishedAt: null,
            lastError: null,
          },
          ['companyId', 'orderId'],
        );
        await m.getRepository(OrderStatusHistory).save({
          companyId,
          orderId,
          previousOrderStatus: previous,
          newOrderStatus: locked.status,
          previousPaymentStatus: locked.paymentStatus,
          newPaymentStatus: locked.paymentStatus,
          previousShippingStatus: locked.shippingStatus,
          newShippingStatus: locked.shippingStatus,
          previousFiscalStatus: locked.fiscalStatus,
          newFiscalStatus: locked.fiscalStatus,
          source: OrderHistorySource.SYSTEM,
          externalEventId: null,
          changedByUserId: null,
          reason: 'Estoque reservado; pedido encaminhado para faturamento.',
          metadata: { correlationId, reservationCount: reservations.length },
          occurredAt: new Date(),
        });
      });
      return this.orders.findOneByOrFail({ id: orderId, companyId });
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      order.processingStatus = OrderProcessingStatus.PENDING_STOCK;
      await this.orders.save(order);
      if (
        !(await this.issues.existsBy({
          companyId,
          orderId,
          code: OrderIssueCode.INSUFFICIENT_STOCK,
          status: OrderIssueStatus.OPEN,
        }))
      )
        await this.issues.save({
          companyId,
          orderId,
          orderItemId: null,
          code: OrderIssueCode.INSUFFICIENT_STOCK,
          severity: OrderIssueSeverity.ERROR,
          message:
            'Estoque disponível insuficiente para reservar todos os itens.',
          status: OrderIssueStatus.OPEN,
          resolutionNote: null,
          resolvedAt: null,
          resolvedByUserId: null,
        });
      return order;
    }
  }
  async cancelReservations(companyId: string, items: OrderItem[]) {
    await this.inventory.cancelOrderReservations(
      companyId,
      items
        .map((i) => i.inventoryReservationId)
        .filter((id): id is string => Boolean(id)),
    );
  }
}
