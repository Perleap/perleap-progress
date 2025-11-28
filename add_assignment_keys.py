import json
import os

file_path = r'c:\Users\Dor\Desktop\Projects\PerLeap\App\Antigravity\perleap-progress\src\locales\en\translation.json'

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
        "published": "Published",
        "draft": "Draft",
        "archived": "Archived"
    },
    "types": {
        "text_essay": "Text Essay",
        "file_upload": "File Upload",
        "quiz": "Quiz",
        "project": "Project",
        "interactive": "Interactive"
    }
})

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Successfully updated English assignment keys.")
