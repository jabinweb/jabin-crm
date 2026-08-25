import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { logInfo, logError } from '@/lib/logger';
import { handleApiError, ApiErrors } from '@/lib/api-error-handler';

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function asStringOrEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function isMaskedSecret(value: unknown): boolean {
  return typeof value === 'string' && (value.includes('•') || value === '••••••••');
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      throw ApiErrors.unauthorized();
    }

    logInfo('Fetching user profile', { userId: session.user.id });

    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({
        companyName: '',
        industry: '',
        companySize: '',
        website: '',
        description: '',
        service: '',
        targetAudience: '',
        valueProposition: '',
        companyEmail: '',
        smtpHost: '',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: '',
        smtpFrom: '',
        imapHost: '',
        imapPort: 993,
        imapSecure: true,
        imapUser: '',
        aiModel: 'gemini-2.0-flash',
        preferredCurrency: 'USD',
        companyAddress: '',
        companyPhone: '',
        taxId: '',
        invoicePrefix: 'INV',
        quotationPrefix: 'QT',
        invoiceTerms: 'Payment is due within 30 days',
        quotationTerms: 'This quotation is valid for 30 days from the date of issue',
        bankName: '',
        accountName: '',
        accountNumber: '',
        routingNumber: '',
        swiftCode: '',
        iban: '',
        paymentInstructions: '',
        templateStyle: 'modern',
        primaryColor: '#2563eb',
        secondaryColor: '#7c3aed',
        logoUrl: '',
        headerText: '',
        footerText: '',
        isComplete: false,
      });
    }

    const { smtpPassword, imapPassword, geminiApiKey, googlePlacesApiKey, ...profileData } =
      profile;
    return NextResponse.json({
      ...profileData,
      hasSmtpPassword: !!smtpPassword,
      hasImapPassword: !!imapPassword,
      geminiApiKey: geminiApiKey ? '••••••••' : '',
      googlePlacesApiKey: googlePlacesApiKey ? '••••••••' : '',
    });
  } catch (error) {
    return handleApiError(error, { endpoint: 'GET /api/profile' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      throw ApiErrors.unauthorized();
    }

    const data = await request.json();
    const {
      companyName,
      industry,
      companySize,
      website,
      description,
      service,
      targetAudience,
      valueProposition,
      companyEmail,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      smtpFrom,
      imapHost,
      imapPort,
      imapSecure,
      imapUser,
      imapPassword,
      geminiApiKey,
      googlePlacesApiKey,
      aiModel,
      preferredCurrency,
      companyAddress,
      companyPhone,
      taxId,
      invoicePrefix,
      quotationPrefix,
      invoiceTerms,
      quotationTerms,
      bankName,
      accountName,
      accountNumber,
      routingNumber,
      swiftCode,
      iban,
      paymentInstructions,
      templateStyle,
      primaryColor,
      secondaryColor,
      logoUrl,
      headerText,
      footerText,
    } = data;

    logInfo('Updating user profile', { userId: session.user.id });

    let encryptedSmtpPassword: string | undefined;
    if (smtpPassword && !isMaskedSecret(smtpPassword)) {
      encryptedSmtpPassword = JSON.stringify(encrypt(smtpPassword));
      logInfo('SMTP password encrypted', { userId: session.user.id });
    }

    let encryptedImapPassword: string | undefined;
    if (imapPassword && !isMaskedSecret(imapPassword)) {
      encryptedImapPassword = JSON.stringify(encrypt(imapPassword));
      logInfo('IMAP password encrypted', { userId: session.user.id });
    }

    let encryptedGeminiApiKey: string | undefined;
    if (geminiApiKey && !isMaskedSecret(geminiApiKey)) {
      encryptedGeminiApiKey = JSON.stringify(encrypt(geminiApiKey));
      logInfo('Gemini API key encrypted', { userId: session.user.id });
    }

    let encryptedGooglePlacesApiKey: string | undefined;
    if (googlePlacesApiKey && !isMaskedSecret(googlePlacesApiKey)) {
      encryptedGooglePlacesApiKey = JSON.stringify(encrypt(googlePlacesApiKey));
      logInfo('Google Places API key encrypted', { userId: session.user.id });
    }

    const isComplete = !!(companyName && industry && service && valueProposition);

    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        smtpPassword: true,
        imapPassword: true,
        geminiApiKey: true,
        googlePlacesApiKey: true,
      },
    });

    const sharedFields = {
      companyName: asStringOrEmpty(companyName),
      industry: asStringOrEmpty(industry),
      companySize: asStringOrEmpty(companySize),
      website: asStringOrEmpty(website),
      description: asStringOrEmpty(description),
      service: asStringOrEmpty(service),
      targetAudience: asStringOrEmpty(targetAudience),
      valueProposition: asStringOrEmpty(valueProposition),
      companyEmail: asStringOrEmpty(companyEmail),
      smtpHost: asStringOrEmpty(smtpHost),
      smtpPort: parseInt(String(smtpPort), 10) || 587,
      smtpSecure: smtpSecure === 'true' || smtpSecure === true,
      smtpUser: asStringOrEmpty(smtpUser),
      smtpFrom: asStringOrEmpty(smtpFrom),
      imapHost: asStringOrEmpty(imapHost),
      imapPort: parseInt(String(imapPort), 10) || 993,
      imapSecure: imapSecure === 'true' || imapSecure === true || imapSecure === undefined,
      imapUser: asStringOrEmpty(imapUser),
      aiModel: asOptionalString(aiModel) || 'gemini-2.0-flash',
      preferredCurrency: asOptionalString(preferredCurrency) || 'USD',
      companyAddress: asStringOrEmpty(companyAddress),
      companyPhone: asStringOrEmpty(companyPhone),
      taxId: asStringOrEmpty(taxId),
      invoicePrefix: asOptionalString(invoicePrefix) || 'INV',
      quotationPrefix: asOptionalString(quotationPrefix) || 'QT',
      invoiceTerms: asStringOrEmpty(invoiceTerms),
      quotationTerms: asStringOrEmpty(quotationTerms),
      bankName: asStringOrEmpty(bankName),
      accountName: asStringOrEmpty(accountName),
      accountNumber: asStringOrEmpty(accountNumber),
      routingNumber: asStringOrEmpty(routingNumber),
      swiftCode: asStringOrEmpty(swiftCode),
      iban: asStringOrEmpty(iban),
      paymentInstructions: asStringOrEmpty(paymentInstructions),
      templateStyle: asOptionalString(templateStyle) || 'modern',
      primaryColor: asOptionalString(primaryColor) || '#2563eb',
      secondaryColor: asOptionalString(secondaryColor) || '#7c3aed',
      logoUrl: asStringOrEmpty(logoUrl),
      headerText: asStringOrEmpty(headerText),
      footerText: asStringOrEmpty(footerText),
      isComplete,
    };

    const profile = await prisma.userProfile.upsert({
      where: { userId: session.user.id },
      update: {
        ...sharedFields,
        smtpPassword: encryptedSmtpPassword || existingProfile?.smtpPassword,
        imapPassword: encryptedImapPassword || existingProfile?.imapPassword,
        geminiApiKey: encryptedGeminiApiKey || existingProfile?.geminiApiKey,
        googlePlacesApiKey:
          encryptedGooglePlacesApiKey || existingProfile?.googlePlacesApiKey,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        ...sharedFields,
        smtpPassword: encryptedSmtpPassword,
        imapPassword: encryptedImapPassword,
        geminiApiKey: encryptedGeminiApiKey,
        googlePlacesApiKey: encryptedGooglePlacesApiKey,
      },
    });

    logInfo('Profile updated successfully', {
      userId: session.user.id,
      isComplete: profile.isComplete,
    });

    return NextResponse.json(profile);
  } catch (error) {
    logError(error, { endpoint: 'POST /api/profile' });
    return handleApiError(error, {
      endpoint: 'POST /api/profile',
      userId: (await auth())?.user?.id,
    });
  }
}
