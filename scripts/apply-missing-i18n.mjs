import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const enPatches = {
  'assignmentChat.completeNotReady': 'Complete the required steps before finishing this activity.',
  'assignmentChat.errors.sessionExpired': 'Your session expired. Refresh the page and try again.',
  'assignmentChat.resources.empty': 'No resources uploaded yet',
  'assignmentDetail.aiFeedbackFailed':
    'AI feedback could not be generated. Your teacher may review your work manually.',
  'assignmentDetail.assessmentInProgress':
    'Your work is submitted. AI evaluation is in progress—you can continue when ready.',
  'assignmentDetail.submittedAwaitingReview':
    'Your activity has been submitted and is awaiting teacher review.',
  'assignmentDetail.testTaking.selectAllThatApply': 'Select all that apply',
  'assignmentDetail.project.addMoreFiles': 'Add more files',
  'assignmentDetail.langchain.actions.collapseInspector': 'Collapse panel',
  'assignmentDetail.langchain.actions.expandInspector': 'Expand panel',
  'assignmentDetail.langchain.nodes.trigger': 'Trigger',
  'assignmentDetail.langchain.nodes.email': 'Email',
  'assignmentDetail.langchain.nodes.database': 'Database',
  'assignmentDetail.langchain.nodeDescriptions.trigger': 'Start or schedule pipeline runs',
  'assignmentDetail.langchain.nodeDescriptions.email': 'Send email from the pipeline',
  'assignmentDetail.langchain.nodeDescriptions.database': 'Read or write database records',
  'assignmentDetail.langchain.inspector.fields.systemPrompt': 'System prompt',
  'assignmentDetail.langchain.inspector.fields.triggerMode': 'Trigger mode',
  'assignmentDetail.langchain.inspector.fields.sendTo': 'Send to',
  'assignmentDetail.langchain.inspector.placeholders.sendTo': 'email@example.com',
  'assignmentDetail.langchain.inspector.triggerMode.incoming_mail': 'Incoming mail',
  'assignmentDetail.langchain.inspector.triggerMode.manual': 'Manual',
  'assignmentDetail.langchain.inspector.triggerMode.webhook': 'Webhook',
  'assignmentDetail.langchain.inspector.triggerMode.form_submit': 'Form submit',
  'assignmentDetail.langchain.validation.emailSendToRequired':
    'Every Email node needs a recipient address.',
  'classroomDetail.code': 'Invite code',
  'classroomDetail.materials': 'Materials',
  'classroomDetail.students.joined': 'Joined',
  'classroomDetail.students.empty.title': 'No students yet',
  'classroomDetail.students.empty.description':
    'Share your invite code so students can join this classroom.',
  'classroomDetail.activities.videoFileTooLarge': 'Video file is too large (max {{maxMb}} MB).',
  'classroomDetail.activitiesFlow.deleteAssignmentTitle': 'Remove assignment from flow?',
  'classroomDetail.activitiesFlow.deleteAssignmentDescription':
    'Remove "{{name}}" from this module flow? The assignment itself will not be deleted.',
  'classroomDetail.activitiesFlow.deleteLiveSessionTitle': 'Remove live session from flow?',
  'classroomDetail.activitiesFlow.deleteLiveSessionDescription':
    'Remove "{{name}}" from this module flow? The live session will not be deleted.',
  'classroomDetail.resetDialog.button': 'Reset classroom',
  'classroomDetail.resetDialog.title': 'Reset classroom data',
  'classroomDetail.resetDialog.description':
    'This removes all students, submissions, and progress from this classroom. Course structure and assignments are kept.',
  'classroomDetail.resetDialog.cancel': 'Cancel',
  'classroomDetail.resetDialog.confirmButton': 'Reset classroom',
  'classroomDetail.resetDialog.resetting': 'Resetting…',
  'classroomDetail.resetDialog.success': 'Classroom reset complete.',
  'classroomDetail.resetDialog.error': 'Could not reset the classroom. Try again.',
  'classroomDetail.resetDialog.previewLoading': 'Loading preview…',
  'classroomDetail.resetDialog.previewError': 'Could not load reset preview.',
  'classroomDetail.resetDialog.typeToConfirm': 'Type the classroom name to confirm:',
  'classroomDetail.resetDialog.confirmPlaceholder': 'Classroom name',
  'classroomDetail.resetDialog.confirmMismatch': 'Name does not match.',
  'classroomDetail.resetDialog.willRemoveTitle': 'Will be removed',
  'classroomDetail.resetDialog.willRemoveStudents': '{{count}} enrolled students',
  'classroomDetail.resetDialog.willRemoveSubmissions': '{{count}} submissions',
  'classroomDetail.resetDialog.willRemoveProgress': 'All student progress and scores',
  'classroomDetail.resetDialog.willKeepTitle': 'Will be kept',
  'classroomDetail.resetDialog.willKeepCourse': 'Course outline and syllabus',
  'classroomDetail.resetDialog.willKeepAssignments': '{{count}} assignments',
  'classroomDetail.resetDialog.willKeepOutline': 'Module and activity structure',
  'classroomDetail.resetDialog.confirmPrompt.title': 'Reset this classroom?',
  'classroomDetail.resetDialog.confirmPrompt.description':
    'You are about to permanently remove student data from this classroom. This cannot be undone.',
  'classroomDetail.resetDialog.confirmPrompt.cancel': 'Go back',
  'classroomDetail.resetDialog.confirmPrompt.continue': 'Continue',
  'common.deleted': 'Deleted',
  'common.download': 'Download',
  'contact.email': 'Email',
  'contact.phone': 'Phone',
  'contact.office': 'Office',
  'contact.success': "Message sent! We'll get back to you soon.",
  'createAssignment.form.title': 'Title',
  'createAssignment.form.titlePlaceholder': 'Enter assignment title',
  'createAssignment.form.instructions': 'Instructions',
  'createAssignment.form.instructionsPlaceholder': 'Describe what students need to do...',
  'createAssignment.form.type': 'Type',
  'createAssignment.form.typePlaceholder': 'Select assignment type',
  'createAssignment.form.dueDate': 'Due date',
  'createAssignment.form.targetDimensions': 'Target dimensions',
  'createAssignment.testBuilder.markCorrectOptions': 'Mark correct option(s)',
  'createAssignment.testBuilder.correctAnswers': 'Correct answers',
  'createAssignment.wizard.testQuestionsInvalid': 'Fix test questions before saving.',
  'createAssignment.wizard.testQuestionsSaveFailed': 'Could not save test questions. Try again.',
  'liveSession.create.runInBackground': 'Run in background',
  'liveSession.processing.bannerTitle': 'Processing: {{title}}',
  'liveSession.processing.completeTitle': 'Live session ready',
  'liveSession.processing.keepTabOpen': 'Keep this tab open until processing finishes.',
  'liveSession.processing.view': 'View',
  'liveSession.processing.later': 'Later',
  'nav.backToDashboard': 'Back to dashboard',
  'notifications.messages.feedbackReady': 'Feedback is ready for {{assignmentTitle}}',
  'settings.notifications.title': 'Notification preferences',
  'settings.notifications.description': 'Choose which notifications you receive.',
  'settings.notifications.save': 'Save preferences',
  'settings.profile.avatarHint': 'Upload a profile photo (optional).',
  'submissionDetail.projectView.downloadFailed': 'Could not download the file.',
  'submissionDetail.testResults.addQuestionsHint':
    'Add questions in the assignment editor to see results here.',
  'submissionDetail.testResults.averageScore': 'Average: {{score}}%',
  'submissionDetail.testResults.missedCorrect': 'Missed correct option(s)',
  'submissionDetail.testResults.noQuestionsFound': 'No questions found for this test.',
  'submissionDetail.testResults.noQuestionsWithResponsesWarning':
    "Some responses don't match current questions.",
  'submissionDetail.testResults.orphanResponseTitle': 'Response {{index}} (question removed)',
  'submissionDetail.testResults.partial': 'Partial ({{score}}%)',
  'submissionDetail.testResults.selectedOptions': 'Selected options',
  'submissionsTab.from': 'From',
  'submissionsTab.to': 'To',
  'syllabus.detail.moduleStepsHeading': 'Steps in this module',
};

const hePatches = {
  'assignmentChat.completeNotReady': 'השלימו את השלבים הנדרשים לפני סיום הפעילות.',
  'assignmentChat.errors.sessionExpired': 'פג תוקף ההתחברות. רעננו את הדף ונסו שוב.',
  'assignmentChat.resources.empty': 'עדיין לא הועלו משאבים',
  'assignmentDetail.aiFeedbackFailed':
    'לא ניתן ליצור משוב AI. המורה עשוי לבדוק את העבודה שלכם ידנית.',
  'assignmentDetail.assessmentInProgress':
    'העבודה הוגשה. הערכת AI בתהליך—אפשר להמשיך כשמוכנים.',
  'assignmentDetail.submittedAwaitingReview': 'הפעילות הוגשה וממתינה לבדיקת המורה.',
  'assignmentDetail.testTaking.selectAllThatApply': 'בחרו את כל התשובות המתאימות',
  'assignmentDetail.project.addMoreFiles': 'הוסיפו קבצים',
  'assignmentDetail.langchain.actions.collapseInspector': 'כווץ פאנל',
  'assignmentDetail.langchain.actions.expandInspector': 'הרחב פאנל',
  'assignmentDetail.langchain.nodes.trigger': 'טריגר',
  'assignmentDetail.langchain.nodes.email': 'דוא״ל',
  'assignmentDetail.langchain.nodes.database': 'מסד נתונים',
  'assignmentDetail.langchain.nodeDescriptions.trigger': 'הפעלה או תזמון של הרצת pipeline',
  'assignmentDetail.langchain.nodeDescriptions.email': 'שליחת דוא״ל מה-pipeline',
  'assignmentDetail.langchain.nodeDescriptions.database': 'קריאה או כתיבה למסד נתונים',
  'assignmentDetail.langchain.inspector.fields.systemPrompt': 'פרומпт מערכת',
  'assignmentDetail.langchain.inspector.fields.triggerMode': 'מצב טריגר',
  'assignmentDetail.langchain.inspector.fields.sendTo': 'שלח אל',
  'assignmentDetail.langchain.inspector.placeholders.sendTo': 'email@example.com',
  'assignmentDetail.langchain.inspector.triggerMode.incoming_mail': 'דואר נכנס',
  'assignmentDetail.langchain.inspector.triggerMode.manual': 'ידני',
  'assignmentDetail.langchain.inspector.triggerMode.webhook': 'Webhook',
  'assignmentDetail.langchain.inspector.triggerMode.form_submit': 'שליחת טופס',
  'assignmentDetail.langchain.validation.emailSendToRequired': 'לכל צומת דוא״ל נדרשת כתובת נמען.',
  'classroomDetail.code': 'קוד הצטרפות',
  'classroomDetail.materials': 'חומרים',
  'classroomDetail.students.joined': 'הצטרף',
  'classroomDetail.students.empty.title': 'אין תלמידים עדיין',
  'classroomDetail.students.empty.description': 'שתפו את קוד ההצטרפות כדי שתלמידים יוכלו להצטרף.',
  'classroomDetail.activities.videoFileTooLarge': 'קובץ הווידאו גדול מדי (מקסימום {{maxMb}} MB).',
  'classroomDetail.activitiesFlow.deleteAssignmentTitle': 'להסיר משימה מהזרימה?',
  'classroomDetail.activitiesFlow.deleteAssignmentDescription':
    'להסיר את "{{name}}" מזרימת המודול? המשימה עצמה לא תימחק.',
  'classroomDetail.activitiesFlow.deleteLiveSessionTitle': 'להסיר מפגש חי מהזרימה?',
  'classroomDetail.activitiesFlow.deleteLiveSessionDescription':
    'להסיר את "{{name}}" מזרימת המודול? המפגש החי לא יימחק.',
  'classroomDetail.resetDialog.button': 'איפוס כיתה',
  'classroomDetail.resetDialog.title': 'איפוס נתוני כיתה',
  'classroomDetail.resetDialog.description':
    'פעולה זו מסירה את כל התלמידים, ההגשות וההתקדמות מהכיתה. מבנה הקורס והמשימות נשמרים.',
  'classroomDetail.resetDialog.cancel': 'ביטול',
  'classroomDetail.resetDialog.confirmButton': 'אפס כיתה',
  'classroomDetail.resetDialog.resetting': 'מאפס…',
  'classroomDetail.resetDialog.success': 'הכיתה אופסה בהצלחה.',
  'classroomDetail.resetDialog.error': 'לא ניתן לאפס את הכיתה. נסו שוב.',
  'classroomDetail.resetDialog.previewLoading': 'טוען תצוגה מקדימה…',
  'classroomDetail.resetDialog.previewError': 'לא ניתן לטעון תצוגה מקדימה של האיפוס.',
  'classroomDetail.resetDialog.typeToConfirm': 'הקלידו את שם הכיתה לאישור:',
  'classroomDetail.resetDialog.confirmPlaceholder': 'שם הכיתה',
  'classroomDetail.resetDialog.confirmMismatch': 'השם לא תואם.',
  'classroomDetail.resetDialog.willRemoveTitle': 'יוסר',
  'classroomDetail.resetDialog.willRemoveStudents': '{{count}} תלמידים רשומים',
  'classroomDetail.resetDialog.willRemoveSubmissions': '{{count}} הגשות',
  'classroomDetail.resetDialog.willRemoveProgress': 'כל ההתקדמות והציונים של התלמידים',
  'classroomDetail.resetDialog.willKeepTitle': 'יישמר',
  'classroomDetail.resetDialog.willKeepCourse': 'מתווה הקורס והסילבוס',
  'classroomDetail.resetDialog.willKeepAssignments': '{{count}} משימות',
  'classroomDetail.resetDialog.willKeepOutline': 'מבנה המודולים והפעילויות',
  'classroomDetail.resetDialog.confirmPrompt.title': 'לאפס את הכיתה?',
  'classroomDetail.resetDialog.confirmPrompt.description':
    'אתם עומדים להסיר לצמיתות נתוני תלמידים מהכיתה. לא ניתן לבטל פעולה זו.',
  'classroomDetail.resetDialog.confirmPrompt.cancel': 'חזרה',
  'classroomDetail.resetDialog.confirmPrompt.continue': 'המשך',
  'common.deleted': 'נמחק',
  'common.download': 'הורדה',
  'contact.email': 'דוא״ל',
  'contact.phone': 'טלפון',
  'contact.office': 'משרד',
  'contact.success': 'ההודעה נשלחה! נחזור אליכם בהקדם.',
  'createAssignment.form.title': 'כותרת',
  'createAssignment.form.titlePlaceholder': 'הזינו כותרת למשימה',
  'createAssignment.form.instructions': 'הוראות',
  'createAssignment.form.instructionsPlaceholder': 'תארו מה התלמידים צריכים לעשות...',
  'createAssignment.form.type': 'סוג',
  'createAssignment.form.typePlaceholder': 'בחרו סוג משימה',
  'createAssignment.form.dueDate': 'תאריך יעד',
  'createAssignment.form.targetDimensions': 'ממדי יעד',
  'createAssignment.testBuilder.markCorrectOptions': 'סמנו תשובות נכונות',
  'createAssignment.testBuilder.correctAnswers': 'תשובות נכונות',
  'createAssignment.wizard.testQuestionsInvalid': 'תקנו את שאלות המבחן לפני השמירה.',
  'createAssignment.wizard.testQuestionsSaveFailed': 'לא ניתן לשמור את שאלות המבחן. נסו שוב.',
  'liveSession.create.runInBackground': 'הרצה ברקע',
  'liveSession.processing.bannerTitle': 'מעבד: {{title}}',
  'liveSession.processing.completeTitle': 'המפגש החי מוכן',
  'liveSession.processing.keepTabOpen': 'השאירו את הלשונית פתוחה עד סיום העיבוד.',
  'liveSession.processing.view': 'צפייה',
  'liveSession.processing.later': 'אחר כך',
  'nav.backToDashboard': 'חזרה ללוח הבקרה',
  'notifications.messages.feedbackReady': 'משוב מוכן עבור {{assignmentTitle}}',
  'settings.notifications.title': 'העדפות התראות',
  'settings.notifications.description': 'בחרו אילו התראות תקבלו.',
  'settings.notifications.save': 'שמירת העדפות',
  'settings.profile.avatarHint': 'העלו תמונת פרופיל (אופציונלי).',
  'submissionDetail.projectView.downloadFailed': 'לא ניתן להוריד את הקובץ.',
  'submissionDetail.testResults.addQuestionsHint': 'הוסיפו שאלות בעורך המשימה כדי לראות תוצאות כאן.',
  'submissionDetail.testResults.averageScore': 'ממוצע: {{score}}%',
  'submissionDetail.testResults.missedCorrect': 'פספסתם תשובות נכונות',
  'submissionDetail.testResults.noQuestionsFound': 'לא נמצאו שאלות למבחן זה.',
  'submissionDetail.testResults.noQuestionsWithResponsesWarning': 'חלק מהתשובות לא תואמות לשאלות הנוכחיות.',
  'submissionDetail.testResults.orphanResponseTitle': 'תשובה {{index}} (שאלה הוסרה)',
  'submissionDetail.testResults.partial': 'חלקי ({{score}}%)',
  'submissionDetail.testResults.selectedOptions': 'אפשרויות שנבחרו',
  'submissionsTab.from': 'מ-',
  'submissionsTab.to': 'עד',
  'syllabus.detail.moduleStepsHeading': 'שלבים במודול זה',
};

function setPath(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in cur) || cur[p] === null || typeof cur[p] !== 'object' || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function applyPatches(locale, patches) {
  const filePath = path.join(root, 'src/locales', locale, 'translation.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const [key, value] of Object.entries(patches)) {
    setPath(data, key, value);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

applyPatches('en', enPatches);
applyPatches('he', hePatches);
console.log(`Applied ${Object.keys(enPatches).length} keys to en and he.`);
