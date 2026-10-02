'use client';

import { useCallback, useState, type ClipboardEvent, type DragEvent, type RefObject } from 'react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Paste / drop images into a plain-text box (ticket replies, portal comments): each image
 * is uploaded and inserted at the cursor as `![name](url)`, which TextWithMedia renders.
 */
export function useImagePaste(opts: {
  value: string;
  onChange: (next: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  folder?: string;
}) {
  const { workspaceFetch } = useWorkspacePaths();
  const [uploading, setUploading] = useState(0);
  const { value, onChange, textareaRef, folder = 'tickets' } = opts;

  const insertImages = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return false;
      const el = textareaRef?.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      let inserted = '';
      for (const file of images) {
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(`${file.name || 'Image'} is larger than 10 MB`);
          continue;
        }
        setUploading((n) => n + 1);
        try {
          const form = new FormData();
          form.append('file', file);
          form.append('folder', folder);
          form.append('isPublic', 'true');
          const res = await workspaceFetch('/api/upload', { method: 'POST', body: form });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.url) throw new Error(data.error || 'Image upload failed');
          const name = (file.name || 'image').replace(/[[\]()]/g, '');
          inserted += `${inserted ? '\n' : ''}![${name}](${data.url})`;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Image upload failed');
        } finally {
          setUploading((n) => n - 1);
        }
      }
      if (inserted) {
        const before = value.slice(0, start);
        const after = value.slice(end);
        const lead = before && !before.endsWith('\n') ? '\n' : '';
        const trail = after && !after.startsWith('\n') ? '\n' : '';
        onChange(`${before}${lead}${inserted}${trail}${after}`);
      }
      return true;
    },
    [folder, onChange, textareaRef, value, workspaceFetch]
  );

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.some((f) => f.type.startsWith('image/'))) return;
      e.preventDefault();
      void insertImages(files);
    },
    [insertImages]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.some((f) => f.type.startsWith('image/'))) return;
      e.preventDefault();
      void insertImages(files);
    },
    [insertImages]
  );

  return { onPaste, onDrop, uploading: uploading > 0 };
}
