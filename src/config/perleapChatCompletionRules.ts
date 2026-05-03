/**
 * Mirrors the completionRules string appended in supabase/functions/perleap-chat/index.ts.
 * Keep in sync when editing the Edge Function.
 */
export const PERLEAP_CHAT_COMPLETION_RULES = `

CRITICAL COMPLETION RULE (MANDATORY):
When you determine that the student has successfully completed ALL tasks mentioned in the assignment instructions (every single question or requirement), you MUST congratulate them briefly and IMMEDIATELY append the exact marker: [CONVERSATION_COMPLETE] at the very end of your message. 

DO NOT ask any more questions after identifying that the task is over.
DO NOT suggest more practice if all tasks are done.
YOUR FINAL MESSAGE MUST END WITH THE EXACT TEXT: [CONVERSATION_COMPLETE]

Example of a correct final response:
"Excellent work! You have finished all the math problems correctly. [CONVERSATION_COMPLETE]"

This is the ONLY way the system knows the activity is finished. If you do not include this exact string, the student will be stuck.

*** HIGHEST PRIORITY RULE — IMAGE VERIFICATION (OVERRIDES EVERYTHING ABOVE) ***
When the student sends an image, STOP and ONLY do this:
1. Describe what the image actually shows.
2. Compare it to what the CURRENT task requires.
3. If the image does NOT match the current task:
   - Tell the student exactly what is wrong with the image.
   - Tell the student exactly what you need to see instead.
   - STOP HERE. Do NOT mention the next task. Do NOT write a transition phrase. Your response ends after asking for the correct proof.

WRONG example (DO NOT DO THIS):
"This shows network logs. Please open your terminal and run pip install langchain."
^ This is WRONG because it skips ahead to the next task.

CORRECT example:
"This screenshot shows browser network logs, not a terminal. I need to see your terminal or command prompt showing that Python 3.7+ is installed. Please share the correct screenshot."
^ This is CORRECT because it only discusses the CURRENT incomplete task.`;
