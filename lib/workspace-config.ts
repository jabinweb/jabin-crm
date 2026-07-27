import {
  WORKSPACE_TEMPLATES,
  isBusinessVertical,
  type BusinessVertical,
  type WorkspaceFeatureKey,
  type WorkspaceTerminology,
} from '@/lib/workspace-templates';
import {
  getIndustryPickerOption,
  resolveIndustrySelection,
} from '@/lib/industry-aliases';
import { getIndustryVerticalPack } from '@/lib/industry-packs';
import { defaultPipelines } from '@/lib/pipelines/company-pipelines';
import { leadFlowToPipelineConfig } from '@/lib/pipelines/lead-flow-map';

export interface WorkspaceSettings {
  businessVertical: BusinessVertical;
  /** Marketing / signup industry tile; maps to businessVertical via industry-aliases. */
  industryAlias?: string;
  featureOverrides?: Partial<Record<WorkspaceFeatureKey, boolean>>;
  terminologyOverrides?: Partial<WorkspaceTerminology>;
}

export interface ResolvedWorkspaceConfig {
  businessVertical: BusinessVertical;
  industryAlias?: string;
  verticalLabel: string;
  features: Record<WorkspaceFeatureKey, boolean>;
  terminology: WorkspaceTerminology;
  leadStatusFlow: string[];
  /** Industry vertical pack home widgets (empty if no pack). */
  homeWidgets: import('@/lib/industry-packs/types').IndustryHomeWidget[];
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

  const industryAlias =
    typeof obj.industryAlias === 'string' && obj.industryAlias.trim()
      ? obj.industryAlias.trim()
      : undefined;

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
    ...(industryAlias ? { industryAlias } : {}),
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
  const verticalPack = getIndustryVerticalPack(settings.industryAlias);

  const features = { ...template.features };
  if (verticalPack?.featureOverrides) {
    for (const [key, value] of Object.entries(verticalPack.featureOverrides)) {
      if (key in features && typeof value === 'boolean') {
        features[key as WorkspaceFeatureKey] = value;
      }
    }
  }
  if (settings.featureOverrides) {
    for (const [key, value] of Object.entries(settings.featureOverrides)) {
      if (key in features && typeof value === 'boolean') {
        features[key as WorkspaceFeatureKey] = value;
      }
    }
  }

  const aliasOption = getIndustryPickerOption(settings.industryAlias);
  const aliasTerminology =
    verticalPack?.terminologyOverrides ?? aliasOption?.terminologyOverrides ?? {};

  return {
    businessVertical: template.id,
    industryAlias: settings.industryAlias,
    verticalLabel: verticalPack?.label ?? aliasOption?.label ?? template.label,
    features,
    terminology: {
      ...template.terminology,
      ...aliasTerminology,
      ...(settings.terminologyOverrides ?? {}),
    },
    leadStatusFlow: [...template.leadStatusFlow],
    homeWidgets: verticalPack?.homeWidgets ? [...verticalPack.homeWidgets] : [],
  };
}

/** Seed company.settings JSON for a new workspace (or vertical switch). */
export function buildInitialCompanySettings(
  businessVertical: BusinessVertical = 'general',
  options?: { industryAlias?: string }
) {
  const resolved = options?.industryAlias
    ? resolveIndustrySelection(options.industryAlias)
    : resolveIndustrySelection(businessVertical);

  const pack = resolved.businessVertical;
  const template = WORKSPACE_TEMPLATES[pack] ?? WORKSPACE_TEMPLATES.general;
  const leadPipeline = leadFlowToPipelineConfig(template.leadStatusFlow);
  const pipelines = defaultPipelines();
  pipelines.leads = leadPipeline;

  const workspace: WorkspaceSettings = {
    businessVertical: template.id,
    industryAlias: resolved.industryAlias,
  };

  return {
    workspace,
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
 * Patch when industry selection changes (alias or pack id).
 * Refreshes lead pipeline and applies alias terminology; clears feature overrides.
 */
export function buildVerticalSwitchPatch(selection: string) {
  const resolved = resolveIndustrySelection(selection);
  const initial = buildInitialCompanySettings(resolved.businessVertical, {
    industryAlias: resolved.industryAlias,
  });
  return {
    workspace: {
      businessVertical: initial.workspace.businessVertical,
      industryAlias: initial.workspace.industryAlias,
      featureOverrides: null,
      terminologyOverrides: null,
    },
    leads: {
      statusFlow: initial.leads.statusFlow,
    },
    pipelines: {
      leads: initial.pipelines.leads,
    },
  };
}

/** Picker value for settings / onboarding given stored workspace. */
export function selectionIdForWorkspace(settings: WorkspaceSettings): string {
  if (settings.industryAlias && getIndustryPickerOption(settings.industryAlias)) {
    return settings.industryAlias;
  }
  if (getIndustryPickerOption(settings.businessVertical)) {
    return settings.businessVertical;
  }
  return settings.businessVertical;
}

export function isWorkspaceFeatureEnabled(
  config: ResolvedWorkspaceConfig,
  feature: WorkspaceFeatureKey
): boolean {
  return config.features[feature] === true;
}
