import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import type { WhatsAppChannel } from '@prisma/client';
import { fetchSummoraBridge, getSummoraCreds } from '@/lib/crm/summora-bridge';
import {
  extractWhatsAppChatJid,
  isWhatsAppGroupJid,
  messageMatchesInboxFilter,
  normalizeWhatsAppChatJid,
} from '@/lib/crm/whatsapp-chat';

interface SendWhatsAppInput {
  userId: string;
  toPhone: string;
  message: string;
  channel: WhatsAppChannel;
  leadId?: string;
  customerId?: string;
  ticketId?: string;
}

function normalizeWhatsAppNumber(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('whatsapp:')) return trimmed;
  return `whatsapp:${trimmed}`;
}

function normalizeE164(phone: string): string {
  return phone.replace(/^whatsapp:/, '').replace(/\s+/g, '');
}

export class WhatsAppService {
  private async getProviderConfig(userId: string) {
    return prisma.whatsAppProviderConfig.findUnique({
      where: { userId },
    });
  }

  async sendMessage(input: SendWhatsAppInput) {
    const config = await this.getProviderConfig(input.userId);
    const toPhone = normalizeWhatsAppNumber(input.toPhone);

    const messageLog = await prisma.whatsAppMessage.create({
      data: {
        userId: input.userId,
        leadId: input.leadId,
        customerId: input.customerId,
        ticketId: input.ticketId,
        channel: input.channel,
        direction: 'OUTBOUND',
        toPhone,
        message: input.message,
        status: 'QUEUED',
      },
    });

    if (!config || !config.isActive || config.provider === 'DISABLED') {
      return prisma.whatsAppMessage.update({
        where: { id: messageLog.id },
        data: {
          status: 'FAILED',
          errorMessage: 'WhatsApp provider is not configured for this account',
        },
      });
    }

    if (config.provider === 'TWILIO') {
      return this.sendViaTwilio(messageLog.id, input, config);
    }

    if (config.provider === 'META_CLOUD') {
      return this.sendViaMetaCloud(messageLog.id, input, config);
    }

    if (config.provider === 'SUMMORA') {
      return this.sendViaSummora(messageLog.id, input, config);
    }

    return prisma.whatsAppMessage.update({
      where: { id: messageLog.id },
      data: {
        status: 'FAILED',
        errorMessage: `Unsupported provider: ${config.provider}`,
      },
    });
  }

  private async sendViaTwilio(messageId: string, input: SendWhatsAppInput, config: any) {
    const accountSid = config.twilioAccountSid;
    const authToken = config.twilioAuthToken ? decrypt(config.twilioAuthToken) : '';
    const fromPhone = config.twilioFromNumber;

    if (!accountSid || !authToken || !fromPhone) {
      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMessage: 'Twilio credentials are incomplete',
        },
      });
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const payload = new URLSearchParams();
    payload.append('To', normalizeWhatsAppNumber(input.toPhone));
    payload.append('From', normalizeWhatsAppNumber(fromPhone));
    payload.append('Body', input.message);
    if (process.env.NEXT_PUBLIC_APP_URL) {
      payload.append(
        'StatusCallback',
        `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook?userId=${encodeURIComponent(input.userId)}&provider=TWILIO`
      );
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      });
      const result = await res.json();

      if (!res.ok) {
        return prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'FAILED',
            errorMessage: result?.message || 'Failed to send WhatsApp via Twilio',
            metadata: result,
          },
        });
      }

      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          fromPhone: normalizeWhatsAppNumber(fromPhone),
          status: 'SENT',
          sentAt: new Date(),
          externalMessageId: result?.sid || null,
          metadata: result,
        },
      });
    } catch (error: any) {
      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMessage: error?.message || 'Unknown Twilio send error',
        },
      });
    }
  }

  private async sendViaMetaCloud(messageId: string, input: SendWhatsAppInput, config: any) {
    const token = config.metaAccessToken ? decrypt(config.metaAccessToken) : '';
    const phoneNumberId = config.metaPhoneNumberId;
    const apiVersion = config.metaApiVersion || 'v22.0';

    if (!token || !phoneNumberId) {
      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMessage: 'Meta Cloud API credentials are incomplete',
        },
      });
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: normalizeE164(input.toPhone),
      type: 'text',
      text: { body: input.message },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok) {
        return prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'FAILED',
            errorMessage: result?.error?.message || 'Failed to send WhatsApp via Meta',
            metadata: result,
          },
        });
      }

      const externalMessageId = result?.messages?.[0]?.id || null;
      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          externalMessageId,
          metadata: result,
        },
      });
    } catch (error: any) {
      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMessage: error?.message || 'Unknown Meta Cloud send error',
        },
      });
    }
  }

  private async sendViaSummora(messageId: string, input: SendWhatsAppInput, config: any) {
    const baseUrl = String(config.summoraBaseUrl || '').replace(/\/$/, '');
    const apiKey = config.summoraApiKey ? decrypt(config.summoraApiKey) : '';

    if (!baseUrl || !apiKey) {
      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMessage: 'Summora bridge URL or API key is incomplete',
        },
      });
    }

    try {
      const res = await fetch(`${baseUrl}/api/v1/bridge/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: normalizeE164(input.toPhone),
          message: input.message,
        }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        return prisma.whatsAppMessage.update({
          where: { id: messageId },
          data: {
            status: 'FAILED',
            errorMessage: result?.error || `Summora send failed (${res.status})`,
            metadata: result,
          },
        });
      }

      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          externalMessageId: result?.id || null,
          metadata: result,
        },
      });
    } catch (error: any) {
      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMessage: error?.message || 'Unknown Summora send error',
        },
      });
    }
  }

  async listMessages(
    userId: string,
    filters?: {
      channel?: WhatsAppChannel;
      leadId?: string;
      customerId?: string;
      ticketId?: string;
      /** When true (default), hide chats outside the Summora inbox filter. */
      respectInboxFilter?: boolean;
    }
  ) {
    const where: any = { userId };
    if (filters?.channel) where.channel = filters.channel;
    if (filters?.leadId) where.leadId = filters.leadId;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.ticketId) where.ticketId = filters.ticketId;

    const rows = await prisma.whatsAppMessage.findMany({
      where,
      include: {
        lead: { select: { id: true, companyName: true, contactName: true } },
        customer: { select: { id: true, organizationName: true, contactPerson: true } },
        ticket: { select: { id: true, subject: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });

    const respect = filters?.respectInboxFilter !== false;
    let filterType = 'ALL';
    let allowedJids: string[] = [];

    if (respect) {
      const creds = await getSummoraCreds(userId);
      if (!('error' in creds)) {
        const result = await fetchSummoraBridge(creds, '/api/v1/bridge/filters', {
          timeoutMs: 8_000,
        });
        if (result.ok) {
          filterType = String(result.body.filterType || 'ALL').toUpperCase();
          allowedJids = Array.isArray(result.body.allowedJids)
            ? (result.body.allowedJids as string[])
            : [];
        }
      }
    }

    const enriched = rows
      .map((msg) => {
        const chatJid = extractWhatsAppChatJid(msg);
        const meta = (msg.metadata || {}) as Record<string, unknown>;
        const data = (meta.data || {}) as Record<string, unknown>;
        const senderName = String(
          meta.senderName ||
            meta.pushName ||
            data.sender ||
            data.pushName ||
            ''
        ).trim();
        return {
          ...msg,
          chatJid,
          isGroup: isWhatsAppGroupJid(chatJid),
          senderName: senderName || null,
        };
      })
      .filter((msg) =>
        respect
          ? messageMatchesInboxFilter(msg.chatJid, filterType, allowedJids)
          : true
      )
      .slice(0, 200);

    return {
      messages: enriched,
      inboxFilter: { filterType, allowedJids },
    };
  }

  async handleTwilioWebhook(formData: URLSearchParams, userId?: string) {
    const messageSid = formData.get('MessageSid');
    const messageStatus = (formData.get('EmployeeMessageStatus') || '').toUpperCase();
    const from = formData.get('From') || '';
    const to = formData.get('To') || '';
    const body = formData.get('Body') || '';

    const mappedStatus =
      messageStatus === 'DELIVERED'
        ? 'DELIVERED'
        : messageStatus === 'READ'
          ? 'READ'
          : messageStatus === 'FAILED'
            ? 'FAILED'
            : 'SENT';

    if (messageSid) {
      const existing = await prisma.whatsAppMessage.findFirst({
        where: { externalMessageId: messageSid },
      });

      if (existing) {
        return prisma.whatsAppMessage.update({
          where: { id: existing.id },
          data: {
            status: mappedStatus as any,
            deliveredAt: mappedStatus === 'DELIVERED' ? new Date() : existing.deliveredAt,
            readAt: mappedStatus === 'READ' ? new Date() : existing.readAt,
          },
        });
      }
    }

    if (!userId) return null;
    const created = await prisma.whatsAppMessage.create({
      data: {
        userId,
        channel: 'SERVICE',
        direction: 'INBOUND',
        toPhone: to,
        fromPhone: from,
        message: body,
        status: 'SENT',
        externalMessageId: messageSid || null,
      },
    });

    if (body.trim()) {
      const { ensureWhatsAppTicket } = await import('@/lib/support/whatsapp-ticket');
      ensureWhatsAppTicket({
        userId,
        fromPhone: from,
        message: body,
        messageLogId: created.id,
      }).catch((err) => console.error('[whatsapp-ticket]', err));
    }

    return created;
  }

  async handleMetaWebhook(payload: any, userId?: string) {
    const statuses = payload?.entry?.[0]?.changes?.[0]?.value?.statuses || [];
    const messages = payload?.entry?.[0]?.changes?.[0]?.value?.messages || [];

    for (const status of statuses) {
      if (!status?.id) continue;
      const mapped =
        status.status === 'delivered'
          ? 'DELIVERED'
          : status.status === 'read'
            ? 'READ'
            : status.status === 'failed'
              ? 'FAILED'
              : 'SENT';

      const existing = await prisma.whatsAppMessage.findFirst({
        where: { externalMessageId: status.id },
      });
      if (existing) {
        await prisma.whatsAppMessage.update({
          where: { id: existing.id },
          data: {
            status: mapped as any,
            deliveredAt: mapped === 'DELIVERED' ? new Date() : existing.deliveredAt,
            readAt: mapped === 'READ' ? new Date() : existing.readAt,
            metadata: status,
          },
        });
      }
    }

    if (!userId) return null;
    for (const msg of messages) {
      if (msg?.type !== 'text') continue;
      const created = await prisma.whatsAppMessage.create({
        data: {
          userId,
          channel: 'SERVICE',
          direction: 'INBOUND',
          toPhone: msg.from || '',
          fromPhone: msg.from || '',
          message: msg?.text?.body || '',
          status: 'SENT',
          externalMessageId: msg.id || null,
          metadata: msg,
        },
      });
      const body = msg?.text?.body || '';
      if (body.trim()) {
        const { ensureWhatsAppTicket } = await import('@/lib/support/whatsapp-ticket');
        ensureWhatsAppTicket({
          userId,
          fromPhone: msg.from || '',
          message: body,
          messageLogId: created.id,
        }).catch((err) => console.error('[whatsapp-ticket]', err));
      }
    }

    return { ok: true };
  }

  /**
   * Summora bridge webhook: message.created / sync.completed / connection.updated
   * Header X-Summora-Signature = HMAC-SHA256(body, webhookVerifyToken)
   */
  async handleSummoraWebhook(
    payload: any,
    headers: { signature?: string | null; rawBody?: string },
    userId?: string
  ) {
    const createHmac = (await import('crypto')).createHmac;

    if (userId && headers.signature) {
      const config = await this.getProviderConfig(userId);
      const secret = config?.webhookVerifyToken
        ? decrypt(config.webhookVerifyToken)
        : null;
      if (secret) {
        const body = headers.rawBody ?? JSON.stringify(payload);
        const expected = createHmac('sha256', secret).update(body).digest('hex');
        if (expected !== headers.signature) {
          throw new Error('Invalid Summora webhook signature');
        }
      }
    }

    const type = payload?.type as string | undefined;
    const data = payload?.data || {};

    if (type === 'message.created' && userId && !data.fromMe) {
      const externalId = data.externalId || data.id || null;
      if (externalId) {
        const existing = await prisma.whatsAppMessage.findFirst({
          where: { externalMessageId: String(externalId) },
        });
        if (existing) return existing;
      }

      const chatJid = normalizeWhatsAppChatJid(
        String(data.remoteJid || data.sender || '')
      );
      // Store DM as bare number; keep full group JID (@g.us)
      const fromPhone = chatJid.replace(/@s\.whatsapp\.net$/, '');
      const senderName = String(
        data.sender || data.pushName || data.participant || ''
      ).trim();
      const body = String(data.content || '');
      const created = await prisma.whatsAppMessage.create({
        data: {
          userId,
          channel: 'SERVICE',
          direction: 'INBOUND',
          toPhone: fromPhone,
          fromPhone,
          message: body,
          status: 'SENT',
          externalMessageId: externalId ? String(externalId) : null,
          metadata: {
            ...payload,
            remoteJid: chatJid,
            isGroup: isWhatsAppGroupJid(chatJid),
            participant: data.participant || null,
            senderName: senderName || null,
            pushName: data.pushName || data.sender || null,
          },
        },
      });

      // Support tickets are for 1:1 DMs only — skip group noise
      if (body.trim() && !isWhatsAppGroupJid(chatJid)) {
        const { ensureWhatsAppTicket } = await import('@/lib/support/whatsapp-ticket');
        ensureWhatsAppTicket({
          userId,
          fromPhone,
          message: body,
          messageLogId: created.id,
        }).catch((err) => console.error('[whatsapp-ticket]', err));
      }
      return created;
    }

    // sync.completed / connection.updated — acknowledge; apps can poll if needed
    return { ok: true, type };
  }
}

export const whatsAppService = new WhatsAppService();

