'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, Node, mergeAttributes } from '@tiptap/react';
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
  Heading2,
  Heading3,
  Quote,
  Code2,
  AtSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export type MentionUser = {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  /** Project team members are listed first */
  onProject?: boolean;
};

type Props = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
  folder?: string;
  editable?: boolean;
  /** Enables @mentions: typing "@" opens a people picker over this list. */
  mentionUsers?: MentionUser[];
  /** Adds heading / quote / code-block controls (long-form docs). */
  blockFormatting?: boolean;
  /** Extra controls rendered at the end of the toolbar. */
  toolbarEnd?: ReactNode;
  /** Drop the outer border — for full-page editors. */
  borderless?: boolean;
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

/**
 * Inline @mention chip. Serializes to
 * `<span class="mention" data-mention-id="…">@Name</span>` — the server reads
 * `data-mention-id` to notify people (see lib/projects/mentions.ts).
 */
const MentionNode = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-mention-id'),
        renderHTML: (attributes) => ({ 'data-mention-id': attributes.id }),
      },
      label: {
        default: '',
        parseHTML: (element) => (element.textContent || '').replace(/^@/, ''),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-mention-id]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ class: 'mention' }, HTMLAttributes),
      `@${node.attrs.label}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.label}`;
  },
});

type MentionState = {
  query: string;
  /** Document range of the typed "@query" to replace */
  from: number;
  to: number;
  left: number;
  top: number;
};

const MENTION_TRIGGER_RE = /(?:^|\s)@([^\s@]{0,30})$/;
const MAX_MENTION_RESULTS = 6;

function displayName(user: MentionUser) {
  return user.name?.trim() || user.email || 'Unknown';
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
  mentionUsers,
  blockFormatting = false,
  toolbarEnd,
  borderless = false,
  onUploaded,
}: Props) {
  const { workspaceFetch } = useWorkspacePaths();
  const uploadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const mentionsEnabled = !!mentionUsers;
  const [mention, setMention] = useState<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const mentionResults = useMemo(() => {
    if (!mention || !mentionUsers) return [];
    const q = mention.query.toLowerCase();
    return mentionUsers
      .filter(
        (user) =>
          !q ||
          user.name?.toLowerCase().includes(q) ||
          user.email?.toLowerCase().includes(q)
      )
      .slice(0, MAX_MENTION_RESULTS);
  }, [mention, mentionUsers]);

  // Key handling runs inside ProseMirror, outside React's render cycle
  const mentionRef = useRef<{
    state: MentionState | null;
    results: MentionUser[];
    index: number;
  }>({ state: null, results: [], index: 0 });
  useEffect(() => {
    mentionRef.current = { state: mention, results: mentionResults, index: mentionIndex };
  }, [mention, mentionResults, mentionIndex]);

  const insertMention = useCallback((user: MentionUser, range: MentionState) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.chain()
      .focus()
      .insertContentAt({ from: range.from, to: range.to }, [
        { type: 'mention', attrs: { id: user.id, label: displayName(user) } },
        { type: 'text', text: ' ' },
      ])
      .run();
    setMention(null);
  }, []);

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

  /** Insert an uploaded non-image file as a link (as nodes, so the name is never parsed as HTML). */
  const insertFileLink = useCallback((uploaded: { url: string; name: string }) => {
    editorRef.current
      ?.chain()
      .focus()
      .insertContent({
        type: 'text',
        text: uploaded.name,
        marks: [{ type: 'link', attrs: { href: uploaded.url } }],
      })
      .run();
  }, []);

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
      MentionNode,
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          'rich-text-editor-body focus:outline-none px-3 py-2.5 text-sm leading-relaxed',
          minHeightClass
        ),
      },
      handleKeyDown: (_view, event) => {
        const { state, results, index } = mentionRef.current;
        if (!state) return false;
        if (event.key === 'Escape') {
          setMention(null);
          return true;
        }
        if (results.length === 0) return false;
        if (event.key === 'ArrowDown') {
          setMentionIndex((index + 1) % results.length);
          return true;
        }
        if (event.key === 'ArrowUp') {
          setMentionIndex((index - 1 + results.length) % results.length);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          insertMention(results[index] ?? results[0], state);
          return true;
        }
        return false;
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
            insertFileLink(uploaded);
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

  // Track an "@query" being typed right before the cursor
  useEffect(() => {
    if (!editor || !mentionsEnabled) return;

    const sync = () => {
      const { selection } = editor.state;
      if (!selection.empty || !editor.isFocused) {
        setMention(null);
        return;
      }
      const { $from } = selection;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
      const match = MENTION_TRIGGER_RE.exec(textBefore);
      if (!match) {
        setMention(null);
        return;
      }
      const query = match[1];
      const to = selection.from;
      const from = to - query.length - 1;
      const coords = editor.view.coordsAtPos(from);
      if (mentionRef.current.state?.query !== query) setMentionIndex(0);
      setMention({ query, from, to, left: coords.left, top: coords.bottom });
    };
    const close = () => setMention(null);

    editor.on('update', sync);
    editor.on('selectionUpdate', sync);
    editor.on('blur', close);
    return () => {
      editor.off('update', sync);
      editor.off('selectionUpdate', sync);
      editor.off('blur', close);
    };
  }, [editor, mentionsEnabled]);

  if (!editor) {
    return (
      <div
        className={cn(
          'overflow-hidden bg-background',
          !borderless && 'rounded-md border',
          className
        )}
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
        'rich-text-editor overflow-hidden bg-background',
        !borderless && 'rounded-md border',
        className
      )}
    >
      {editable ? (
        <div
          className={cn(
            'flex h-10 items-center gap-0.5 overflow-x-auto border-b px-1.5',
            borderless ? 'bg-background' : 'bg-muted/40'
          )}
        >
          {blockFormatting ? (
            <>
              <ToolbarBtn
                title="Heading"
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                <Heading2 className={ICON} strokeWidth={2} />
              </ToolbarBtn>
              <ToolbarBtn
                title="Subheading"
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                <Heading3 className={ICON} strokeWidth={2} />
              </ToolbarBtn>
              <ToolbarDivider />
            </>
          ) : null}

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
          {blockFormatting ? (
            <>
              <ToolbarBtn
                title="Quote"
                active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                <Quote className={ICON} strokeWidth={2} />
              </ToolbarBtn>
              <ToolbarBtn
                title="Code block"
                active={editor.isActive('codeBlock')}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              >
                <Code2 className={ICON} strokeWidth={2} />
              </ToolbarBtn>
            </>
          ) : null}

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
          {mentionsEnabled ? (
            <ToolbarBtn
              title="Mention someone (@)"
              onClick={() => {
                const { $from } = editor.state.selection;
                const before = $from.parent.textBetween(
                  0,
                  $from.parentOffset,
                  undefined,
                  '￼'
                );
                editor
                  .chain()
                  .focus()
                  .insertContent(before && !/\s$/.test(before) ? ' @' : '@')
                  .run();
              }}
            >
              <AtSign className={ICON} strokeWidth={2} />
            </ToolbarBtn>
          ) : null}

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

          {toolbarEnd ? (
            <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">{toolbarEnd}</div>
          ) : null}

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
                  insertFileLink(uploaded);
                }
              });
            }}
          />
        </div>
      ) : null}
      <EditorContent editor={editor} />

      {mention && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="listbox"
              aria-label="Mention someone"
              className="fixed z-[100] w-64 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              style={{
                left: Math.max(8, Math.min(mention.left, window.innerWidth - 264)),
                top: mention.top + 6,
              }}
            >
              {mentionResults.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No one found</p>
              ) : (
                mentionResults.map((user, i) => (
                  <button
                    key={user.id}
                    type="button"
                    role="option"
                    aria-selected={i === mentionIndex}
                    // mousedown, not click: keep the editor focused so the range stays valid
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(user, mention);
                    }}
                    onMouseEnter={() => setMentionIndex(i)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                      i === mentionIndex && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                      {displayName(user).slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{displayName(user)}</span>
                      {user.name && user.email ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
