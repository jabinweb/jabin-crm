import { prisma } from '@/lib/prisma';

export interface CreateTemplateInput {
  userId: string;
  name: string;
  subject: string;
  body: string;
  category?: string;
  variables?: string[];
  isDefault?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string;
  body?: string;
  category?: string;
  variables?: string[];
  isDefault?: boolean;
}

// Extract variables from template text ({{variableName}})
export function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}

// Replace variables in template with actual values
export function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  });
  
  return result;
}

export const templateService = {
  // Create a new template
  async createTemplate(data: CreateTemplateInput) {
    // Auto-extract variables from subject and body
    const subjectVars = extractVariables(data.subject);
    const bodyVars = extractVariables(data.body);
    const allVariables = Array.from(new Set([...subjectVars, ...bodyVars]));

    return await prisma.emailTemplate.create({
      data: {
        userId: data.userId,
        name: data.name,
        subject: data.subject,
        body: data.body,
        category: data.category,
        variables: data.variables || allVariables,
        isDefault: data.isDefault || false,
      },
    });
  },

  // Get all templates for a user
  async getUserTemplates(userId: string, category?: string) {
    const where: any = { userId };
    
    if (category) {
      where.category = category;
    }

    return await prisma.emailTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  },

  // Get a single template
  async getTemplateById(templateId: string, userId: string) {
    return await prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        userId,
      },
    });
  },

  // Update a template
  async updateTemplate(
    templateId: string,
    userId: string,
    data: UpdateTemplateInput
  ) {
    // Re-extract variables if subject or body changed
    let variables: string[] | undefined = undefined;
    if (data.subject || data.body) {
      const template = await prisma.emailTemplate.findFirst({
        where: { id: templateId, userId },
      });
      
      if (template) {
        const subject = data.subject || template.subject;
        const body = data.body || template.body;
        const subjectVars = extractVariables(subject);
        const bodyVars = extractVariables(body);
        variables = Array.from(new Set([...subjectVars, ...bodyVars]));
      }
    }

    return await prisma.emailTemplate.update({
      where: {
        id: templateId,
        userId,
      },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.subject && { subject: data.subject }),
        ...(data.body && { body: data.body }),
        ...(data.category !== undefined && { category: data.category }),
        ...(variables && { variables }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });
  },

  // Delete a template
  async deleteTemplate(templateId: string, userId: string) {
    return await prisma.emailTemplate.delete({
      where: {
        id: templateId,
        userId,
      },
    });
  },

  // Get template categories
  async getCategories(userId: string): Promise<string[]> {
    const templates = await prisma.emailTemplate.findMany({
      where: { userId },
      select: { category: true },
      distinct: ['category'],
    });

    return templates
      .map((t) => t.category)
      .filter((c): c is string => c !== null);
  },

  // Apply template to lead data
  async applyTemplate(
    templateId: string,
    userId: string,
    leadData: Record<string, any>
  ): Promise<{ subject: string; body: string }> {
    const template = await this.getTemplateById(templateId, userId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    // Build variable map from lead data
    const variables: Record<string, string> = {
      firstName: leadData.contactName?.split(' ')[0] || '',
      lastName: leadData.contactName?.split(' ').slice(1).join(' ') || '',
      fullName: leadData.contactName || '',
      companyName: leadData.companyName || '',
      email: leadData.email || '',
      phone: leadData.phone || '',
      website: leadData.website || '',
      industry: leadData.industry || '',
      city: leadData.city || '',
      state: leadData.state || '',
      country: leadData.country || '',
    };

    return {
      subject: replaceVariables(template.subject, variables),
      body: replaceVariables(template.body, variables),
    };
  },
};
