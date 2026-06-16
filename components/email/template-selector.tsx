'use client';

import { useState, useEffect } from 'react';
import { FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  isDefault: boolean;
}

interface TemplateSelectorProps {
  onSelect: (template: { subject: string; body: string }) => void;
  leadData?: {
    contactName?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    website?: string;
    industry?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export function TemplateSelector({ onSelect, leadData }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTemplates();
      fetchCategories();
    }
  }, [open, selectedCategory]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const url = selectedCategory === 'all' 
        ? '/api/email-templates'
        : `/api/email-templates?category=${selectedCategory}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/email-templates/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleSelectTemplate = async (template: EmailTemplate) => {
    if (!leadData) {
      // No lead data, use template as-is
      onSelect({ subject: template.subject, body: template.body });
      setOpen(false);
      return;
    }

    // Apply template with lead data
    try {
      const response = await fetch('/api/email-templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          leadData,
        }),
      });

      if (!response.ok) throw new Error('Failed to apply template');

      const result = await response.json();
      onSelect({ subject: result.subject, body: result.body });
      setOpen(false);

      toast({
        title: 'Template Applied',
        description: 'Variables have been replaced with lead data',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply template',
        variant: 'destructive',
      });
    }
  };

  const getCategoryLabel = (category: string) => {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'cold-outreach': 'bg-blue-500',
      'follow-up': 'bg-green-500',
      'demo-request': 'bg-purple-500',
      'meeting-request': 'bg-orange-500',
      'proposal': 'bg-pink-500',
      'closing': 'bg-red-500',
    };
    return colors[category] || 'bg-gray-500';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Email Template</DialogTitle>
          <DialogDescription>
            Choose a template to use. Variables will be automatically filled with lead data.
          </DialogDescription>
        </DialogHeader>

        {/* Category Filter */}
        <div className="mb-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {getCategoryLabel(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates List */}
        {loading ? (
          <div className="text-center py-8">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No templates found. Create one in the Email Templates page.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:shadow-none transition-shadow"
                onClick={() => handleSelectTemplate(template)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base mb-2">{template.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge className={getCategoryColor(template.category)}>
                          {getCategoryLabel(template.category)}
                        </Badge>
                        {template.isDefault && (
                          <Badge variant="outline">Default</Badge>
                        )}
                      </div>
                    </div>
                    <Check className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Subject:</p>
                      <p className="text-sm mt-1 line-clamp-1">{template.subject}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Preview:</p>
                      <p className="text-sm mt-1 line-clamp-2 text-muted-foreground">
                        {template.body}
                      </p>
                    </div>
                    {template.variables.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Variables:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {template.variables.slice(0, 3).map((variable) => (
                            <Badge key={variable} variant="secondary" className="text-xs">
                              {`{{${variable}}}`}
                            </Badge>
                          ))}
                          {template.variables.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{template.variables.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

