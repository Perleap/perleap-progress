import json
import os

file_path = r'c:\Users\Dor\Desktop\Projects\PerLeap\App\Antigravity\perleap-progress\src\locales\en\translation.json'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add/Update common keys
if 'common' not in data:
    data['common'] = {}

data['common'].update({
    "advancedFilters": "Advanced Filters",
    "status": "Status"
})

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Successfully updated English filter keys.")
