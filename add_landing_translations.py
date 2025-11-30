import json

# Read the current English translation file
with open('./src/locales/en/translation.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

print('Current structure - Top level keys:', list(en_data.keys()))

# Add the missing landing page translations
en_data['landing']['features'] = {
    "title": "Why PerLeap?",
    "subtitle": "We combine cutting-edge AI with proven pedagogical methods to create transformative learning experiences.",
    "heading1": "Transforming Education",
    "heading2": "with AI",
    "cognitive": {
        "title": "Cognitive Development",
        "description": "Enhance critical thinking and problem-solving skills through personalized AI guidance."
    },
    "social": {
        "title": "Social Learning",
        "description": "Foster collaboration and communication skills in a safe, controlled environment."
    },
    "realtime": {
        "title": "Real-time Feedback",
        "description": "Provide immediate, constructive feedback to students as they work."
    },
    "secure": {
        "title": "Secure & Private",
        "description": "Enterprise-grade security ensures student data is always protected."
    },
    "analytics": {
        "title": "Advanced Analytics",
        "description": "Gain deep insights into student progress and learning patterns."
    },
    "global": {
        "title": "Global Accessibility",
        "description": "Learning tools accessible to students worldwide."
    }
}

en_data['landing']['stats'] = {
    "satisfaction": "Teacher Satisfaction",
    "students": "Active Students",
    "dimensions": "Skill Dimensions"
}

en_data['landing']['cta'] = {
    "title": "Ready to transform your classroom?",
    "subtitle": "Join thousands of educators already using PerLeap to unlock their students' potential.",
    "button": "Start Free Trial"
}

en_data['landing']['footer'] = {
    "tagline": "Transforming education through AI-powered personalized learning.",
    "product": "Product",
    "features": "Features",
    "company": "Company",
    "legal": "Legal",
    "privacy": "Privacy",
    "terms": "Terms",
    "copyright": "© 2024 PerLeap. All rights reserved."
}

print('\n✅ Added missing landing page translations!')
print('Features keys:', list(en_data['landing']['features'].keys()))
print('Stats keys:', list(en_data['landing']['stats'].keys()))
print('CTA keys:', list(en_data['landing']['cta'].keys()))
print('Footer keys:', list(en_data['landing']['footer'].keys()))

# Write the updated structure
with open('./src/locales/en/translation.json', 'w', encoding='utf-8') as f:
    json.dump(en_data, f, ensure_ascii=False, indent=2)

print('\n✅ English translation file has been updated!')
