import json
import os

def update_translations():
    file_path = 'src/locales/en/translation.json'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Add studentClassroom keys
    if 'studentClassroom' not in data:
        data['studentClassroom'] = {}
        
    data['studentClassroom']['courseInfo'] = "Course Information"
    data['studentClassroom']['courseTitle'] = "Course Title"
    data['studentClassroom']['keyChallenges'] = "Key Challenges"
    data['studentClassroom']['noAssignmentsDesc'] = "No assignments have been assigned to this class yet."
    
    # Add common keys
    if 'common' not in data:
        data['common'] = {}
        
    data['common']['active'] = "Active"
    data['common']['finished'] = "Finished"

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print("Updated en/translation.json")

if __name__ == "__main__":
    update_translations()
