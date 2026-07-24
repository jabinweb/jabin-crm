import {
  WORKSPACE_TEMPLATES,
  isBusinessVertical,
  type BusinessVertical,
  type WorkspaceFeatureKey,
  type WorkspaceTerminology,
} from '@/lib/workspace-templates';
import { defaultPipelines } from '@/lib/pipelines/company-pipelines';
import { leadFlowToPipelineConfig } from '@/lib/pipelines/lead-flow-map';

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

/**
 * Read workspace settings from full Company.settings JSON.
 * Supports legacy seed that stored businessVertical at the top level.
 */
export function workspaceSettingsFromCompanySettings(settings: unknown): WorkspaceSettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }
  const root = settings as Record<string, unknown>;
  if (root.workspace && typeof root.workspace === 'object' && !Array.isArray(root.workspace)) {
    const nested = parseWorkspaceSettings(root.workspace);
    // Legacy: top-level businessVertical when nested is still general
    if (
      nested.businessVertical === 'general' &&
      isBusinessVertical(root.businessVertical)
    ) {
      return { ...nested, businessVertical: root.businessVertical };
    }
    return nested;
  }
  if (isBusinessVertical(root.businessVertical)) {
    return { businessVertical: root.businessVertical };
  }
  return { ...DEFAULT_WORKSPACE_SETTINGS };
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

/** Seed company.settings JSON for a new workspace (or vertical switch). */
export function buildInitialCompanySettings(businessVertical: BusinessVertical = 'general') {
  const template = WORKSPACE_TEMPLATES[businessVertical] ?? WORKSPACE_TEMPLATES.general;
  const leadPipeline = leadFlowToPipelineConfig(template.leadStatusFlow);
  const pipelines = defaultPipelines();
  pipelines.leads = leadPipeline;

  return {
    workspace: {
      businessVertical: template.id,
    } satisfies WorkspaceSettings,
    billing: {
      defaultCurrency: 'INR',
    },
    leads: {
      autoAssignment: false,
      followUpReminders: true,
      statusFlow: template.leadStatusFlow,
      customFields: [],
    },
    pipelines,
    onboarding: {
      completed: false,
      currentStep: 'welcome',
    },
  };
}

/**
 * Patch applied when industry vertical changes on an existing company.
 * Refreshes lead pipeline labels/stages and clears feature overrides.
 */
export function buildVerticalSwitchPatch(businessVertical: BusinessVertical) {
  const initial = buildInitialCompanySettings(businessVertical);
  return {
    workspace: {
      businessVertical: initial.workspace.businessVertical,
      featureOverrides: undefined,
      terminologyOverrides: undefined,
    },
    leads: {
      statusFlow: initial.leads.statusFlow,
    },
    pipelines: {
      leads: initial.pipelines.leads,
    },
  };
}

export function isWorkspaceFeatureEnabled(
  config: ResolvedWorkspaceConfig,
  feature: WorkspaceFeatureKey
): boolean {
  return config.features[feature] === true;
}
