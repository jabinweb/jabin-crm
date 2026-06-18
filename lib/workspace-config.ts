import {
  WORKSPACE_TEMPLATES,
  isBusinessVertical,
  type BusinessVertical,
  type WorkspaceFeatureKey,
  type WorkspaceTerminology,
} from '@/lib/workspace-templates';

export interface WorkspaceSettings {
  businessVertical: BusinessVertical;
  featureOverrides?: Partial<Record<WorkspaceFeatureKey, boolean>>;
  terminologyOverrides?: Partial<WorkspaceTerminology>;
}

export interface ResolvedWorkspaceConfig {
  businessVertical: BusinessVertical;
  verticalLabel: string;
  features: Record<WorkspaceFeatureKey, boolean>;
  terminology: WorkspaceTerminology;
  leadStatusFlow: string[];
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  businessVertical: 'general',
};

export function parseWorkspaceSettings(raw: unknown): WorkspaceSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }

  const obj = raw as Record<string, unknown>;
  const businessVertical = isBusinessVertical(obj.businessVertical)
    ? obj.businessVertical
    : DEFAULT_WORKSPACE_SETTINGS.businessVertical;

  const featureOverrides =
    obj.featureOverrides && typeof obj.featureOverrides === 'object' && !Array.isArray(obj.featureOverrides)
      ? (obj.featureOverrides as Partial<Record<WorkspaceFeatureKey, boolean>>)
      : undefined;

  const terminologyOverrides =
    obj.terminologyOverrides &&
    typeof obj.terminologyOverrides === 'object' &&
    !Array.isArray(obj.terminologyOverrides)
      ? (obj.terminologyOverrides as Partial<WorkspaceTerminology>)
      : undefined;

  return {
    businessVertical,
    ...(featureOverrides ? { featureOverrides } : {}),
    ...(terminologyOverrides ? { terminologyOverrides } : {}),
  };
}

export function resolveWorkspaceConfig(settings: WorkspaceSettings): ResolvedWorkspaceConfig {
  const template = WORKSPACE_TEMPLATES[settings.businessVertical] ?? WORKSPACE_TEMPLATES.general;

  const features = { ...template.features };
  if (settings.featureOverrides) {
    for (const [key, value] of Object.entries(settings.featureOverrides)) {
      if (key in features && typeof value === 'boolean') {
        features[key as WorkspaceFeatureKey] = value;
      }
    }
  }

  return {
    businessVertical: template.id,
    verticalLabel: template.label,
    features,
    terminology: {
      ...template.terminology,
      ...(settings.terminologyOverrides ?? {}),
    },
    leadStatusFlow: [...template.leadStatusFlow],
  };
}

/** Seed company.settings JSON for a new workspace. */
export function buildInitialCompanySettings(businessVertical: BusinessVertical = 'general') {
  const template = WORKSPACE_TEMPLATES[businessVertical] ?? WORKSPACE_TEMPLATES.general;

  return {
    workspace: {
      businessVertical: template.id,
    } satisfies WorkspaceSettings,
    leads: {
      autoAssignment: false,
      followUpReminders: true,
      statusFlow: template.leadStatusFlow,
      customFields: [],
    },
    onboarding: {
      completed: false,
      currentStep: 'welcome',
    },
  };
}

export function isWorkspaceFeatureEnabled(
  config: ResolvedWorkspaceConfig,
  feature: WorkspaceFeatureKey
): boolean {
  return config.features[feature] === true;
}
