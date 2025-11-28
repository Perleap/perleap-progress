import json
import os

def update_translations():
    file_path = 'src/locales/en/translation.json'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Add studentDashboard keys
    if 'studentDashboard' in data:
        data['studentDashboard']['activeCourse'] = "Active Course"
        
    # Add studentClassroom keys
    if 'studentClassroom' in data:
        data['studentClassroom']['schedule'] = "Schedule"
        data['studentClassroom']['duration'] = "Duration"
        data['studentClassroom']['startDate'] = "Start Date"
        data['studentClassroom']['endDate'] = "End Date"
        data['studentClassroom']['viewAssignment'] = "View Assignment"

    # Add notifications keys
    if 'notifications' not in data:
        data['notifications'] = {}
        
    data['notifications']['titles'] = {
        "feedbackReceived": "Feedback Received",
        "successfullyEnrolled": "Successfully Enrolled",
        "newAssignment": "New Personalized Assignment",
        "studentEnrolled": "New Student Enrolled"
    }

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print("Updated en/translation.json")

if __name__ == "__main__":
    update_translations()
