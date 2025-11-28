import json
import os

def update_translations():
    file_path = 'src/locales/he/translation.json'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Add studentClassroom keys
    if 'studentClassroom' not in data:
        data['studentClassroom'] = {}
        
    data['studentClassroom']['courseInfo'] = "מידע על הקורס"
    data['studentClassroom']['courseTitle'] = "שם הקורס"
    data['studentClassroom']['keyChallenges'] = "אתגרים מרכזיים"
    data['studentClassroom']['noAssignmentsDesc'] = "לא הוקצו עדיין מטלות לכיתה זו."
    
    # Add common keys
    if 'common' not in data:
        data['common'] = {}
        
    data['common']['active'] = "פעיל"
    data['common']['finished'] = "הסתיים"

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print("Updated he/translation.json")

if __name__ == "__main__":
    update_translations()
