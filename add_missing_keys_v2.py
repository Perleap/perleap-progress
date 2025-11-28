import json
import os

def update_json(file_path, new_keys, lang):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Add settings.notifications
    if 'settings' not in data:
        data['settings'] = {}
    
    if 'notifications' not in data['settings']:
        data['settings']['notifications'] = {}

    notifications = {
        "assignmentNotifications": "Assignment Notifications" if lang == 'en' else "התראות על מטלות",
        "assignmentNotificationsDesc": "Get notified when new assignments are posted" if lang == 'en' else "קבל התראה כאשר מטלות חדשות מתפרסמות",
        "feedbackNotifications": "Feedback Notifications" if lang == 'en' else "התראות משוב",
        "feedbackNotificationsDesc": "Get notified when you receive feedback" if lang == 'en' else "קבל התראה כאשר אתה מקבל משוב",
        "classroomUpdates": "Classroom Updates" if lang == 'en' else "עדכוני כיתה",
        "classroomUpdatesDesc": "Stay updated about changes in the classroom" if lang == 'en' else "הישאר מעודכן לגבי שינויים בכיתה",
        "emailNotifications": "Email Notifications" if lang == 'en' else "התראות אימייל",
        "emailNotificationsDesc": "Receive a digest of notifications via email" if lang == 'en' else "קבל סיכום התראות באימייל"
    }

    data['settings']['notifications'].update(notifications)

    # Add common.completed
    if 'common' not in data:
        data['common'] = {}
    
    data['common']['completed'] = "Completed" if lang == 'en' else "הושלם"

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

base_path = r"c:\Users\Dor\Desktop\Projects\PerLeap\App\Antigravity\perleap-progress\src\locales"
update_json(os.path.join(base_path, 'en', 'translation.json'), {}, 'en')
update_json(os.path.join(base_path, 'he', 'translation.json'), {}, 'he')

print("Keys added successfully.")
