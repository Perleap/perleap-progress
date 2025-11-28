import json
import os

file_path = r'c:\Users\Dor\Desktop\Projects\PerLeap\App\Antigravity\perleap-progress\src\locales\en\translation.json'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add/Update submissionDetail
if 'submissionDetail' not in data:
    data['submissionDetail'] = {}

data['submissionDetail'].update({
    "generateFollowUp": "Generate Follow-up Assignment",
    "teacherFeedbackDesc": "AI-generated analysis and recommendations based on the learning conversation",
    "studentFeedbackDesc": "What {{student}} saw after completing the assignment",
    "conversationHistory": "Conversation History",
    "conversationHistoryDesc": "Complete transcript between {{student}} and Perleap",
    "noFeedbackDesc": "This student hasn't completed the assignment yet, or feedback is still being generated."
})

# Add/Update studentAnalytics
if 'studentAnalytics' not in data:
    data['studentAnalytics'] = {}

data['studentAnalytics'].update({
    "title": "Student Analytics",
    "developmentAcross": "5D Soft Skills Development Across {{count}} Submission",
    "developmentAcrossPlural": "5D Soft Skills Development Across {{count}} Submissions",
    "perSubmission": "Per Submission",
    "allSubmissionsAverage": "All Submissions Average",
    "scoresFromSubmission": "Scores from this submission",
    "averageAcross": "Average across all {{count}} submission(s) in this classroom",
    "noDataSubmission": "No score data available for this submission",
    "noDataAverage": "No score data available",
    "noSubmissions": "No submissions available for analysis"
})

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Successfully updated English translation keys.")
