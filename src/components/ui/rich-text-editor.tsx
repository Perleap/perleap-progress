import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import { useCallback, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  Heading1,
  Heading2,
  Heading3,
  Code2,
  Pilcrow,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

function ToolbarButton({
  editor,
  action,
  isActive,
  icon: Icon,
  title,
}: {
  editor: Editor;
  action: () => void;
  isActive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Toggle
      size="sm"
      pressed={isActive}
      onPressedChange={() => action()}
      aria-label={title}
      title={title}
      className="h-8 w-8 p-0"
    >
      <Icon className="h-4 w-4" />
    </Toggle>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const addImage = useCallback(() => {
    const url = window.prompt('Image URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const addLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const addYoutube = useCallback(() => {
    const url = window.prompt('YouTube URL');
    if (url) editor.commands.setYoutubeVideo({ src: url });
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5 bg-muted/30">
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive('paragraph')}
        icon={Pilcrow}
        title="Paragraph"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        icon={Heading1}
        title="Heading 1"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        icon={Heading2}
        title="Heading 2"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        icon={Heading3}
        title="Heading 3"
      />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        icon={Bold}
        title="Bold"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        icon={Italic}
        title="Italic"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        icon={Strikethrough}
        title="Strikethrough"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        icon={Code}
        title="Inline Code"
      />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        icon={List}
        title="Bullet List"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        icon={ListOrdered}
        title="Ordered List"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        icon={Quote}
        title="Blockquote"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        icon={Code2}
        title="Code Block"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().setHorizontalRule().run()}
        isActive={false}
        icon={Minus}
        title="Horizontal Rule"
      />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        editor={editor}
        action={addLink}
        isActive={editor.isActive('link')}
        icon={LinkIcon}
        title="Link"
      />
      <ToolbarButton
        editor={editor}
        action={addImage}
        isActive={false}
        icon={ImageIcon}
        title="Image"
      />
      <ToolbarButton
        editor={editor}
        action={addYoutube}
        isActive={false}
        icon={YoutubeIcon}
        title="YouTube"
      />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().undo().run()}
        isActive={false}
        icon={Undo}
        title="Undo"
      />
      <ToolbarButton
        editor={editor}
        action={() => editor.chain().focus().redo().run()}
        isActive={false}
        icon={Redo}
        title="Redo"
      />
    </div>
  );
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  className,
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Youtube.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none min-h-[200px] px-4 py-3 focus:outline-none',
          '[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
          '[&_p.is-editor-empty:first-child]:before:text-muted-foreground/50',
          '[&_p.is-editor-empty:first-child]:before:float-left',
          '[&_p.is-editor-empty:first-child]:before:pointer-events-none',
          '[&_p.is-editor-empty:first-child]:before:h-0',
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        'rounded-xl border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className,
      )}
    >
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: true },
      }),
      Image.configure({ inline: false }),
      Youtube.configure({ inline: false }),
    ],
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none px-4 py-3',
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className={cn('rounded-xl border bg-background overflow-hidden', className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
