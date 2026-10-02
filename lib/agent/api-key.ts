import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

/** Gemini key for AI-backed agent tools: the user's own key, else the platform key. */
export async function resolveAgentApiKey(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { geminiApiKey: true },
  });
  if (profile?.geminiApiKey) {
    try {
      return decrypt(profile.geminiApiKey);
    } catch {
      /* fall through */
    }
  }
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (!envKey) throw new Error('No Gemini API key. Set one in Settings → API keys.');
  return envKey;
}
