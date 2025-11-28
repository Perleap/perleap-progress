import json

# Read HE translation file
with open('src/locales/he/translation.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add missing classroomDetail keys in Hebrew
if 'classroomDetail' in data:
    data['classroomDetail']['details'] = 'פרטים'
    data['classroomDetail']['subjectAreas'] = 'תחומי נושא'
    data['classroomDetail']['subjectAreasDesc'] = 'נושאים ומיומנויות מרכזיים המכוסים בקורס זה'
    data['classroomDetail']['skills'] = 'מיומנויות'
    data['classroomDetail']['courseMaterials'] = 'חומרי קורס'
    data['classroomDetail']['courseMaterialsDesc'] = 'משאבים וחומרים לקורס זה'
    data['classroomDetail']['copiedToClipboard'] = 'הקוד הועתק ללוח!'
    data['classroomDetail']['noAssignmentsDesc'] = 'צור את המשימה הראשונה שלך כדי להתחיל'
    data['classroomDetail']['assignedTo'] = 'הוקצה ל'
    data['classroomDetail']['type'] = 'סוג:'
    data['classroomDetail']['due'] = 'יעד:'
    data['classroomDetail']['attachments'] = 'קבצים מצורפים'
    
    # Add deleteDialog section
    data['classroomDetail']['deleteDialog'] = {
        'title': 'מחק כיתה',
        'description': 'האם אתה בטוח שברצונך למחוק את הכיתה הזו? פעולה זו אינה ניתנת לביטול.'
    }
    
    # Add studentsTab.noStudents and studentIncomplete if missing
    if 'studentsTab' in data['classroomDetail']:
        data['classroomDetail']['studentsTab']['noStudents'] = 'אין תלמידים רשומים עדיין'
        data['classroomDetail']['studentsTab']['studentIncomplete'] = 'תלמיד (פרופיל לא שלם)'

# Write back
with open('src/locales/he/translation.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("✓ Added missing classroomDetail keys to HE")
