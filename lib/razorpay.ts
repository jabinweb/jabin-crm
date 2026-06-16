import Razorpay from 'razorpay'
import { prisma } from '@/lib/prisma'

export const getRazorpayInstance = async (companyId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true }
  })

  const settings = company?.settings as any

  if (!settings?.payroll?.razorpay?.enabled) {
    throw new Error('Razorpay is not enabled for this company')
  }

  return new Razorpay({
    key_id: settings.payroll.razorpay.keyId,
    key_secret: settings.payroll.razorpay.webhookSecret,
  })
}

// Global instance for platform-level operations
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_TEST_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_TEST_KEY_SECRET || '',
});

export interface PayrollPayment {
  employeeId: string
  amount: number
  currency: string
  description: string
  payslipId: string
  companyId: string // Ensure companyId is passed
}

export const createPayrollPayment = async (payment: PayrollPayment) => {
  try {
    const razorpay = await getRazorpayInstance(payment.companyId);
    
    const order = await razorpay.orders.create({
      amount: Math.round(payment.amount * 100), // Razorpay expects amount in paise, ensure integer
      currency: payment.currency,
      notes: {
        employeeId: payment.employeeId,
        payslipId: payment.payslipId,
        description: payment.description
      }
    })

    return order
  } catch (error) {
    console.error('Razorpay order creation failed:', error)
    throw new Error('Failed to initiate payment')
  }
}
