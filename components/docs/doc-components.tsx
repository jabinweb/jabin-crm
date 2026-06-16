// Reusable documentation UI components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  Settings,
  Users,
  Mail,
  Zap,
  TrendingUp,
  Calendar,
  BarChart3,
  Target,
} from 'lucide-react';

const iconMap: Record<string, any> = {
  Settings,
  Users,
  Mail,
  Zap,
  TrendingUp,
  Calendar,
  BarChart3,
  Target,
  CheckCircle2,
  AlertCircle,
  Info,
};

const colorMap: Record<string, string> = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  purple: 'text-purple-500',
  orange: 'text-orange-500',
  red: 'text-red-500',
};

export function DocSteps({ steps }: { steps: any[] }) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const Icon = step.icon ? iconMap[step.icon] : null;
        return (
          <div key={index} className="flex gap-4 rounded-none border p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground font-semibold">
              {step.number}
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-5 w-5" />}
                <h4 className="font-medium">{step.title}</h4>
              </div>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DocList({ data }: { data: any }) {
  const variant = data.variant || 'default';
  const icon = variant === 'success' ? CheckCircle2 : variant === 'danger' ? AlertCircle : CheckCircle2;
  const iconColor = variant === 'success' ? 'text-green-500' : variant === 'danger' ? 'text-red-500' : 'text-blue-500';
  
  const Icon = icon;

  return (
    <div className="space-y-3">
      {data.title && <h4 className="font-semibold">{data.title}</h4>}
      <ul className="space-y-2">
        {data.items.map((item: string, index: number) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocGrid({ data }: { data: any[] }) {
  return (
    <div className="grid gap-3">
      {data.map((item, index) => {
        const Icon = item.icon ? iconMap[item.icon] : Info;
        const color = item.color ? colorMap[item.color] : 'text-blue-500';
        
        return (
          <div key={index} className="flex gap-3 rounded-none border p-3">
            <div className="shrink-0 mt-0.5">
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium">{item.title}</h4>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DocTable({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      {data.title && <h4 className="font-semibold">{data.title}</h4>}
      <div className="rounded-none border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {data.headers.map((header: string, index: number) => (
                <th key={index} className="px-4 py-2 text-left font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row: string[], rowIndex: number) => (
              <tr key={rowIndex} className="border-t">
                {row.map((cell: string, cellIndex: number) => (
                  <td key={cellIndex} className="px-4 py-2">
                    {cellIndex === 0 && data.headers[0] === 'Method' ? (
                      <Badge variant={cell === 'GET' ? 'outline' : 'default'}>
                        {cell}
                      </Badge>
                    ) : cellIndex === 1 && data.headers[1] === 'Endpoint' ? (
                      <code className="text-xs font-mono">{cell}</code>
                    ) : (
                      <span className="text-muted-foreground">{cell}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DocAlert({ data }: { data: any }) {
  const variantMap: Record<string, 'default' | 'destructive'> = {
    info: 'default',
    success: 'default',
    danger: 'destructive',
  };

  const iconMap: Record<string, any> = {
    info: Info,
    success: CheckCircle2,
    danger: AlertCircle,
  };

  const Icon = iconMap[data.variant] || Info;

  return (
    <Alert variant={variantMap[data.variant] || 'default'}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{data.title}</AlertTitle>
      <AlertDescription>{data.message}</AlertDescription>
    </Alert>
  );
}

export function DocText({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

export function DocSection({ section }: { section: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
        {section.description && <CardDescription>{section.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {section.content.map((content: any, index: number) => {
          switch (content.type) {
            case 'steps':
              return <DocSteps key={index} steps={content.data} />;
            case 'list':
              return <DocList key={index} data={content.data} />;
            case 'grid':
              return <DocGrid key={index} data={content.data} />;
            case 'table':
              return <DocTable key={index} data={content.data} />;
            case 'alert':
              return <DocAlert key={index} data={content.data} />;
            case 'text':
              return <DocText key={index} text={content.data} />;
            default:
              return null;
          }
        })}
      </CardContent>
    </Card>
  );
}

