import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/ui/user-avatar"

interface ProfileCardProps {
  name: string
  email: string
  department: string
  jobTitle: string
  status: string
  companyName: string
  avatar?: string
}

export function ProfileCard({ name, email, department, jobTitle, status, companyName, avatar }: ProfileCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-x-4 pb-2">
        <UserAvatar person={{ name, email, image: avatar }} size="xl" />
        <div>
          <CardTitle>{name}</CardTitle>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Department</p>
            <p className="font-medium">{department}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Job Title</p>
            <p className="font-medium">{jobTitle}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium">{status}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Company</p>
            <p className="font-medium">{companyName}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
