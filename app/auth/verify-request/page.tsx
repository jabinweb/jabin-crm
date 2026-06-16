import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function VerifyRequest() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-none bg-blue-100 p-3">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-center">Check your email</CardTitle>
          <CardDescription className="text-center">
            A sign-in link has been sent to your email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Click the link in the email to complete your sign-in.</p>
            <p>The link will expire in 24 hours for security purposes.</p>
            <p className="text-xs text-center pt-4 border-t">
              If you didn't request this email, you can safely ignore it.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

