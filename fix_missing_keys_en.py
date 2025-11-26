import json

# Read EN translation file
with open('src/locales/en/translation.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add missing classroomDetail keys
if 'classroomDetail' in data:
    # Add missing keys after assignmentsSubtitle
    data['classroomDetail']['details'] = 'Details'
    data['classroomDetail']['subjectAreas'] = 'Subject Areas'
    data['classroomDetail']['subjectAreasDesc'] = 'Key topics and skills covered in this course'
    data['classroomDetail']['skills'] = 'Skills'
    data['classroomDetail']['courseMaterials'] = 'Course Materials'
    data['classroomDetail']['courseMaterialsDesc'] = 'Resources and materials for this course'
    data['classroomDetail']['copiedToClipboard'] = 'Code copied to clipboard!'
    data['classroomDetail']['noAssignmentsDesc'] = 'Create your first assignment to get started'
    data['classroomDetail']['assignedTo'] = 'Assigned to'
    data['classroomDetail']['type'] = 'Type:'
    data['classroomDetail']['due'] = 'Due:'
    data['classroomDetail']['attachments'] = 'Attachments'
    
    # Add deleteDialog section
    data['classroomDetail']['deleteDialog'] = {
        'title': 'Delete Classroom',
        'description': 'Are you sure you want to delete this classroom? This action cannot be undone.'
    }
    
    # Add studentsTab.noStudents and studentIncomplete if missing
    if 'studentsTab' in data['classroomDetail']:
        data['classroomDetail']['studentsTab']['noStudents'] = 'No students enrolled yet'
        data['classroomDetail']['studentsTab']['studentIncomplete'] = 'Student (Incomplete Profile)'

# Write back
with open('src/locales/en/translation.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("✓ Added missing classroomDetail keys to EN")
