import { prisma } from '@/lib/prisma'
import { ensureEmployeeLeaveBalances } from '@/lib/hr/leave-service'
import { sendEmail, createEmailHTML } from '@/lib/email/nodemailer'

const DEFAULT_ITEMS = [
  { title: 'Submit ID proof', done: false },
  { title: 'Bank account details', done: false },
  { title: 'Policy acknowledgement', done: false },
  { title: 'IT asset allocation', done: false },
  { title: 'Buddy introduction', done: false },
]

export async function startOnboardingForEmployee(
  employeeId: string,
  companyId: string,
  templateId?: string
) {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
  })
  if (!emp) throw new Error('Employee not found')

  let template = templateId
    ? await prisma.onboardingTemplate.findFirst({
        where: { id: templateId, companyId },
      })
    : await prisma.onboardingTemplate.findFirst({
        where: { companyId, active: true },
      })

  if (!template) {
    template = await prisma.onboardingTemplate.create({
      data: {
        companyId,
        name: 'Default onboarding',
        items: DEFAULT_ITEMS.map((i) => ({ title: i.title })),
      },
    })
  }

  const items = Array.isArray(template.items)
    ? (template.items as { title: string }[]).map((i) => ({
        title: i.title,
        done: false,
      }))
    : DEFAULT_ITEMS

  const checklist = await prisma.onboardingChecklist.upsert({
    where: { employeeId },
    create: {
      employeeId,
      templateId: template.id,
      items,
      status: 'IN_PROGRESS',
    },
    update: { templateId: template.id, items, status: 'IN_PROGRESS' },
  })

  await ensureEmployeeLeaveBalances(employeeId, companyId)

  try {
    await sendEmail({
      to: emp.email,
      subject: `Welcome to the team, ${emp.name}`,
      html: createEmailHTML(
        `<h2>Welcome, ${emp.name}</h2>
         <p>Your onboarding checklist has started. Please complete the required items in the employee portal.</p>
         <p>Employee ID: <strong>${emp.employeeId}</strong></p>`
      ),
    })
  } catch (e) {
    console.warn('[onboarding] welcome email failed', e)
  }

  return checklist
}

export function renderLetterBody(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}
