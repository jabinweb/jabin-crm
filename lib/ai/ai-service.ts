import { GoogleGenAI } from '@google/genai';
import { logInfo, logError } from '@/lib/logger';

/**
 * Get AI client with custom API key
 */
export function getAIClient(apiKey?: string) {
  const key = (apiKey || process.env.GEMINI_API_KEY || '').trim();
  
  logInfo('Checking API key', { hasApiKey: !!apiKey, keyLength: key?.length });
  
  // Debug: Check for non-ASCII characters
  if (key) {
    const nonAsciiChars: Array<{ index: number; char: string; code: number }> = [];
    for (let i = 0; i < Math.min(key.length, 50); i++) {
      const charCode = key.charCodeAt(i);
      if (charCode > 127) {
        nonAsciiChars.push({ index: i, char: key[i], code: charCode });
      }
    }
    if (nonAsciiChars.length > 0) {
      logError(new Error('API key contains non-ASCII characters'), { nonAsciiChars });
      logInfo('Falling back to environment key');
      const envKey = process.env.GEMINI_API_KEY;
      if (!envKey) {
        throw new Error('Custom API key contains invalid characters and no GEMINI_API_KEY environment variable is set. Please check your API key in settings or set GEMINI_API_KEY in your .env file.');
      }
      return new GoogleGenAI({ apiKey: envKey });
    }
  }
  
  if (!key) {
    throw new Error('No API key provided. Please set your Gemini API key in settings or add GEMINI_API_KEY to your .env file.');
  }
  
  logInfo('Using valid API key');
  return new GoogleGenAI({ apiKey: key });
}

/**
 * List available models for the given API key
 */
export async function listAvailableModels(apiKey?: string): Promise<Array<{ name: string; displayName: string; description: string }>> {
  try {
    const client = getAIClient(apiKey);
    const modelsPager = await client.models.list();
    
    // Convert pager to array
    const modelsArray: any[] = [];
    for await (const model of modelsPager) {
      modelsArray.push(model);
    }
    
    // Filter for text generation models (exclude embeddings, image, video, audio, and other specialized models)
    const generativeModels = modelsArray
      .filter((model: any) => {
        const name = model.name?.toLowerCase() || '';
        
        // Must include 'gemini'
        if (!name.includes('gemini')) return false;
        
        // Exclude specialized models
        const excludePatterns = [
          'embedding',
          'image',
          'tts',
          'audio',
          'video',
          'robotics',
          'computer-use'
        ];
        
        // Check if any exclude pattern matches
        const isExcluded = excludePatterns.some(pattern => name.includes(pattern));
        
        return !isExcluded;
      })
      .map((model: any) => ({
        name: model.name.replace('models/', ''),
        displayName: model.displayName || model.name.replace('models/', ''),
        description: model.description || '',
      }));

    logInfo('Filtered text generation models', { count: generativeModels.length });
    return generativeModels;
  } catch (error: any) {
    logError(error, { context: 'Error listing models' });
    throw new Error(error.message || 'Failed to list available models');
  }
}

export interface SubjectLineVariant {
  subject: string;
  strategy: string;
  targetAudience: string;
  expectedOpenRate: string;
}

export interface ContentOptimization {
  score: number; // 0-100
  suggestions: string[];
  optimizedContent: string;
  improvements: {
    clarity: number;
    persuasiveness: number;
    professionalism: number;
    callToAction: number;
  };
}

export interface LeadQualification {
  score: number; // 0-100
  quality: 'HOT' | 'WARM' | 'COLD';
  reasoning: string;
  nextSteps: string[];
  conversionProbability: number; // 0-100
}

export interface SentimentAnalysis {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  confidence: number; // 0-100
  intent: 'INTERESTED' | 'NOT_INTERESTED' | 'NEEDS_MORE_INFO' | 'READY_TO_BUY' | 'OBJECTION';
  keyPhrases: string[];
  suggestedResponse: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

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
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('No valid JSON found in response');
}

/**
 * Generate multiple A/B test subject line variants
 */
export async function generateSubjectLines(params: {
  companyName: string;
  industry?: string;
  productService: string;
  targetAudience?: string;
  tone?: 'professional' | 'casual' | 'urgent' | 'friendly';
  count?: number;
  model?: string;
  apiKey?: string;
}): Promise<SubjectLineVariant[]> {
  const { companyName, industry, productService, targetAudience, tone = 'professional', count = 5, model = 'gemini-2.0-flash', apiKey } = params;
  const client = getAIClient(apiKey);

  const prompt = `You are an expert email marketer specializing in cold outreach campaigns.

Generate ${count} highly effective email subject lines for a cold email campaign with these details:
- Company: ${companyName}
- Industry: ${industry || 'Not specified'}
- Product/Service: ${productService}
- Target Audience: ${targetAudience || 'Business decision makers'}
- Tone: ${tone}

For each subject line, provide:
1. The subject line (keep it under 60 characters)
2. The strategy used (e.g., curiosity, personalization, value proposition, urgency, social proof)
3. Target audience it works best for
4. Expected open rate category (High/Medium/Low)

Make them varied using different psychological triggers. Avoid spam words like "FREE", "GUARANTEED", excessive punctuation.

Return ONLY a JSON array with this structure:
[
  {
    "subject": "subject line here",
    "strategy": "strategy description",
    "targetAudience": "who this works best for",
    "expectedOpenRate": "High/Medium/Low"
  }
]`;

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
 * Optimize email content for better engagement
 */
export async function optimizeEmailContent(params: {
  content: string;
  model?: string;
  apiKey?: string;
  companyName: string;
  goal?: string;
  targetAudience?: string;
}): Promise<ContentOptimization> {
  const { content, companyName, goal = 'Generate leads', targetAudience = 'Business decision makers', model = 'gemini-2.0-flash', apiKey } = params;
  const client = getAIClient(apiKey);

  const prompt = `You are an expert copywriter specializing in cold email optimization.

Analyze and optimize this email content:

"""
${content}
"""

Context:
- Company: ${companyName}
- Goal: ${goal}
- Target Audience: ${targetAudience}

Provide:
1. Overall score (0-100) for the current content
2. Specific improvement suggestions (list of actionable items)
3. An optimized version of the email
4. Individual scores (0-100) for:
   - Clarity (is it easy to understand?)
   - Persuasiveness (does it convince?)
   - Professionalism (appropriate tone?)
   - Call to Action (clear next step?)

Focus on:
- Personalization opportunities
- Removing fluff and getting to the point
- Strong opening line
- Clear value proposition
- Compelling call to action
- Removing spam triggers
- Proper formatting

Return ONLY a JSON object:
{
  "score": 75,
  "suggestions": ["suggestion 1", "suggestion 2"],
  "optimizedContent": "improved email here",
  "improvements": {
    "clarity": 80,
    "persuasiveness": 75,
    "professionalism": 85,
    "callToAction": 70
  }
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
 * Predict lead qualification score
 */
export async function qualifyLead(params: {
  apiKey?: string;
  companyName: string;
  industry?: string;
  website?: string;
  email?: string;
  phone?: string;
  revenue?: string;
  employeeCount?: number;
  description?: string;
  source?: string;
  targetCriteria?: string;
  model?: string;
}): Promise<LeadQualification> {
  const { companyName, industry, website, email, phone, revenue, employeeCount, description, source, targetCriteria, model = 'gemini-2.0-flash', apiKey } = params;
  const client = getAIClient(apiKey);

  const prompt = `You are an expert sales analyst. Evaluate this lead's quality and conversion potential.

Lead Information:
- Company: ${companyName}
- Industry: ${industry || 'Unknown'}
- Website: ${website || 'Not provided'}
- Email: ${email ? 'Provided' : 'Missing'}
- Phone: ${phone ? 'Provided' : 'Missing'}
- Revenue: ${revenue || 'Unknown'}
- Employee Count: ${employeeCount || 'Unknown'}
- Description: ${description || 'None'}
- Source: ${source || 'Unknown'}

Target Criteria:
${targetCriteria || 'General B2B lead generation'}

Analyze and provide:
1. Overall lead score (0-100)
2. Quality rating (HOT: 80-100, WARM: 50-79, COLD: 0-49)
3. Detailed reasoning for the score
4. Recommended next steps (3-5 specific actions)
5. Conversion probability (0-100)

Consider:
- Data completeness (more contact info = higher score)
- Company fit (does it match target criteria?)
- Reachability (valid email/phone?)
- Company size and revenue indicators
- Industry relevance
- Source reliability

Return ONLY a JSON object:
{
  "score": 75,
  "quality": "WARM",
  "reasoning": "detailed explanation",
  "nextSteps": ["step 1", "step 2", "step 3"],
  "conversionProbability": 65
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
 * Analyze sentiment and intent from email replies
 */
export async function analyzeSentiment(params: {
  apiKey?: string;
  replyContent: string;
  originalEmail?: string;
  context?: string;
  model?: string;
}): Promise<SentimentAnalysis> {
  const { replyContent, originalEmail, context, model = 'gemini-2.0-flash', apiKey } = params;
  const client = getAIClient(apiKey);

  const prompt = `You are an expert at analyzing email communication sentiment and intent.

Reply to analyze:
"""
${replyContent}
"""

${originalEmail ? `Original email sent:\n"""\n${originalEmail}\n"""` : ''}
${context ? `Additional context: ${context}` : ''}

Analyze and provide:
1. Sentiment (POSITIVE, NEUTRAL, or NEGATIVE)
2. Confidence level (0-100)
3. Intent classification:
   - INTERESTED: Shows interest in continuing conversation
   - NOT_INTERESTED: Clearly not interested or unsubscribe request
   - NEEDS_MORE_INFO: Has questions, needs clarification
   - READY_TO_BUY: Ready to make a decision or purchase
   - OBJECTION: Has concerns or objections
4. Key phrases that indicate the sentiment/intent
5. Suggested response strategy (how to reply)
6. Urgency level (HIGH/MEDIUM/LOW - how soon should we respond?)

Return ONLY a JSON object:
{
  "sentiment": "POSITIVE",
  "confidence": 85,
  "intent": "INTERESTED",
  "keyPhrases": ["phrase 1", "phrase 2"],
  "suggestedResponse": "recommendation on how to respond",
  "urgency": "HIGH"
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
 * Generate personalized email content
 */
export async function generatePersonalizedEmail(params: {
  apiKey?: string;
  companyName: string;
  contactName?: string;
  industry?: string;
  website?: string;
  yourCompany: string;
  yourService: string;
  valueProposition: string;
  tone?: string;
  model?: string;
}): Promise<string> {
  const { companyName, contactName, industry, website, yourCompany, yourService, valueProposition, tone = 'professional', model = 'gemini-2.0-flash', apiKey } = params;
  const client = getAIClient(apiKey);

  const prompt = `Write a personalized cold email for:

Recipient:
- Company: ${companyName}
- Contact: ${contactName || 'Decision maker'}
- Industry: ${industry || 'Unknown'}
- Website: ${website || 'Not provided'}

Sender:
- Company: ${yourCompany}
- Service: ${yourService}
- Value Proposition: ${valueProposition}

Requirements:
- Tone: ${tone}
- Keep it under 150 words
- Start with a personalized opening (reference their company/industry)
- Clearly state the value proposition
- Include ONE clear call to action
- NO spam words
- Professional but conversational

Return only the email body text, no subject line.`;

  const response = await client.models.generateContent({
    model,
    contents: prompt,
  });

  if (!response.text) {
    throw new Error('No response from AI');
  }

  return response.text.trim();
}

/**
 * Generate personalized campaign email based on selected leads' characteristics
 */
export async function generateCampaignEmail(params: {
  apiKey?: string;
  leads: Array<{
    companyName: string;
    industry?: string;
    status?: string;
    source?: string;
  }>;
  yourCompany?: string;
  yourService?: string;
  campaignGoal?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'urgent';
  model?: string;
}): Promise<{ subject: string; content: string; insights: string }> {
  const { leads, yourCompany = 'Your Company', yourService = 'Your Service', campaignGoal = 'Generate interest', tone = 'professional', model = 'gemini-2.0-flash', apiKey } = params;
  const client = getAIClient(apiKey);

  // Analyze the audience
  const industries = Array.from(new Set(leads.map(l => l.industry).filter(Boolean)));
  const statuses = Array.from(new Set(leads.map(l => l.status).filter(Boolean)));
  const sources = Array.from(new Set(leads.map(l => l.source).filter(Boolean)));
  const leadCount = leads.length;

  const audienceProfile = `
Audience Profile (${leadCount} recipients):
- Industries: ${industries.length > 0 ? industries.join(', ') : 'Various'}
- Lead Statuses: ${statuses.length > 0 ? statuses.join(', ') : 'Not specified'}
- Lead Sources: ${sources.length > 0 ? sources.join(', ') : 'Not specified'}
- Sample Companies: ${leads.slice(0, 5).map(l => l.companyName).join(', ')}
  `;

  const prompt = `You are an expert email marketing copywriter. Create a highly effective cold email campaign based on this audience analysis.

${audienceProfile}

Campaign Details:
- Your Company: ${yourCompany}
- Your Service/Product: ${yourService}
- Campaign Goal: ${campaignGoal}
- Desired Tone: ${tone}

Create an email that:
1. Is personalized to this specific audience segment (reference their industries/characteristics)
2. Clearly communicates value relevant to their business context
3. Has a compelling opening that grabs attention
4. Includes social proof or credibility markers if appropriate
5. Has ONE clear call to action
6. Uses template variables: {{companyName}}, {{contactName}}, {{email}} for personalization
7. Is concise (150-200 words maximum)
8. Avoids spam triggers

Return a JSON object with:
{
  "subject": "compelling subject line (under 60 chars)",
  "content": "email body with {{template}} variables",
  "insights": "brief explanation of the strategy and why it works for this audience"
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
 * Generate complete email sequence with AI
 */
export async function generateSequence(params: {
  goal: string;
  targetPersona: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'formal';
  stepCount?: number;
  companyInfo?: string;
  productService?: string;
  model?: string;
  apiKey?: string;
}): Promise<{
  name: string;
  description: string;
  steps: Array<{
    order: number;
    subject: string;
    body: string;
    delayDays: number;
    delayHours: number;
    condition?: 'NO_REPLY' | 'NO_OPEN' | 'OPENED' | 'CLICKED';
    reasoning: string;
  }>;
}> {
  const {
    goal,
    targetPersona,
    tone = 'professional',
    stepCount = 3,
    companyInfo = '',
    productService = '',
    model = 'gemini-2.0-flash-exp',
    apiKey,
  } = params;

  const client = getAIClient(apiKey);

  const prompt = `You are an expert email marketing strategist. Create a ${stepCount}-step automated email sequence.

**Goal:** ${goal}
**Target Persona:** ${targetPersona}
**Tone:** ${tone}
${companyInfo ? `**Company Info:** ${companyInfo}` : ''}
${productService ? `**Product/Service:** ${productService}` : ''}

Create a strategic email sequence that:
1. Starts with value/problem awareness (not a hard sell)
2. Builds trust and authority
3. Addresses objections
4. Includes clear calls-to-action
5. Uses personalization variables: {{companyName}}, {{contactName}}, {{email}}

For each step, provide:
- order: Step number (1, 2, 3...)
- subject: Compelling subject line
- body: Full email body (250-400 words)
- delayDays: Days to wait after previous step (0 for first step)
- delayHours: Additional hours to wait (0-23)
- condition: When to send (NO_REPLY, NO_OPEN, OPENED, CLICKED, or null for unconditional)
- reasoning: Why this step works in the sequence

Return JSON in this exact format:
{
  "name": "Descriptive sequence name",
  "description": "Brief sequence description",
  "steps": [
    {
      "order": 1,
      "subject": "Subject line",
      "body": "Email body with {{variables}}",
      "delayDays": 0,
      "delayHours": 0,
      "condition": null,
      "reasoning": "Why this step"
    }
  ]
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
 * Suggest next best tasks based on lead/deal context
 */
export async function suggestTasks(params: {
  context: {
    leadId?: string;
    dealId?: string;
    leadData?: {
      companyName: string;
      status: string;
      lastContacted?: Date;
      emailOpens?: number;
      emailClicks?: number;
      emailReplies?: number;
    };
    dealData?: {
      title: string;
      stage: string;
      value: number;
      daysInStage?: number;
      lastActivity?: Date;
    };
    sequenceEnrollments?: Array<{
      sequenceName: string;
      currentStep: number;
      lastSentAt?: Date;
    }>;
  };
  maxSuggestions?: number;
  model?: string;
  apiKey?: string;
}): Promise<{
  suggestions: Array<{
    title: string;
    type: 'CALL' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'TODO' | 'DEMO' | 'PROPOSAL';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueInDays: number;
    reasoning: string;
    description?: string;
  }>;
  insights: string;
}> {
  const {
    context,
    maxSuggestions = 3,
    model = 'gemini-2.0-flash-exp',
    apiKey,
  } = params;

  const client = getAIClient(apiKey);

  const contextStr = JSON.stringify(context, null, 2);

  const prompt = `You are a sales coaching AI. Analyze this lead/deal context and suggest the next best tasks.

**Context:**
${contextStr}

Analyze:
1. Engagement level (email opens, clicks, replies)
2. Time since last contact
3. Deal stage and duration
4. Sequence performance

Suggest up to ${maxSuggestions} specific, actionable tasks that will move this lead/deal forward.

For each task:
- title: Clear, actionable task name (e.g., "Follow up on proposal")
- type: CALL, EMAIL, MEETING, FOLLOW_UP, TODO, DEMO, or PROPOSAL
- priority: LOW, MEDIUM, HIGH, or URGENT (based on urgency and deal value)
- dueInDays: How many days from now (0 = today)
- reasoning: Why this task matters now
- description: Optional details/talking points

Also provide overall insights about this lead/deal's health.

Return JSON:
{
  "suggestions": [
    {
      "title": "Task name",
      "type": "CALL",
      "priority": "HIGH",
      "dueInDays": 1,
      "reasoning": "Why this matters",
      "description": "Additional context"
    }
  ],
  "insights": "Overall analysis of lead/deal health and recommendations"
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
 * Analyze deal and provide coaching insights
 */
export async function coachDeal(params: {
  dealData: {
    title: string;
    stage: string;
    value: number;
    probability: number;
    createdAt: Date;
    daysInCurrentStage: number;
    activities?: Array<{
      type: string;
      date: Date;
      notes?: string;
    }>;
  };
  leadData?: {
    companyName: string;
    industry?: string;
    emailEngagement?: {
      opens: number;
      clicks: number;
      replies: number;
    };
  };
  model?: string;
  apiKey?: string;
}): Promise<{
  winProbabilityAI: number;
  risks: Array<{ risk: string; severity: 'HIGH' | 'MEDIUM' | 'LOW' }>;
  recommendations: Array<{ action: string; impact: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }>;
  nextBestAction: string;
  insights: string;
}> {
  const {
    dealData,
    leadData,
    model = 'gemini-2.0-flash-exp',
    apiKey,
  } = params;

  const client = getAIClient(apiKey);

  const prompt = `You are an expert sales coach. Analyze this deal and provide strategic guidance.

**Deal Information:**
${JSON.stringify(dealData, null, 2)}

${leadData ? `**Lead Information:**
${JSON.stringify(leadData, null, 2)}` : ''}

Analyze:
1. Deal velocity (time in current stage vs. average)
2. Engagement signals (activity frequency, email engagement)
3. Stage-appropriate probability
4. Red flags or risks

Provide:
- winProbabilityAI: Your AI-calculated win probability (0-100)
- risks: Potential deal blockers or concerns
- recommendations: Specific actions to increase win rate
- nextBestAction: Single most important next step
- insights: Overall deal health analysis

Return JSON:
{
  "winProbabilityAI": 65,
  "risks": [
    { "risk": "No activity in 14 days", "severity": "HIGH" }
  ],
  "recommendations": [
    { "action": "Schedule demo", "impact": "Increases engagement", "priority": "HIGH" }
  ],
  "nextBestAction": "Send personalized case study",
  "insights": "Deal is healthy but needs momentum"
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

