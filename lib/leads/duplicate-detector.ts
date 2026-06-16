import { prisma } from '@/lib/prisma';

export interface DuplicateMatch {
  leadId: string;
  matchedLeadId: string;
  matchType: 'exact' | 'similar' | 'fuzzy';
  matchScore: number;
  matchFields: string[];
  lead: any;
  matchedLead: any;
}

export interface DuplicateGroup {
  primaryLead: any;
  duplicates: any[];
  totalMatches: number;
  matchType: 'exact' | 'similar' | 'fuzzy';
}

/**
 * Calculate similarity score between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0 || len2 === 0) return 0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

/**
 * Normalize company name for comparison
 */
function normalizeCompanyName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|limited|pvt|private)\b\.?/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize email domain for comparison
 */
function getEmailDomain(email: string): string {
  if (!email) return '';
  const match = email.toLowerCase().match(/@(.+)$/);
  return match ? match[1] : '';
}

/**
 * Find duplicate leads for a specific lead
 */
export async function findDuplicatesForLead(
  leadId: string,
  userId: string,
  threshold: number = 0.8
): Promise<DuplicateMatch[]> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      enrichmentData: true,
    },
  });

  if (!lead || lead.userId !== userId) {
    return [];
  }

  // Get all leads for the user (excluding the current lead)
  const allLeads = await prisma.lead.findMany({
    where: {
      userId,
      id: { not: leadId },
    },
    include: {
      enrichmentData: true,
    },
  });

  const duplicates: DuplicateMatch[] = [];

  for (const otherLead of allLeads) {
    const matchResult = checkForDuplicate(lead, otherLead, threshold);
    
    if (matchResult.isDuplicate) {
      duplicates.push({
        leadId,
        matchedLeadId: otherLead.id,
        matchType: matchResult.matchType,
        matchScore: matchResult.score,
        matchFields: matchResult.matchFields,
        lead,
        matchedLead: otherLead,
      });
    }
  }

  // Sort by match score (highest first)
  return duplicates.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Find all duplicate groups in the user's leads
 */
export async function findAllDuplicates(
  userId: string,
  threshold: number = 0.8
): Promise<DuplicateGroup[]> {
  const allLeads = await prisma.lead.findMany({
    where: { userId },
    include: {
      enrichmentData: true,
      activities: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const groups: Map<string, DuplicateGroup> = new Map();
  const processedLeads = new Set<string>();

  for (let i = 0; i < allLeads.length; i++) {
    const lead = allLeads[i];
    
    if (processedLeads.has(lead.id)) continue;

    const duplicates: any[] = [];
    let matchType: 'exact' | 'similar' | 'fuzzy' = 'fuzzy';

    for (let j = i + 1; j < allLeads.length; j++) {
      const otherLead = allLeads[j];
      
      if (processedLeads.has(otherLead.id)) continue;

      const matchResult = checkForDuplicate(lead, otherLead, threshold);
      
      if (matchResult.isDuplicate) {
        duplicates.push(otherLead);
        processedLeads.add(otherLead.id);
        
        // Set the strictest match type
        if (matchResult.matchType === 'exact') {
          matchType = 'exact';
        } else if (matchResult.matchType === 'similar' && matchType !== 'exact') {
          matchType = 'similar';
        }
      }
    }

    if (duplicates.length > 0) {
      processedLeads.add(lead.id);
      groups.set(lead.id, {
        primaryLead: lead,
        duplicates,
        totalMatches: duplicates.length,
        matchType,
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Check if two leads are duplicates
 */
function checkForDuplicate(
  lead1: any,
  lead2: any,
  threshold: number
): {
  isDuplicate: boolean;
  matchType: 'exact' | 'similar' | 'fuzzy';
  score: number;
  matchFields: string[];
} {
  const matchFields: string[] = [];
  let totalScore = 0;
  let maxScore = 0;

  // Exact email match (highest priority)
  if (lead1.email && lead2.email && lead1.email.toLowerCase() === lead2.email.toLowerCase()) {
    matchFields.push('email');
    return {
      isDuplicate: true,
      matchType: 'exact',
      score: 1.0,
      matchFields,
    };
  }

  // Exact website match
  if (lead1.website && lead2.website) {
    const website1 = lead1.website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    const website2 = lead2.website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    
    if (website1 === website2) {
      matchFields.push('website');
      return {
        isDuplicate: true,
        matchType: 'exact',
        score: 1.0,
        matchFields,
      };
    }
  }

  // Exact phone match
  if (lead1.phone && lead2.phone) {
    const phone1 = lead1.phone.replace(/\D/g, '');
    const phone2 = lead2.phone.replace(/\D/g, '');
    
    if (phone1 === phone2 && phone1.length >= 10) {
      matchFields.push('phone');
      return {
        isDuplicate: true,
        matchType: 'exact',
        score: 1.0,
        matchFields,
      };
    }
  }

  // Company name similarity (weight: 4)
  const name1 = normalizeCompanyName(lead1.companyName);
  const name2 = normalizeCompanyName(lead2.companyName);
  const nameSimilarity = calculateSimilarity(name1, name2);
  
  if (nameSimilarity > 0.8) {
    matchFields.push('companyName');
    totalScore += nameSimilarity * 4;
  }
  maxScore += 4;

  // Email domain similarity (weight: 3)
  if (lead1.email && lead2.email) {
    const domain1 = getEmailDomain(lead1.email);
    const domain2 = getEmailDomain(lead2.email);
    
    if (domain1 && domain2) {
      const domainSimilarity = calculateSimilarity(domain1, domain2);
      if (domainSimilarity > 0.9) {
        matchFields.push('emailDomain');
        totalScore += domainSimilarity * 3;
      }
      maxScore += 3;
    }
  }

  // Address similarity (weight: 2)
  if (lead1.address && lead2.address) {
    const addressSimilarity = calculateSimilarity(lead1.address, lead2.address);
    if (addressSimilarity > 0.8) {
      matchFields.push('address');
      totalScore += addressSimilarity * 2;
    }
    maxScore += 2;
  }

  // Location match (weight: 2)
  if (lead1.city && lead2.city && lead1.city.toLowerCase() === lead2.city.toLowerCase()) {
    matchFields.push('city');
    totalScore += 2;
  }
  maxScore += 2;

  // Industry match (weight: 1)
  if (lead1.industry && lead2.industry && lead1.industry.toLowerCase() === lead2.industry.toLowerCase()) {
    matchFields.push('industry');
    totalScore += 1;
  }
  maxScore += 1;

  // Calculate final score
  const finalScore = maxScore > 0 ? totalScore / maxScore : 0;

  // Determine match type based on score
  let matchType: 'exact' | 'similar' | 'fuzzy' = 'fuzzy';
  if (finalScore >= 0.95) {
    matchType = 'exact';
  } else if (finalScore >= 0.85) {
    matchType = 'similar';
  }

  return {
    isDuplicate: finalScore >= threshold,
    matchType,
    score: finalScore,
    matchFields,
  };
}

/**
 * Merge duplicate leads into a primary lead
 */
export async function mergeLeads(
  primaryLeadId: string,
  duplicateLeadIds: string[],
  userId: string,
  strategy: 'keep-primary' | 'keep-newest' | 'keep-most-complete' = 'keep-most-complete'
): Promise<{ success: boolean; mergedLead: any; deletedCount: number }> {
  // Fetch all leads
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: [primaryLeadId, ...duplicateLeadIds] },
      userId,
    },
    include: {
      enrichmentData: true,
      activities: true,
      emailCampaignLeads: true,
    },
  });

  if (leads.length === 0) {
    throw new Error('No leads found');
  }

  // Determine the primary lead based on strategy
  let primaryLead = leads.find(l => l.id === primaryLeadId);
  
  if (!primaryLead) {
    throw new Error('Primary lead not found');
  }

  const duplicates = leads.filter(l => l.id !== primaryLeadId);

  // Merge data based on strategy
  const mergedData = mergeLeadData(primaryLead, duplicates, strategy);

  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update primary lead with merged data
    const updatedLead = await tx.lead.update({
      where: { id: primaryLeadId },
      data: mergedData,
    });

    // Reassign activities from duplicates to primary lead
    for (const duplicate of duplicates) {
      await tx.leadActivity.updateMany({
        where: { leadId: duplicate.id },
        data: { leadId: primaryLeadId },
      });

      // Reassign email campaign leads
      await tx.emailCampaignLead.updateMany({
        where: { leadId: duplicate.id },
        data: { leadId: primaryLeadId },
      });
    }

    // Delete duplicate leads (cascade will handle related records)
    await tx.lead.deleteMany({
      where: {
        id: { in: duplicateLeadIds },
        userId,
      },
    });

    // Create activity log for merge
    await tx.leadActivity.create({
      data: {
        leadId: primaryLeadId,
        userId,
        activityType: 'NOTE_ADDED',
        description: `Merged ${duplicates.length} duplicate lead(s) into this lead`,
        metadata: {
          mergedLeadIds: duplicateLeadIds,
          mergedAt: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      mergedLead: updatedLead,
      deletedCount: duplicates.length,
    };
  });

  return result;
}

/**
 * Merge lead data from multiple leads
 */
function mergeLeadData(
  primary: any,
  duplicates: any[],
  strategy: 'keep-primary' | 'keep-newest' | 'keep-most-complete'
): any {
  const allLeads = [primary, ...duplicates];

  // Sort by creation date for 'keep-newest' strategy
  if (strategy === 'keep-newest') {
    allLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const merged: any = { ...primary };

  // Fields to merge
  const stringFields = [
    'companyName', 'website', 'email', 'phone', 'address', 'city', 
    'state', 'country', 'zipCode', 'industry', 'contactName', 'jobTitle',
    'linkedinUrl', 'twitterUrl', 'facebookUrl', 'instagramUrl', 'description', 'notes'
  ];

  const numberFields = ['employeeCount', 'rating', 'reviewCount', 'latitude', 'longitude'];

  // Merge string fields - prefer non-empty values
  for (const field of stringFields) {
    if (strategy === 'keep-primary') {
      // Keep primary value if exists
      continue;
    } else if (strategy === 'keep-newest') {
      // Use newest non-empty value
      for (const lead of allLeads) {
        if (lead[field]) {
          merged[field] = lead[field];
          break;
        }
      }
    } else {
      // keep-most-complete: prefer longer, more detailed values
      let bestValue = merged[field] || '';
      for (const lead of allLeads) {
        if (lead[field] && lead[field].length > bestValue.length) {
          bestValue = lead[field];
        }
      }
      merged[field] = bestValue || merged[field];
    }
  }

  // Merge number fields - prefer non-null values
  for (const field of numberFields) {
    if (!merged[field]) {
      for (const lead of allLeads) {
        if (lead[field] !== null && lead[field] !== undefined) {
          merged[field] = lead[field];
          break;
        }
      }
    }
  }

  // Merge tags - combine unique tags
  const allTags = new Set<string>();
  for (const lead of allLeads) {
    if (lead.tags) {
      lead.tags.forEach((tag: string) => allTags.add(tag));
    }
  }
  merged.tags = Array.from(allTags);

  // Keep the best status (most advanced in the pipeline)
  const statusOrder = ['NEW', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'CONVERTED'];
  let bestStatus = primary.status;
  let bestStatusIndex = statusOrder.indexOf(bestStatus);
  
  for (const lead of duplicates) {
    const index = statusOrder.indexOf(lead.status);
    if (index > bestStatusIndex) {
      bestStatus = lead.status;
      bestStatusIndex = index;
    }
  }
  merged.status = bestStatus;

  // Keep the most recent contact date
  let lastContactedAt = primary.lastContactedAt;
  for (const lead of duplicates) {
    if (lead.lastContactedAt && (!lastContactedAt || new Date(lead.lastContactedAt) > new Date(lastContactedAt))) {
      lastContactedAt = lead.lastContactedAt;
    }
  }
  merged.lastContactedAt = lastContactedAt;

  // Merge verified and enriched flags (any true = true)
  merged.isVerified = allLeads.some(l => l.isVerified);
  merged.isEnriched = allLeads.some(l => l.isEnriched);

  return merged;
}

/**
 * Auto-merge obvious duplicates
 */
export async function autoMergeDuplicates(
  userId: string,
  exactMatchOnly: boolean = true
): Promise<{ mergedCount: number; groupsProcessed: number }> {
  const duplicateGroups = await findAllDuplicates(userId, exactMatchOnly ? 1.0 : 0.95);

  let mergedCount = 0;
  let groupsProcessed = 0;

  for (const group of duplicateGroups) {
    if (exactMatchOnly && group.matchType !== 'exact') {
      continue;
    }

    try {
      const duplicateIds = group.duplicates.map(d => d.id);
      await mergeLeads(group.primaryLead.id, duplicateIds, userId, 'keep-most-complete');
      mergedCount += duplicateIds.length;
      groupsProcessed++;
    } catch (error) {
      console.error('Failed to auto-merge group:', error);
    }
  }

  return { mergedCount, groupsProcessed };
}

