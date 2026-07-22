'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileIcon,
  DownloadIcon,
  TrashIcon,
  UploadIcon,
  Loader2,
  LinkIcon,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { LeadDocument } from '@/types/lead';

interface LeadDocumentsProps {
  leadId: string;
  documents?: LeadDocument[];
}

const UPLOAD_ENDPOINT = '/api/upload';

export function LeadDocuments({ leadId, documents: initialDocuments }: LeadDocumentsProps) {
  const [documents, setDocuments] = useState<LeadDocument[]>(initialDocuments ?? []);
  const [loading, setLoading] = useState(!initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlName, setUrlName] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/documents`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load documents');
      }
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const createDocument = async (payload: { name: string; type: string; url: string }) => {
    const res = await fetch(`/api/leads/${leadId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save document');
    }
    return data as LeadDocument;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', `leads/${leadId}`);

      const uploadRes = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));

      if (!uploadRes.ok) {
        // Upload endpoint missing/unavailable — fall back to URL + name prompt
        if (uploadRes.status === 404) {
          const name = window.prompt('Upload unavailable. Enter document name:', file.name);
          if (!name?.trim()) return;
          const url = window.prompt('Enter document URL:');
          if (!url?.trim()) return;
          await createDocument({
            name: name.trim(),
            type: file.type || 'application/octet-stream',
            url: url.trim(),
          });
          toast.success('Document added');
          await fetchDocuments();
          return;
        }
        throw new Error(uploadData.error || 'Upload failed');
      }

      const url = uploadData.url as string | undefined;
      if (!url) {
        throw new Error('Upload did not return a file URL');
      }

      await createDocument({
        name: file.name,
        type: file.type || uploadData.mimeType || 'application/octet-stream',
        url,
      });

      toast.success('Document uploaded');
      await fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlName.trim() || !urlValue.trim()) {
      toast.error('Name and URL are required');
      return;
    }

    setUploading(true);
    try {
      await createDocument({
        name: urlName.trim(),
        type: 'link',
        url: urlValue.trim(),
      });
      toast.success('Document added');
      setUrlName('');
      setUrlValue('');
      setShowUrlForm(false);
      await fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (doc: LeadDocument) => {
    if (!doc.url) {
      toast.error('No download URL available');
      return;
    }
    window.open(doc.url, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (doc: LeadDocument) => {
    if (!confirm(`Delete "${doc.name}"?`)) return;

    setDeletingId(doc.id);
    try {
      const res = await fetch(`/api/leads/${leadId}/documents/${doc.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete document');
      }
      toast.success('Document deleted');
      await fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>
            Documents{!loading && documents.length > 0 ? ` (${documents.length})` : ''}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={uploading}
              onClick={() => setShowUrlForm((v) => !v)}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Add URL
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UploadIcon className="h-4 w-4 mr-2" />
              )}
              Upload Document
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showUrlForm && (
          <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                placeholder="Contract.pdf"
                disabled={uploading}
              />
            </div>
            <div className="flex-[2] space-y-1">
              <label className="text-xs text-muted-foreground">URL</label>
              <Input
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://..."
                disabled={uploading}
              />
            </div>
            <Button type="submit" size="sm" disabled={uploading}>
              Save
            </Button>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !documents.length ? (
          <div className="text-center py-8 text-muted-foreground">
            No documents have been uploaded yet
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 rounded-none border"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <FileIcon className="h-8 w-8 text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Uploaded by {doc.uploadedBy?.name ?? 'Unknown'} on{' '}
                      {formatDate(doc.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => handleDownload(doc)}
                    aria-label={`Download ${doc.name}`}
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    className="text-destructive"
                    disabled={deletingId === doc.id}
                    onClick={() => handleDelete(doc)}
                    aria-label={`Delete ${doc.name}`}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TrashIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
