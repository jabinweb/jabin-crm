export type IntegrationCategory =
  | 'payments'
  | 'messaging'
  | 'productivity'
  | 'developer';

/** Where credentials live today — company record vs admin user profile. */
export type IntegrationScope = 'company' | 'workspace_admin';

export type IntegrationStatus = 'connected' | 'configured' | 'disabled' | 'unavailable';

export type IntegrationCatalogEntry = {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  scope: IntegrationScope;
  /** Plan module gate (optional). */
  featureModule?: string;
  /** Dashboard-relative configure path (scoped by tenant in UI). */
  configurePath?: string;
  /** Configure inline on the integrations page instead of navigating away. */
  inlinePanel?: 'razorpay' | 'webhooks' | 'email' | 'google_calendar';
  docsPath?: string;
};

export type IntegrationStatusRow = IntegrationCatalogEntry & {
  status: IntegrationStatus;
  statusLabel: string;
  detail?: string;
};

export type OutgoingWebhookSubscription = {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
};

export type CompanyWebhooksIntegration = {
  enabled: boolean;
  signingSecret?: string;
  subscriptions: OutgoingWebhookSubscription[];
};
