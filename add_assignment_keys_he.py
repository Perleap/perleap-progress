import json
import os

file_path = r'c:\Users\Dor\Desktop\Projects\PerLeap\App\Antigravity\perleap-progress\src\locales\he\translation.json'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add/Update assignments keys
if 'assignments' not in data:
    data['assignments'] = {}

data['assignments'].update({
    "status": {
        "published": "פורסם",
        "draft": "טיוטה",
        "archived": "בארכיון"
    },
    "types": {
        "text_essay": "חיבור טקסט",
        "file_upload": "העלאת קובץ",
        "quiz": "בוחן",
        "project": "פרויקט",
        "interactive": "אינטראקטיבי"
    }
})

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Successfully updated Hebrew assignment keys.")
