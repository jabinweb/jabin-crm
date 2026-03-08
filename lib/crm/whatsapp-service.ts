import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import type { WhatsAppChannel } from '@prisma/client';

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

  async listMessages(
    userId: string,
    filters?: {
      channel?: WhatsAppChannel;
      leadId?: string;
      customerId?: string;
      ticketId?: string;
    }
  ) {
    const where: any = { userId };
    if (filters?.channel) where.channel = filters.channel;
    if (filters?.leadId) where.leadId = filters.leadId;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.ticketId) where.ticketId = filters.ticketId;

    return prisma.whatsAppMessage.findMany({
      where,
      include: {
        lead: { select: { id: true, companyName: true, contactName: true } },
        customer: { select: { id: true, hospitalName: true, contactPerson: true } },
        ticket: { select: { id: true, subject: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async handleTwilioWebhook(formData: URLSearchParams, userId?: string) {
    const messageSid = formData.get('MessageSid');
    const messageStatus = (formData.get('MessageStatus') || '').toUpperCase();
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
    return prisma.whatsAppMessage.create({
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
      await prisma.whatsAppMessage.create({
        data: {
          userId,
          channel: 'SERVICE',
          direction: 'INBOUND',
          toPhone: msg.from || '',
          message: msg?.text?.body || '',
          status: 'SENT',
          externalMessageId: msg.id || null,
          metadata: msg,
        },
      });
    }

    return { ok: true };
  }
}

export const whatsAppService = new WhatsAppService();
