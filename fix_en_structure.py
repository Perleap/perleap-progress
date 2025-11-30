import json

# Read the current English translation file
with open('./src/locales/en/translation.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

print('Current structure - Top level keys:', list(en_data.keys()))
print('Keys inside landing:', list(en_data.get('landing', {}).keys())[:10], '...')

# Extract auth-related content from landing.hero to create a proper auth section
hero = en_data['landing'].get('hero', {})
auth_section = {
    "welcome": "Welcome to PerLeap",
    "tagline": "Transform education with AI-powered teaching and personalized learning experiences",
    "backToHome": "Back to Home",
    "subtitle": "Sign in to your account or create a new one",
    "signIn": hero.get('signIn', 'Sign In'),
    "signUp": hero.get('signUp', 'Sign Up'),
    "email": hero.get('email', 'Email'),
    "emailPlaceholder": hero.get('emailPlaceholder', 'you@example.com'),
    "password": hero.get('password', 'Password'),
    "signInButton": hero.get('signInButton', 'Sign In'),
    "signInWithGoogle": hero.get('signInWithGoogle', 'Sign in with Google'),
    "createAccount": hero.get('createAccount', 'Create Account'),
    "signUpWithGoogle": hero.get('signUpWithGoogle', 'Sign up with Google'),
    "orContinueWith": hero.get('orContinueWith', 'Or continue with'),
    "orSignUpWith": hero.get('orSignUpWith', 'Or sign up with'),
    "iAmA": hero.get('iAmA', 'I am a...'),
    "teacher": hero.get('teacher', 'Teacher'),
    "student": hero.get('student', 'Student'),
    "selectLanguage": hero.get('selectLanguage', 'Select your preferred language'),
    "english": hero.get('english', 'English'),
    "hebrew": hero.get('hebrew', 'עברית (Hebrew)'),
    "errors": hero.get('errors', {}),
    "errors2": hero.get('errors2', {}),
    "success": hero.get('success', {})
}

# Create proper landing section (only nav, hero with landing content, mission, features, stats, cta, footer)
landing_section = {
    "nav": en_data['landing'].get('nav', {}),
    "hero": {
        "title1": "Agentic AI for",
        "title2": "Education",
        "subtitle": "Empower your institution with intelligent agents that automate grading, personalize learning, and transform the educational experience.",
        "getStarted": "Get Started",
        "learnMore": "Learn More",
        "badge": "Introducing Perleap AI 2.0",
        "contactUs": "Contact Us"
    },
    "mission": "At Perleap, we empower teachers to create intelligent, personalized AI agents, built to reflect their voice, goals, and style in every classroom.",
    "features": en_data['landing'].get('features', {}),
    "stats": en_data['landing'].get('stats', {}),
    "cta": en_data['landing'].get('cta', {}),
    "footer": en_data['landing'].get('footer', {})
}

# Build the corrected structure with all sections at root level
corrected_structure = {
    "landing": landing_section,
    "auth": auth_section
}

# Extract all other sections from landing and add them as top-level keys
sections_to_extract = [
    'studentDashboard', 'teacherDashboard', 'assignmentChat', 'calendar',
    'createClassroom', 'editClassroom', 'createAssignment', 'editAssignment',
    'classroomDetail', 'submissionsTab', 'submissionCard', 'submissionDetail',
    'assignmentDetail', 'studentClassroom', 'settings', 'analytics', 'wellbeing',
    'onboarding', 'common', 'dimensions', 'cra', 'studentOnboarding',
    'teacherOnboarding', 'studentAnalytics', 'classroomAnalytics', 'aboutUs',
    'assignments', 'notifications', 'assignmentTypes'
]

for section in sections_to_extract:
    if section in en_data['landing']:
        corrected_structure[section] = en_data['landing'][section]

print('\nNew structure - Top level keys:', list(corrected_structure.keys()))
print('Total top-level keys:', len(corrected_structure.keys()))

# Write the corrected structure
with open('./src/locales/en/translation.json', 'w', encoding='utf-8') as f:
    json.dump(corrected_structure, f, ensure_ascii=False, indent=2)

print('\n✅ English translation file has been restructured!')
