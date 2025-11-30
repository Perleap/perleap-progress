import json

# Read the English translation file
with open('./src/locales/en/translation.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

# Add the missing keys
en_data['createAssignment']['titleLabel'] = "Assignment Title"
en_data['createAssignment']['instructionsLabel'] = "Instructions"
en_data['createAssignment']['titlePlaceholder'] = "Enter assignment title"

# Also add to editAssignment
en_data['editAssignment']['titleLabel'] = "Assignment Title"
en_data['editAssignment']['instructionsLabel'] = "Instructions"
en_data['editAssignment']['titlePlaceholder'] = "Enter assignment title"

print('✅ Added missing titleLabel and instructionsLabel keys!')

# Write back
with open('./src/locales/en/translation.json', 'w', encoding='utf-8') as f:
    json.dump(en_data, f, ensure_ascii=False, indent=2)

# Now do the same for Hebrew
with open('./src/locales/he/translation.json', 'r', encoding='utf-8') as f:
    he_data = json.load(f)

he_data['createAssignment']['titleLabel'] = "כותרת המטלה"
he_data['createAssignment']['instructionsLabel'] = "הוראות"
he_data['createAssignment']['titlePlaceholder'] = "הזן כותרת למטלה"

he_data['editAssignment']['titleLabel'] = "כותרת המטלה"
he_data['editAssignment']['instructionsLabel'] = "הוראות"
he_data['editAssignment']['titlePlaceholder'] = "הזן כותרת למטלה"

with open('./src/locales/he/translation.json', 'w', encoding='utf-8') as f:
    json.dump(he_data, f, ensure_ascii=False, indent=2)

print('✅ Added Hebrew translations too!')
print('✅ Translation files updated!')
