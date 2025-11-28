import json

# Read the English translation file
with open('src/locales/en/translation.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add the missing keys to components.analytics
if 'components' in data and 'analytics' in data['components']:
    data['components']['analytics']['noAssignments'] = 'No assignments found'
    data['components']['analytics']['noCompletedSubmissions'] = 'No completed submissions found'

# Write back
with open('src/locales/en/translation.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Added missing keys to EN translation file")
