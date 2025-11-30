import json

# Read the English translation file
with open('./src/locales/en/translation.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

# Add missing createAssignment keys based on the screenshot
en_data['createAssignment'].update({
    "instructionsPlaceholder": "Describe what students need to do...",
    "subjectAreaAndSkills": "Subject Area & Skills",
    "subjectAreaLabel": "Subject Area",
    "selectFromDomains": "Select from classroom domains",
    "orEnterManually": "or enter manually",
    "subjectAreaPlaceholder": "Enter subject area",
    "skillsToAssess": "Skills to Assess",
    "addSkillManually": "Add skill manually",
    "assignmentMaterials": "Assignment Materials",
    "selectFromClassroomMaterials": "Select from classroom materials:",
    "uploadPDF": "Upload PDF",
    "addLink": "Add Link",
    "cancel": "Cancel",
    "createButton": "Create Assignment"
})

# Also add these to editAssignment
en_data['editAssignment'].update({
    "instructionsPlaceholder": "Describe what students need to do...",
    "subjectAreaAndSkills": "Subject Area & Skills",
    "subjectAreaLabel": "Subject Area",
    "selectFromDomains": "Select from classroom domains",
    "orEnterManually": "or enter manually",
    "subjectAreaPlaceholder": "Enter subject area",
    "skillsToAssess": "Skills to Assess",
    "addSkillManually": "Add skill manually",
    "assignmentMaterials": "Assignment Materials",
    "selectFromClassroomMaterials": "Select from classroom materials:",
    "uploadPDF": "Upload PDF",
    "addLink": "Add Link",
    "cancel": "Cancel",
    "saveButton": "Save Changes"
})

print('✅ Added missing createAssignment and editAssignment translation keys!')

# Write back
with open('./src/locales/en/translation.json', 'w', encoding='utf-8') as f:
    json.dump(en_data, f, ensure_ascii=False, indent=2)

print('✅ Translation file updated!')
