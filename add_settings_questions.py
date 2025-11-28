import json
import os

def update_translations():
    file_path = 'src/locales/en/translation.json'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'settings' not in data:
        data['settings'] = {}
        
    if 'questions' not in data['settings']:
        data['settings']['questions'] = {}
        
    if 'options' not in data['settings']:
        data['settings']['options'] = {}
        
    if 'placeholders' not in data['settings']:
        data['settings']['placeholders'] = {}

    # Questions
    data['settings']['questions']['schedulePreference'] = "Structured schedule or flexible?"
    data['settings']['questions']['motivation'] = "What motivates you to learn?"
    data['settings']['questions']['helpPreference'] = "When struggling, how can someone help you?"
    data['settings']['questions']['teacherPreference'] = "What do you look for in a teacher?"
    data['settings']['questions']['feedbackPreference'] = "How do you prefer feedback?"
    data['settings']['questions']['learningGoal'] = "What is one goal you hope to achieve?"
    data['settings']['questions']['specialNeeds'] = "Do you have any specific needs or preferences?"
    data['settings']['questions']['additionalNotes'] = "Anything else we should know?"

    # Options
    data['settings']['options']['structured'] = "Structured Schedule"
    data['settings']['options']['flexible'] = "Flexible Approach"
    data['settings']['options']['curiosity'] = "Curiosity"
    data['settings']['options']['grades'] = "Achievement & Grades"
    data['settings']['options']['recognition'] = "Recognition"
    data['settings']['options']['personalGoals'] = "Personal Goals"
    data['settings']['options']['competition'] = "Competition"
    data['settings']['options']['hints'] = "Hints to figure it out myself"
    data['settings']['options']['explainDifferently'] = "Explain differently"
    data['settings']['options']['stepByStep'] = "Step-by-step solution"
    data['settings']['options']['moreTime'] = "More time to figure it out"
    data['settings']['options']['patient'] = "Patient & understanding"
    data['settings']['options']['pushing'] = "Pushes me to achieve"
    data['settings']['options']['clear'] = "Explains clearly"
    data['settings']['options']['fun'] = "Makes learning fun"
    data['settings']['options']['immediate'] = "Immediate feedback"
    data['settings']['options']['written'] = "Written comments"
    data['settings']['options']['discussion'] = "Discussion with teacher"

    # Placeholders
    data['settings']['placeholders']['learningGoal'] = "e.g., Improve my grade, master a skill, gain confidence..."
    data['settings']['placeholders']['specialNeeds'] = "e.g., Short breaks, visual aids, quiet environment..."
    data['settings']['placeholders']['additionalNotes'] = "Any other comments, learning difficulties, or preferences..."

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print("Updated en/translation.json")

if __name__ == "__main__":
    update_translations()
