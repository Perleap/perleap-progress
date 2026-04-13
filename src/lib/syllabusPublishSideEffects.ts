import type { TFunction } from 'i18next';
import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/lib/notificationService';
import { createChangelogEntry } from '@/services/syllabusResourceService';
import type { NotificationType } from '@/types/notifications';

export type SyllabusPublishSideEffectsParams = {
  classroomId: string;
  syllabusId: string;
  syllabusTitle: string;
  sectionsCount: number;
  userId: string | undefined;
  wasAlreadyPublished: boolean;
};

/**
 * Changelog + enrolled-student notifications after a syllabus is published or re-published.
 * Call after the DB row reflects published state (insert or publish mutation).
 */
export async function runSyllabusPublishedSideEffects(
  t: TFunction,
  params: SyllabusPublishSideEffectsParams
): Promise<void> {
  const { classroomId, syllabusId, syllabusTitle, sectionsCount, userId, wasAlreadyPublished } = params;

  if (userId) {
    const changelogMsg = wasAlreadyPublished
      ? t('syllabus.changelog.republishedSyllabus')
      : t('syllabus.changelog.publishedSyllabus');
    createChangelogEntry(syllabusId, userId, changelogMsg, {
      sections_count: sectionsCount,
      title: syllabusTitle,
    }).catch(() => {});
  }

  try {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('classroom_id', classroomId);

    if (!enrollments?.length) return;

    const notifType = (wasAlreadyPublished ? 'syllabus_updated' : 'syllabus_published') as NotificationType;
    const notifTitle = wasAlreadyPublished
      ? t('syllabus.notifications.updatedTitle')
      : t('syllabus.notifications.publishedTitle');
    const notifMessage = wasAlreadyPublished
      ? t('syllabus.notifications.updatedMessage', { title: syllabusTitle })
      : t('syllabus.notifications.publishedMessage', { title: syllabusTitle });

    await Promise.allSettled(
      enrollments.map((e: { student_id: string }) =>
        createNotification(
          e.student_id,
          notifType,
          notifTitle,
          notifMessage,
          undefined,
          { classroom_id: classroomId, syllabus_id: syllabusId },
          userId
        )
      )
    );
  } catch {
    // Notifications are best-effort
  }
}
