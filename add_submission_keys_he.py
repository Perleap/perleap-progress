import json
import os

file_path = r'c:\Users\Dor\Desktop\Projects\PerLeap\App\Antigravity\perleap-progress\src\locales\he\translation.json'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add/Update submissionDetail
if 'submissionDetail' not in data:
    data['submissionDetail'] = {}

data['submissionDetail'].update({
    "generateFollowUp": "צור מטלת המשך",
    "teacherFeedbackDesc": "ניתוח והמלצות מבוססי AI על סמך שיחת הלמידה",
    "studentFeedbackDesc": "מה {{student}} ראה לאחר השלמת המטלה",
    "conversationHistory": "היסטוריית שיחה",
    "conversationHistoryDesc": "תמליל מלא בין {{student}} ל-Perleap",
    "noFeedbackDesc": "התלמיד טרם השלים את המטלה, או שהמשוב עדיין בתהליך יצירה."
})

# Add/Update studentAnalytics
if 'studentAnalytics' not in data:
    data['studentAnalytics'] = {}

data['studentAnalytics'].update({
    "title": "ניתוח תלמיד",
    "developmentAcross": "התפתחות מיומנויות רכות 5D לאורך הגשה אחת",
    "developmentAcrossPlural": "התפתחות מיומנויות רכות 5D לאורך {{count}} הגשות",
    "perSubmission": "לפי הגשה",
    "allSubmissionsAverage": "ממוצע כל ההגשות",
    "scoresFromSubmission": "ציונים מהגשה זו",
    "averageAcross": "ממוצע לאורך כל {{count}} ההגשות בכיתה זו",
    "noDataSubmission": "אין נתוני ציון זמינים להגשה זו",
    "noDataAverage": "אין נתוני ציון זמינים",
    "noSubmissions": "אין הגשות זמינות לניתוח"
})

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Successfully updated Hebrew translation keys.")
