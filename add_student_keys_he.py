import json
import os

def update_translations():
    file_path = 'src/locales/he/translation.json'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Add studentDashboard keys
    if 'studentDashboard' in data:
        data['studentDashboard']['activeCourse'] = "קורס פעיל"
        
    # Add studentClassroom keys
    if 'studentClassroom' in data:
        data['studentClassroom']['schedule'] = "לוח זמנים"
        data['studentClassroom']['duration'] = "משך הקורס"
        data['studentClassroom']['startDate'] = "תאריך התחלה"
        data['studentClassroom']['endDate'] = "תאריך סיום"
        data['studentClassroom']['viewAssignment'] = "צפה במטלה"

    # Add notifications keys
    if 'notifications' not in data:
        data['notifications'] = {}
        
    data['notifications']['titles'] = {
        "feedbackReceived": "משוב התקבל",
        "successfullyEnrolled": "נרשמת בהצלחה",
        "newAssignment": "מטלה אישית חדשה",
        "studentEnrolled": "תלמיד חדש נרשם"
    }

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print("Updated he/translation.json")

if __name__ == "__main__":
    update_translations()
