import { GoogleGenAI } from '@google/genai';
import { logError } from '@/lib/logger';
import { generateContentWithFallback, DEFAULT_TEXT_MODEL } from '@/lib/ai/generate';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface Lead {
  companyName: string;
  contactName?: string;
  industry?: string;
  website?: string;
  address?: string;
  email?: string;
}

interface EmailDraft {
  subject: string;
  body: string;
  tone: string;
}

export async function generateColdEmail(
  lead: Lead,
  tone: 'professional' | 'casual' | 'sales' = 'professional',
  userCompany?: string,
  userService?: string
): Promise<EmailDraft> {
  try {
    const prompt = `You are an expert cold email copywriter. Generate a personalized cold email for the following lead:

Company: ${lead.companyName}
${lead.contactName ? `Contact Person: ${lead.contactName}` : ''}
${lead.industry ? `Industry: ${lead.industry}` : ''}
${lead.website ? `Website: ${lead.website}` : ''}
${lead.address ? `Location: ${lead.address}` : ''}

Tone: ${tone}
${userCompany ? `Sender Company: ${userCompany}` : 'Your company/service'}
${userService ? `Service/Product: ${userService}` : 'Lead generation and business development services'}

Requirements:
1. Create a compelling subject line (max 60 characters)
2. Write a personalized email body (150-200 words)
3. Use the contact person's name if available, otherwise address the company
4. Reference something specific about their industry or business
5. Clear value proposition
6. Soft call-to-action (not too pushy)
7. Professional but friendly tone
8. No generic templates - make it feel personalized
9. End with: "Best regards," followed by the company name: ${userCompany || '[YOUR_COMPANY]'}

Format your response EXACTLY as follows:
SUBJECT: [your subject line]

BODY:
[your email body]

Do not include any other text or explanations.`;

    const response = await generateContentWithFallback(genAI, {
      model: DEFAULT_TEXT_MODEL,
      contents: prompt,
    });

    const text = response.text;
    
    if (!text) {
      throw new Error('No response from Gemini AI');
    }

    // Parse the response
    const subjectMatch = text.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
    const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);

    if (!subjectMatch || !bodyMatch) {
      throw new Error('Failed to parse email from AI response');
    }

    const subject = subjectMatch[1].trim();
    let body = bodyMatch[1].trim();

    // Replace placeholder with company name if present
    if (userCompany) {
      body = body.replace(/\[YOUR_COMPANY\]/g, userCompany);
      body = body.replace(/\[YOUR_NAME\]/g, userCompany);
    }

    return {
      subject,
      body,
      tone,
    };
  } catch (error) {
    logError(error, { context: 'Error generating cold email' });
    
    // Fallback template
    const signature = userCompany || '[YOUR_COMPANY]';
    
    return {
      subject: `Quick question about ${lead.companyName}`,
      body: `Hi ${lead.contactName || 'there'},

I noticed ${lead.companyName}${lead.industry ? ` in the ${lead.industry} industry` : ''} and wanted to reach out.

${userService || 'We specialize in lead generation and business development'}, and I thought we might be able to help ${lead.companyName} grow.

Would you be open to a brief 15-minute call to explore potential collaboration?

Best regards,
${signature}`,
      tone,
    };
  }
}

export async function generateBulkEmails(
  leads: Lead[],
  tone: 'professional' | 'casual' | 'sales' = 'professional',
  userCompany?: string,
  userService?: string
): Promise<{ leadId?: string; email: EmailDraft; companyName: string }[]> {
  const results = await Promise.all(
    leads.map(async (lead) => {
      const email = await generateColdEmail(lead, tone, userCompany, userService);
      return {
        email,
        companyName: lead.companyName,
      };
    })
  );

  return results;
}
