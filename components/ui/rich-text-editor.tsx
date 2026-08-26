'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  ImageIcon,
  Undo2,
  Redo2,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type Props = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
  folder?: string;
  editable?: boolean;
  onUploaded?: (file: {
    url: string;
    name: string;
    mimeType?: string;
    size?: number;
    fileId?: string;
  }) => void;
};

async function fileToFormData(file: File, folder: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('folder', folder);
  form.append('isPublic', 'true');
  return form;
}

const ICON = 'h-4 w-4 shrink-0';

function ToolbarBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!!active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
        'text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-muted text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Write something…',
  className,
  minHeightClass = 'min-h-[140px]',
  folder = 'project-tasks',
  editable = true,
  onUploaded,
}: Props) {
  const { workspaceFetch } = useWorkspacePaths();
  const uploadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (uploadingRef.current) return null;
      uploadingRef.current = true;
      try {
        const res = await workspaceFetch('/api/upload', {
          method: 'POST',
          body: await fileToFormData(file, folder),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Upload failed');
        }
        const data = await res.json();
        const payload = {
          url: data.url as string,
          name: (data.filename || file.name) as string,
          mimeType: (data.mimeType || file.type) as string | undefined,
          size: (data.size || file.size) as number | undefined,
          fileId: data.fileId as string | undefined,
        };
        onUploaded?.(payload);
        return payload;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload failed');
        return null;
      } finally {
        uploadingRef.current = false;
      }
    },
    [folder, onUploaded, workspaceFetch]
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline underline-offset-2' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full h-auto rounded-md my-2' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          'rich-text-editor-body focus:outline-none px-3 py-2.5 text-sm leading-relaxed',
          minHeightClass
        ),
      },
      handlePaste: (_view, event) => {
        const ed = editorRef.current;
        const items = event.clipboardData?.items;
        if (!items || !ed) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return true;
            void uploadFile(file).then((uploaded) => {
              if (uploaded) {
                ed.chain()
                  .focus()
                  .setImage({ src: uploaded.url, alt: uploaded.name })
                  .run();
              }
            });
            return true;
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const ed = editorRef.current;
        const files = event.dataTransfer?.files;
        if (!files?.length || !ed) return false;
        const file = files[0];
        if (!file.type.startsWith('image/') && !file.type) return false;
        event.preventDefault();
        void uploadFile(file).then((uploaded) => {
          if (!uploaded) return;
          if (file.type.startsWith('image/')) {
            ed.chain()
              .focus()
              .setImage({ src: uploaded.url, alt: uploaded.name })
              .run();
          } else {
            ed.chain()
              .focus()
              .insertContent(
                `<a href="${uploaded.url}" target="_blank" rel="noopener noreferrer">${uploaded.name}</a>`
              )
              .run();
          }
        });
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== current) {
      editor.commands.setContent(content || '', false);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return (
      <div
        className={cn('overflow-hidden rounded-md border bg-background', className)}
      >
        {editable ? (
          <div className="flex h-10 items-center gap-1 border-b bg-muted/40 px-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-md" />
            ))}
          </div>
        ) : null}
        <Skeleton className={cn('w-full rounded-none', minHeightClass)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rich-text-editor overflow-hidden rounded-md border bg-background',
        className
      )}
    >
      {editable ? (
        <div className="flex h-10 items-center gap-0.5 overflow-x-auto border-b bg-muted/40 px-1.5">
          <ToolbarBtn
            title="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className={ICON} strokeWidth={2} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className={ICON} strokeWidth={2} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className={ICON} strokeWidth={2} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Numbered list"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className={ICON} strokeWidth={2} />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn
            title="Link"
            active={editor.isActive('link')}
            onClick={() => {
              const prev = editor.getAttributes('link').href as string | undefined;
              const url = window.prompt('Link URL', prev || 'https://');
              if (url === null) return;
              if (url === '') {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                return;
              }
              editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: url })
                .run();
            }}
          >
            <LinkIcon className={ICON} strokeWidth={2} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Insert image"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className={ICON} strokeWidth={2} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className={ICON} strokeWidth={2} />
          </ToolbarBtn>

          <ToolbarDivider />

          <ToolbarBtn
            title="Undo"
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className={ICON} strokeWidth={2} />
          </ToolbarBtn>
          <ToolbarBtn
            title="Redo"
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 className={ICON} strokeWidth={2} />
          </ToolbarBtn>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              void uploadFile(file).then((uploaded) => {
                if (!uploaded) return;
                if (file.type.startsWith('image/')) {
                  editor
                    .chain()
                    .focus()
                    .setImage({ src: uploaded.url, alt: uploaded.name })
                    .run();
                } else {
                  editor
                    .chain()
                    .focus()
                    .insertContent(
                      `<p><a href="${uploaded.url}" target="_blank" rel="noopener noreferrer">${uploaded.name}</a></p>`
                    )
                    .run();
                }
              });
            }}
          />
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
