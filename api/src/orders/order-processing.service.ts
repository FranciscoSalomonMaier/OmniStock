import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { decimal, units } from '../inventory/quantity';
import { InventoryReservation } from '../inventory/entities/inventory-reservation.entity';
import { InventoryReferenceType } from '../inventory/enums/inventory.enums';
import { BundlesCompositionService } from '../product_bundles/bundles-composition/bundles-composition.service';
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
  OrderItemComponent,
  OrderStatusHistory,
} from './entities/order.entity';

@Injectable()
export class OrderProcessingService {
  constructor(
    @InjectRepository(Order) private orders: Repository<Order>,
    private inventory: InventoryService,
    private bundles: BundlesCompositionService,
    private db: DataSource,
  ) {}
  async snapshot(companyId: string, items: OrderItem[], m: EntityManager) {
    const expanded: Array<{
      orderItemId: string;
      productId: string;
      quantity: string;
    }> = [];
    for (const item of items) {
      let snapshots = await m.findBy(OrderItemComponent, {
        companyId,
        orderItemId: item.id,
      });
      if (!item.stockSnapshotCreated) {
        const legacy = await m.findBy(InventoryReservation, {
          companyId,
          referenceType: InventoryReferenceType.ORDER,
          referenceId: `ORDER_ITEM:${item.id}`,
        });
        if (legacy.length) {
          await m.delete(OrderItemComponent, {
            companyId,
            orderItemId: item.id,
          });
          snapshots = await m.save(
            OrderItemComponent,
            legacy.map((r) =>
              m.create(OrderItemComponent, {
                companyId,
                orderItemId: item.id,
                componentProductId: r.productId,
                quantityPerBundle: decimal(
                  (units(r.quantity) * 1000n) / units(item.quantity),
                ),
                quantityConsumed: r.quantity,
              }),
            ),
          );
        } else if (!snapshots.length) {
          const one = await this.bundles.expandBundleComponents(
            item.productId!,
            '1',
            companyId,
            m,
          );
          snapshots = await m.save(
            OrderItemComponent,
            one.map((c) =>
              m.create(OrderItemComponent, {
                companyId,
                orderItemId: item.id,
                componentProductId: c.productId,
                quantityPerBundle: c.quantity,
                quantityConsumed: decimal(
                  (units(c.quantity) * units(item.quantity)) / 1000n,
                ),
              }),
            ),
          );
        }
        if (!snapshots.length)
          throw new ConflictException(
            'Não foi possível registrar os componentes do item.',
          );
        item.stockSnapshotCreated = true;
        item.stockSoldQuantity = item.quantity;
        await m.save(item);
      }
      if (
        item.stockSoldQuantity &&
        units(item.stockSoldQuantity) !== units(item.quantity)
      )
        throw new ConflictException(
          'Quantidade vendida mudou após o snapshot; faça a conferência do pedido antes de reprocessar.',
        );
      for (const c of snapshots)
        expanded.push({
          orderItemId: item.id,
          productId: c.componentProductId,
          quantity: c.quantityConsumed,
        });
    }
    return expanded;
  }
  async process(
    companyId: string,
    orderId: string,
    correlationId: string = randomUUID(),
  ) {
    return this.db.transaction(async (m) => {
      const order = await m
        .getRepository(Order)
        .createQueryBuilder('o')
        .setLock('pessimistic_write')
        .where('o.id=:orderId AND o.company_id=:companyId', {
          orderId,
          companyId,
        })
        .getOneOrFail();
      const items = await m.find(OrderItem, {
        where: { companyId, orderId },
        order: { id: 'ASC' },
      });
      await this.bundles.lock(companyId, m);
      if (order.status === OrderStatus.CANCELED) {
        await this.cancelReservations(companyId, items, m);
        return order;
      }
      if (items.some((i) => !i.productId)) {
        order.processingStatus = OrderProcessingStatus.PENDING_PRODUCT_LINK;
        return m.save(order);
      }
      if (order.paymentStatus !== PaymentStatus.PAID) return order;
      const expanded = await this.snapshot(companyId, items, m);
      await m.query('SAVEPOINT reserve_components');
      try {
        const reservations = await this.inventory.reserveOrderItems(
          companyId,
          expanded,
          m,
        );
        // Legacy display field retains a representative ID; all operations query every reservation by item.
        for (const item of items) {
          item.inventoryReservationId =
            reservations.find((r) => r.referenceId === `ORDER_ITEM:${item.id}`)
              ?.id ?? item.inventoryReservationId;
          await m.save(item);
        }
      } catch (error) {
        await m.query('ROLLBACK TO SAVEPOINT reserve_components');
        if (!(error instanceof ConflictException)) throw error;
        order.processingStatus = OrderProcessingStatus.PENDING_STOCK;
        await m.save(order);
        if (
          !(await m.existsBy(OrderIssue, {
            companyId,
            orderId,
            code: OrderIssueCode.INSUFFICIENT_STOCK,
            status: OrderIssueStatus.OPEN,
          }))
        )
          await m.save(
            OrderIssue,
            m.create(OrderIssue, {
              companyId,
              orderId,
              orderItemId: null,
              code: OrderIssueCode.INSUFFICIENT_STOCK,
              severity: OrderIssueSeverity.ERROR,
              message: 'Estoque insuficiente em um ou mais componentes.',
              status: OrderIssueStatus.OPEN,
              resolutionNote: null,
              resolvedAt: null,
              resolvedByUserId: null,
            }),
          );
        return order;
      }
      await m.query('RELEASE SAVEPOINT reserve_components');
      if (order.processingStatus === OrderProcessingStatus.READY_FOR_BILLING)
        return order;
      const previous = order.status;
      order.processingStatus = OrderProcessingStatus.READY_FOR_BILLING;
      if (order.status === OrderStatus.PAID)
        order.status = OrderStatus.AWAITING_INVOICE;
      if (!order.billingQueuedAt) {
        order.billingQueuedAt = new Date();
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
      }
      await m.save(order);
      await m.save(
        OrderStatusHistory,
        m.create(OrderStatusHistory, {
          companyId,
          orderId,
          previousOrderStatus: previous,
          newOrderStatus: order.status,
          previousPaymentStatus: order.paymentStatus,
          newPaymentStatus: order.paymentStatus,
          previousShippingStatus: order.shippingStatus,
          newShippingStatus: order.shippingStatus,
          previousFiscalStatus: order.fiscalStatus,
          newFiscalStatus: order.fiscalStatus,
          source: OrderHistorySource.SYSTEM,
          externalEventId: null,
          changedByUserId: null,
          reason:
            'Componentes reservados; pedido encaminhado para faturamento.',
          metadata: { correlationId },
          occurredAt: new Date(),
        }),
      );
      return order;
    });
  }
  async cancelReservations(
    companyId: string,
    items: OrderItem[],
    m?: EntityManager,
  ) {
    return this.inventory.settleOrderItems(
      companyId,
      items.map((i) => i.id),
      'cancel',
      m,
    );
  }
  async completeReservations(
    companyId: string,
    orderId: string,
    userId: string,
  ) {
    return this.db.transaction(async (m) => {
      const order = await m
        .getRepository(Order)
        .createQueryBuilder('o')
        .setLock('pessimistic_write')
        .where('o.id=:orderId AND o.company_id=:companyId', {
          orderId,
          companyId,
        })
        .getOneOrFail();
      if (order.status === OrderStatus.CANCELED)
        throw new ConflictException('Pedido cancelado.');
      if (order.processingStatus !== OrderProcessingStatus.READY_FOR_BILLING)
        throw new ConflictException('Reserve o estoque antes da baixa.');
      const items = await m.findBy(OrderItem, { companyId, orderId });
      return this.inventory.settleOrderItems(
        companyId,
        items.map((i) => i.id),
        'complete',
        m,
        userId,
      );
    });
  }
}
