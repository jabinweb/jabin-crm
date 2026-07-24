import Razorpay from 'razorpay'
import { prisma } from '@/lib/prisma'

type RazorpayCreds = {
  enabled: boolean
  keyId: string
  keySecret: string
}

/**
 * Resolve company Razorpay credentials.
 * Prefer Settings → Payment (`integrations.razorpay`), fall back to legacy `payroll.razorpay`.
 */
export function resolveCompanyRazorpaySettings(settings: unknown): RazorpayCreds | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null
  const root = settings as Record<string, unknown>

  const integrations = root.integrations
  if (integrations && typeof integrations === 'object' && !Array.isArray(integrations)) {
    const rz = (integrations as Record<string, unknown>).razorpay
    if (rz && typeof rz === 'object' && !Array.isArray(rz)) {
      const cfg = rz as Record<string, unknown>
      if (cfg.enabled === true) {
        const mode = cfg.mode === 'live' ? 'live' : 'test'
        const credentials = cfg.credentials as Record<string, Record<string, string>> | undefined
        const modeCreds = credentials?.[mode]
        const keyId = modeCreds?.keyId || (cfg.keyId as string | undefined)
        const keySecret = modeCreds?.keySecret || (cfg.keySecret as string | undefined)
        if (keyId && keySecret) {
          return { enabled: true, keyId, keySecret }
        }
      }
    }
  }

  const payroll = root.payroll
  if (payroll && typeof payroll === 'object' && !Array.isArray(payroll)) {
    const rz = (payroll as Record<string, unknown>).razorpay
    if (rz && typeof rz === 'object' && !Array.isArray(rz)) {
      const cfg = rz as Record<string, unknown>
      if (cfg.enabled === true && typeof cfg.keyId === 'string' && typeof cfg.keySecret === 'string') {
        return { enabled: true, keyId: cfg.keyId, keySecret: cfg.keySecret }
      }
      // Legacy bug: some installs stored secret under webhookSecret
      if (
        cfg.enabled === true &&
        typeof cfg.keyId === 'string' &&
        typeof cfg.webhookSecret === 'string'
      ) {
        return { enabled: true, keyId: cfg.keyId, keySecret: cfg.webhookSecret }
      }
    }
  }

  return null
}

export const getRazorpayInstance = async (companyId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  })

  const creds = resolveCompanyRazorpaySettings(company?.settings)
  if (!creds) {
    throw new Error('Razorpay is not enabled for this company')
  }

  return new Razorpay({
    key_id: creds.keyId,
    key_secret: creds.keySecret,
  })
}

// Global instance for platform-level operations (SaaS subscription)
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_TEST_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_TEST_KEY_SECRET || '',
})

export interface PayrollPayment {
  employeeId: string
  amount: number
  currency: string
  description: string
  payslipId: string
  companyId: string
}

export const createPayrollPayment = async (payment: PayrollPayment) => {
  try {
    const instance = await getRazorpayInstance(payment.companyId)

    const order = await instance.orders.create({
      amount: Math.round(payment.amount * 100),
      currency: payment.currency,
      notes: {
        employeeId: payment.employeeId,
        payslipId: payment.payslipId,
        description: payment.description,
      },
    })

    return order
  } catch (error) {
    console.error('Razorpay order creation failed:', error)
    throw new Error('Failed to initiate payment')
  }
}
