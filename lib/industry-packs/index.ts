import type { IndustryVerticalPack } from '@/lib/industry-packs/types';
import { MEDICAL_EQUIPMENT_PACK } from '@/lib/industry-packs/medical-equipment';
import { MANUFACTURING_PACK } from '@/lib/industry-packs/manufacturing';
import { FACILITIES_MANAGEMENT_PACK } from '@/lib/industry-packs/facilities-management';
import { LOGISTICS_PACK } from '@/lib/industry-packs/logistics';
import { AUTOMOTIVE_PACK } from '@/lib/industry-packs/automotive';
import { PHARMA_PACK } from '@/lib/industry-packs/pharma';
import { FMCG_PACK } from '@/lib/industry-packs/fmcg';

const PACKS: IndustryVerticalPack[] = [
  MEDICAL_EQUIPMENT_PACK,
  MANUFACTURING_PACK,
  FACILITIES_MANAGEMENT_PACK,
  LOGISTICS_PACK,
  AUTOMOTIVE_PACK,
  PHARMA_PACK,
  FMCG_PACK,
];

const BY_ID = new Map(PACKS.map((p) => [p.id, p]));

export function getIndustryVerticalPack(
  aliasId: string | undefined | null
): IndustryVerticalPack | undefined {
  if (!aliasId) return undefined;
  return BY_ID.get(aliasId);
}

export function listIndustryVerticalPacks(): IndustryVerticalPack[] {
  return [...PACKS];
}

export {
  MEDICAL_EQUIPMENT_PACK,
  MANUFACTURING_PACK,
  FACILITIES_MANAGEMENT_PACK,
  LOGISTICS_PACK,
  AUTOMOTIVE_PACK,
  PHARMA_PACK,
  FMCG_PACK,
};
