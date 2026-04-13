import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Send, Loader2, Trash2, MessageSquare, Reply } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSectionComments, useCreateComment, useDeleteComment } from '@/hooks/queries';
import type { SectionComment } from '@/types/syllabus';

interface SectionCommentThreadProps {
  sectionId: string;
  isRTL?: boolean;
}

function CommentItem({
  comment,
  sectionId,
  userId,
  isRTL,
  onReply,
}: {
  comment: SectionComment;
  sectionId: string;
  userId: string | undefined;
  isRTL: boolean;
  onReply: (parentId: string) => void;
}) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteComment();
  const isOwn = userId === comment.user_id;

  const initial = (comment.user_name || 'U').charAt(0).toUpperCase();

  return (
    <div className={cn('group flex gap-2.5', isRTL && 'flex-row-reverse')}>
      <Avatar size="sm" className="size-7 flex-shrink-0">
        {comment.user_avatar ? <AvatarImage src={comment.user_avatar} alt="" /> : null}
        <AvatarFallback className="text-[10px] font-bold">{initial}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className={cn('flex items-center gap-2 mb-0.5', isRTL && 'flex-row-reverse')}>
          <span className="text-xs font-medium text-foreground">{comment.user_name || 'User'}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>
        <p className={cn('text-sm text-foreground/80 whitespace-pre-wrap', isRTL && 'text-right')}>
          {comment.content}
        </p>
        <div className={cn('flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity', isRTL && 'flex-row-reverse')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReply(comment.id)}
            className="h-5 text-[10px] text-muted-foreground px-1.5"
          >
            <Reply className="h-2.5 w-2.5 me-0.5" /> {t('syllabus.comments.reply')}
          </Button>
          {isOwn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate({ commentId: comment.id, sectionId })}
              disabled={deleteMutation.isPending}
              className="h-5 text-[10px] text-muted-foreground hover:text-destructive px-1.5"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export const SectionCommentThread = ({ sectionId, isRTL = false }: SectionCommentThreadProps) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { data: comments = [], isLoading } = useSectionComments(sectionId);

  /** When DB author snapshot columns are missing, show the signed-in user's name/avatar from Auth. */
  const displayComments = useMemo((): SectionComment[] => {
    if (!user?.id || !profile?.full_name) return comments;
    return comments.map((c) => {
      if (c.user_id !== user.id) return c;
      const missingName = !c.user_name?.trim() || c.user_name === 'User';
      const missingAvatar = !c.user_avatar?.trim();
      if (!missingName && !missingAvatar) return c;
      return {
        ...c,
        user_name: missingName ? profile.full_name : c.user_name,
        user_avatar: missingAvatar ? profile.avatar_url ?? c.user_avatar : c.user_avatar,
      };
    });
  }, [comments, user?.id, profile?.full_name, profile?.avatar_url]);
  const createMutation = useCreateComment();
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim() || !user?.id) return;
    try {
      await createMutation.mutateAsync({
        sectionId,
        userId: user.id,
        content: content.trim(),
        parentId: replyTo,
      });
      setContent('');
      setReplyTo(null);
    } catch {
      // error handled by mutation
    }
  };

  const topLevel = displayComments.filter((c) => !c.parent_id);
  const replies = displayComments.filter((c) => c.parent_id);
  const repliesMap: Record<string, SectionComment[]> = {};
  replies.forEach((r) => {
    if (r.parent_id) {
      if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = [];
      repliesMap[r.parent_id].push(r);
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {topLevel.length === 0 && (
        <div className="text-center py-4">
          <MessageSquare className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">{t('syllabus.comments.noComments')}</p>
        </div>
      )}

      {topLevel.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <CommentItem
            comment={comment}
            sectionId={sectionId}
            userId={user?.id}
            isRTL={isRTL}
            onReply={setReplyTo}
          />
          {repliesMap[comment.id]?.map((reply) => (
            <div key={reply.id} className={cn('ps-8', isRTL && 'pe-8 ps-0')}>
              <CommentItem
                comment={reply}
                sectionId={sectionId}
                userId={user?.id}
                isRTL={isRTL}
                onReply={setReplyTo}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Comment input */}
      <div className="pt-2">
        {replyTo && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-muted-foreground">{t('syllabus.comments.replyingTo')}</span>
            <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)} className="h-4 text-[10px] px-1">
              {t('common.cancel')}
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('syllabus.comments.placeholder')}
            rows={2}
            className="rounded-lg resize-none text-xs flex-1"
            autoDirection
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !content.trim()}
            className="rounded-full h-9 w-9 p-0 self-end"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
