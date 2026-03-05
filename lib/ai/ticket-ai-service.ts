import { getAIClient } from './ai-service';

/**
 * Extract and parse JSON from AI response (handles markdown code blocks)
 */
function extractJSON(text: string): any {
    let jsonText = text.trim();

    // Remove markdown code blocks
    if (jsonText.includes('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.includes('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
    }

    // Find JSON object or array
    const jsonMatch = jsonText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse JSON match:', jsonMatch[0]);
            throw e;
        }
    }

    throw new Error('No valid JSON found in response');
}

export interface TicketSummary {
    summary: string;
    keyIssues: string[];
    suggestedSteps: string[];
    priorityScore: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ReportSummary {
    summary: string;
    technicalDetails: string;
    partsMentioned: string[];
    recommendation: string;
}

export class TicketAIService {
    /**
     * Summarize a support ticket's history and activities
     */
    async summarizeTicket(params: {
        subject: string;
        description: string;
        activities: Array<{ eventType: string; description: string; createdAt: Date }>;
        apiKey?: string;
        model?: string;
    }): Promise<TicketSummary> {
        const { subject, description, activities, model = 'gemini-2.0-flash', apiKey } = params;
        const client = getAIClient(apiKey);

        const activityLog = activities.map(a => `[${a.createdAt.toISOString()}] ${a.eventType}: ${a.description}`).join('\n');

        const prompt = `You are an expert medical equipment service coordinator. 
Summarize this support ticket history for a technician.

Ticket Subject: ${subject}
Original Description: ${description}

Activity History:
${activityLog}

Provide:
1. A concise summary of the current situation.
2. List of key issues identified so far.
3. Suggested next troubleshooting steps for the technician.
4. An assessment of the priority (LOW, MEDIUM, HIGH, or CRITICAL) based on the medical context.

Return ONLY a JSON object:
{
  "summary": "...",
  "keyIssues": ["...", "..."],
  "suggestedSteps": ["...", "..."],
  "priorityScore": "..."
}`;

        const response = await client.models.generateContent({
            model,
            contents: prompt,
        });

        if (!response.text) {
            throw new Error('No response from AI');
        }

        return extractJSON(response.text);
    }

    /**
     * Summarize a service report
     */
    async summarizeReport(params: {
        serviceNotes: string;
        partsReplaced?: string;
        apiKey?: string;
        model?: string;
    }): Promise<ReportSummary> {
        const { serviceNotes, partsReplaced, model = 'gemini-2.0-flash', apiKey } = params;
        const client = getAIClient(apiKey);

        const prompt = `You are a medical equipment equipment service manager.
Summarize this service report for the hospital manager.

Service Notes:
${serviceNotes}

Parts Replaced:
${partsReplaced || 'None'}

Provide:
1. A user-friendly summary of the work performed.
2. Technical details of the repair (if any).
3. List of parts replaced or needed.
4. A recommendation for future maintenance or usage.

Return ONLY a JSON object:
{
  "summary": "...",
  "technicalDetails": "...",
  "partsMentioned": ["...", "..."],
  "recommendation": "..."
}`;

        const response = await client.models.generateContent({
            model,
            contents: prompt,
        });

        if (!response.text) {
            throw new Error('No response from AI');
        }

        return extractJSON(response.text);
    }
}

export const ticketAIService = new TicketAIService();
