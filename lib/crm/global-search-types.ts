export type GlobalSearchEntityType =
  | 'lead'
  | 'customer'
  | 'employee'
  | 'ticket'
  | 'deal'
  | 'product'
  | 'invoice'
  | 'contract'
  | 'equipment';

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchEntityType;
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
};
