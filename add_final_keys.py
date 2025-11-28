import json
import os

def update_json(file_path, lang):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Add settings.learningPreferences and learningPreferencesDesc
    if 'settings' not in data:
        data['settings'] = {}
    
    if lang == 'en':
        data['settings']['learningPreferences'] = "Learning Preferences"
        data['settings']['learningPreferencesDesc'] = "Tell us about your learning style and preferences"
    else:  # Hebrew
        data['settings']['learningPreferences'] = "העדפות למידה"
        data['settings']['learningPreferencesDesc'] = "ספר לנו על סגנון הלמידה וההעדפות שלך"

    # Add assignmentTypes if not exists
    if 'assignmentTypes' not in data:
        data['assignmentTypes'] = {}
    
    if lang == 'en':
        data['assignmentTypes']['text_essay'] = "Text Essay"
        data['assignmentTypes']['file_upload'] = "File Upload"
        data['assignmentTypes']['quiz'] = "Quiz"
        data['assignmentTypes']['project'] = "Project"
        data['assignmentTypes']['interactive'] = "Interactive"
    else:  # Hebrew
        data['assignmentTypes']['text_essay'] = "חיבור טקסט"
        data['assignmentTypes']['file_upload'] = "העלאת קובץ"
        data['assignmentTypes']['quiz'] = "חידון"
        data['assignmentTypes']['project'] = "פרויקט"
        data['assignmentTypes']['interactive'] = "אינטראקטיבי"

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

base_path = r"c:\Users\Dor\Desktop\Projects\PerLeap\App\Antigravity\perleap-progress\src\locales"
update_json(os.path.join(base_path, 'en', 'translation.json'), 'en')
update_json(os.path.join(base_path, 'he', 'translation.json'), 'he')

print("Translation keys added successfully.")
