import type { IndustryVerticalPack } from '@/lib/industry-packs/types';

export const FMCG_PACK: IndustryVerticalPack = {
  id: 'fmcg',
  label: 'FMCG',
  description: 'Product catalog, stock, orders, and retail / distributor support.',
  pack: 'ecommerce',
  terminologyOverrides: {
    customer: 'Distributor / retailer',
    customers: 'Distributors / retailers',
    asset: 'SKU',
    equipment: 'SKU',
    ticket: 'Support case',
    tickets: 'Support cases',
    lead: 'Trade lead',
    leads: 'Trade leads',
    deal: 'Order',
    deals: 'Orders',
    portalSubtitle: 'Track orders, stock, and account support.',
  },
  featureOverrides: {
    inventory: true,
    products: true,
    equipment: false,
    fieldService: false,
  },
  includeBaseTicketTypes: true,
  includeVerticalTicketTypes: true,
  ticketTypes: [
    {
      id: 'order_issue',
      label: 'Order issue',
      description: 'Missing, delayed, or incorrect distributor order.',
      defaultPriority: 'HIGH',
      groupName: 'Orders',
      fields: [
        {
          id: 'orderNumber',
          label: 'Order / PO number',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      id: 'stock_claim',
      label: 'Stock / damage claim',
      description: 'Damaged goods, shortage, or expiry claim.',
      defaultPriority: 'HIGH',
      groupName: 'Orders',
      showProduct: true,
      fields: [
        { id: 'batchLot', label: 'Batch / lot #', type: 'text', placeholder: 'Optional' },
      ],
    },
    {
      id: 'scheme_query',
      label: 'Scheme / pricing query',
      description: 'Trade scheme, discount, or pricing dispute.',
      defaultPriority: 'MEDIUM',
      groupName: 'Account Management',
      fields: [],
    },
    {
      id: 'returns',
      label: 'Returns & credit note',
      description: 'Return request or credit note follow-up.',
      defaultPriority: 'MEDIUM',
      groupName: 'Orders',
      fields: [
        {
          id: 'orderNumber',
          label: 'Order / invoice #',
          type: 'text',
          placeholder: 'Optional',
        },
      ],
    },
  ],
  slaByPriority: {
    CRITICAL: { responseHours: 4, resolutionHours: 24 },
    HIGH: { responseHours: 8, resolutionHours: 48 },
    MEDIUM: { responseHours: 24, resolutionHours: 72 },
    LOW: { responseHours: 72, resolutionHours: 120 },
  },
  homeWidgets: ['low_stock', 'sla_at_risk'],
};
