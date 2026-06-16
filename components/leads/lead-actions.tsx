import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Lead, LeadStatus } from '@/types/company-manager/lead'
import { 
  MoreHorizontal, 
  PhoneCall, 
  Mail, 
  Calendar, 
  Edit, 
  UserPlus, 
  CheckCircle, 
  XCircle,
  Clock
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'

interface LeadActionsProps {
  lead: Lead
}

export function LeadActions({ lead }: LeadActionsProps) {
  const router = useRouter()
  const params = useParams<{ company?: string }>()
  const { toast } = useToast()
  const tenantHeaders =
    typeof params?.company === 'string' ? workspaceSlugHeaders(params.company) : {}

  const leadDetailPath = params.company
    ? `/${params.company}/dashboard/leads/${lead.id}`
    : `/dashboard/leads/${lead.id}`

  const handleStatusChange = async (status: LeadStatus) => {
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({ status })
      })

      if (!response.ok) throw new Error('Failed to update status')

      toast({
        title: 'Success',
        description: `Lead marked as ${status.toLowerCase()}`
      })

      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update lead status',
        variant: 'destructive'
      })
    }
  }

  const handleConvertToClient = async () => {
    try {
      const response = await fetch(`/api/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: { ...tenantHeaders },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to convert lead')
      }

      toast({
        title: 'Success',
        description: 'Lead converted to customer account'
      })

      const customerId = data.customerId ?? data.customer?.id
      if (customerId) {
        router.push(`/dashboard/customers/${customerId}`)
      } else {
        router.push('/dashboard/customers')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to convert lead',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="flex items-center gap-2">
      {lead.phone && (
        <Button size="sm" variant="outline" asChild>
          <a href={`tel:${lead.phone}`}>
            <PhoneCall className="h-4 w-4 mr-2" />
            Call
          </a>
        </Button>
      )}
      {lead.email && (
        <Button size="sm" variant="outline" asChild>
          <a href={`mailto:${lead.email}`}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </a>
        </Button>
      )}
      <Button size="sm" variant="outline" disabled title="Calendar integration coming soon">
        <Calendar className="h-4 w-4 mr-2" />
        Schedule
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(leadDetailPath)}>
            <Edit className="h-4 w-4 mr-2" />
            View / Edit Lead
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onSelect={() => handleStatusChange(LeadStatus.QUALIFIED)}>
            <Clock className="h-4 w-4 mr-2" />
            Mark as Qualified
          </DropdownMenuItem>
          
          <DropdownMenuItem onSelect={() => handleStatusChange(LeadStatus.WON)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark as Won
          </DropdownMenuItem>
          
          <DropdownMenuItem onSelect={() => handleStatusChange(LeadStatus.LOST)}>
            <XCircle className="h-4 w-4 mr-2" />
            Mark as Lost
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onSelect={handleConvertToClient} disabled={lead.status === LeadStatus.CONVERTED}>
            <UserPlus className="h-4 w-4 mr-2" />
            Convert to Customer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
