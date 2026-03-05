import { prisma } from '../prisma';
import axios from 'axios';

export interface EnrichmentData {
  companySize?: string;
  yearFounded?: number;
  technologies?: string[];
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  additionalEmails?: string[];
  additionalPhones?: string[];
}

export class LeadEnrichmentService {
  /**
   * Enrich a lead with additional data from multiple sources
   */
  async enrichLead(leadId: string): Promise<EnrichmentData | null> {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return null;

    const enrichmentData: EnrichmentData = {
      technologies: [],
      socialProfiles: {},
      additionalEmails: [],
      additionalPhones: [],
    };

    // Enrich from company website
    if (lead.website) {
      const websiteData = await this.enrichFromWebsite(lead.website);
      Object.assign(enrichmentData, websiteData);
    }

    // Enrich from company name
    if (lead.companyName) {
      const nameData = await this.enrichFromCompanyName(lead.companyName);
      Object.assign(enrichmentData, nameData);
    }

    // Search for social profiles
    const socialProfiles = await this.findSocialProfiles(lead.companyName, lead.website || undefined);
    enrichmentData.socialProfiles = { ...enrichmentData.socialProfiles, ...socialProfiles };

    // Save enrichment data
    await prisma.leadEnrichment.upsert({
      where: { leadId },
      create: {
        leadId,
        companySize: enrichmentData.companySize,
        yearFounded: enrichmentData.yearFounded,
        technologies: enrichmentData.technologies || [],
        socialProfiles: enrichmentData.socialProfiles,
        additionalEmails: enrichmentData.additionalEmails || [],
        additionalPhones: enrichmentData.additionalPhones || [],
      },
      update: {
        companySize: enrichmentData.companySize,
        yearFounded: enrichmentData.yearFounded,
        technologies: enrichmentData.technologies || [],
        socialProfiles: enrichmentData.socialProfiles,
        additionalEmails: enrichmentData.additionalEmails || [],
        additionalPhones: enrichmentData.additionalPhones || [],
        enrichedAt: new Date(),
      },
    });

    // Mark lead as enriched
    await prisma.lead.update({
      where: { id: leadId },
      data: { isEnriched: true },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        activityType: 'ENRICHED',
        description: 'Lead data enriched with additional information',
        metadata: enrichmentData as any,
      },
    });

    return enrichmentData;
  }

  /**
   * Enrich from company website using web analysis
   */
  private async enrichFromWebsite(websiteUrl: string): Promise<Partial<EnrichmentData>> {
    const data: Partial<EnrichmentData> = {
      technologies: [],
      additionalEmails: [],
      additionalPhones: [],
    };

    try {
      const response = await axios.get(websiteUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const html = response.data;

      // Extract emails
      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
      const emails = html.match(emailRegex);
      if (emails) {
        data.additionalEmails = Array.from(new Set(emails)).slice(0, 5) as string[];
      }

      // Extract phone numbers
      const phoneRegex = /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const phones = html.match(phoneRegex);
      if (phones) {
        data.additionalPhones = Array.from(new Set(phones)).slice(0, 5) as string[];
      }

      // Detect technologies from HTML
      const techPatterns = {
        'WordPress': /wp-content|wordpress/i,
        'Shopify': /cdn\.shopify\.com|myshopify\.com/i,
        'React': /react|_next\/static/i,
        'Vue': /vue\.js|nuxt/i,
        'Angular': /angular/i,
        'jQuery': /jquery/i,
        'Google Analytics': /google-analytics\.com|gtag/i,
        'Facebook Pixel': /facebook\.com\/tr/i,
      };

      const detectedTech: string[] = [];
      for (const [tech, pattern] of Object.entries(techPatterns)) {
        if (pattern.test(html)) {
          detectedTech.push(tech);
        }
      }
      data.technologies = detectedTech;

      // Look for founding year
      const yearRegex = /(?:founded|established|since)\s*:?\s*(\d{4})/i;
      const yearMatch = html.match(yearRegex);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year > 1800 && year <= new Date().getFullYear()) {
          data.yearFounded = year;
        }
      }

    } catch (error) {
      console.error('Error enriching from website:', error);
    }

    return data;
  }

  /**
   * Enrich from company name using search
   */
  private async enrichFromCompanyName(companyName: string): Promise<Partial<EnrichmentData>> {
    const data: Partial<EnrichmentData> = {};

    try {
      // You can integrate with APIs like Clearbit, Hunter.io, etc.
      // For now, this is a placeholder for custom logic

      // Example: Use a free API or custom search logic
      // const response = await axios.get(`https://api.example.com/company?name=${encodeURIComponent(companyName)}`);

    } catch (error) {
      console.error('Error enriching from company name:', error);
    }

    return data;
  }

  /**
   * Find social media profiles
   */
  private async findSocialProfiles(
    companyName: string,
    website?: string
  ): Promise<{ linkedin?: string; twitter?: string; facebook?: string; instagram?: string }> {
    const profiles: any = {};

    try {
      // Search for LinkedIn
      const linkedinQuery = `${companyName} site:linkedin.com/company`;
      // In production, use a search API or web scraping
      // profiles.linkedin = await this.searchForProfile(linkedinQuery);

      // Search for Twitter
      const twitterQuery = `${companyName} site:twitter.com`;
      // profiles.twitter = await this.searchForProfile(twitterQuery);

      // Search for Facebook
      const facebookQuery = `${companyName} site:facebook.com`;
      // profiles.facebook = await this.searchForProfile(facebookQuery);

      // Search for Instagram
      const instagramQuery = `${companyName} site:instagram.com`;
      // profiles.instagram = await this.searchForProfile(instagramQuery);

    } catch (error) {
      console.error('Error finding social profiles:', error);
    }

    return profiles;
  }

  /**
   * Batch enrich multiple leads
   */
  async batchEnrich(leadIds: string[]): Promise<void> {
    for (const leadId of leadIds) {
      try {
        await this.enrichLead(leadId);
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error enriching lead ${leadId}:`, error);
      }
    }
  }

  /**
   * Validate and clean lead data
   */
  async validateLead(leadId: string): Promise<{ isValid: boolean; issues: string[] }> {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { isValid: false, issues: ['Lead not found'] };

    const issues: string[] = [];

    // Validate email
    if (lead.email && !this.isValidEmail(lead.email)) {
      issues.push('Invalid email format');
    }

    // Validate phone
    if (lead.phone && !this.isValidPhone(lead.phone)) {
      issues.push('Invalid phone format');
    }

    // Validate website
    if (lead.website && !this.isValidUrl(lead.website)) {
      issues.push('Invalid website URL');
    }

    // Update lead verification status
    if (issues.length === 0) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { isVerified: true },
      });
    }

    return { isValid: issues.length === 0, issues };
  }

  private isValidEmail(email: string): boolean {
    return /^[\w.-]+@[\w.-]+\.\w+$/.test(email);
  }

  private isValidPhone(phone: string): boolean {
    return /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(phone);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export const enrichmentService = new LeadEnrichmentService();
