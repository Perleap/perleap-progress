import json
import os

def update_translations():
    file_path = 'src/locales/he/translation.json'
    
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
    data['settings']['questions']['schedulePreference'] = "לוח זמנים מובנה או גמיש?"
    data['settings']['questions']['motivation'] = "מה מניע אותך ללמוד?"
    data['settings']['questions']['helpPreference'] = "כשאת/ה מתקשה, איך אפשר לעזור לך?"
    data['settings']['questions']['teacherPreference'] = "מה חשוב לך במורה?"
    data['settings']['questions']['feedbackPreference'] = "איך את/ה מעדיף/ה לקבל משוב?"
    data['settings']['questions']['learningGoal'] = "מהי מטרה אחת שתרצה/י להשיג?"
    data['settings']['questions']['specialNeeds'] = "האם יש לך צרכים או העדפות מיוחדות?"
    data['settings']['questions']['additionalNotes'] = "משהו נוסף שכדאי שנדע?"

    # Options
    data['settings']['options']['structured'] = "לוח זמנים מובנה"
    data['settings']['options']['flexible'] = "גישה גמישה"
    data['settings']['options']['curiosity'] = "סקרנות"
    data['settings']['options']['grades'] = "הישגים וציונים"
    data['settings']['options']['recognition'] = "הכרה והערכה"
    data['settings']['options']['personalGoals'] = "מטרות אישיות"
    data['settings']['options']['competition'] = "תחרותיות"
    data['settings']['options']['hints'] = "רמזים כדי להבין לבד"
    data['settings']['options']['explainDifferently'] = "הסבר בדרך אחרת"
    data['settings']['options']['stepByStep'] = "פתרון צעד-אחר-צעד"
    data['settings']['options']['moreTime'] = "יותר זמן להבין"
    data['settings']['options']['patient'] = "סבלנות והבנה"
    data['settings']['options']['pushing'] = "דחיפה להישגים"
    data['settings']['options']['clear'] = "הסברים ברורים"
    data['settings']['options']['fun'] = "למידה מהנה"
    data['settings']['options']['immediate'] = "משוב מיידי"
    data['settings']['options']['written'] = "הערות כתובות"
    data['settings']['options']['discussion'] = "דיון עם המורה"

    # Placeholders
    data['settings']['placeholders']['learningGoal'] = "לדוגמה: לשפר את הציון, לשלוט במיומנות, לצבור ביטחון..."
    data['settings']['placeholders']['specialNeeds'] = "לדוגמה: הפסקות קצרות, עזרים חזותיים, סביבה שקטה..."
    data['settings']['placeholders']['additionalNotes'] = "כל הערה אחרת, קשיי למידה או העדפות..."

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print("Updated he/translation.json")

if __name__ == "__main__":
    update_translations()
