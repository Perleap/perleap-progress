const fs = require('fs');

// Read the current English translation file
const enPath = './src/locales/en/translation.json';
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

console.log('Current structure - Top level keys:', Object.keys(enData));
console.log('Keys inside landing:', Object.keys(enData.landing || {}));

// The problem: everything is nested inside 'landing'
// We need to extract the correct sections and restructure

// Extract the landing.hero auth-related content to create a proper auth section
const authSection = {
    welcome: "Welcome to PerLeap",
    tagline: "Transform education with AI-powered teaching and personalized learning experiences",
    backToHome: "Back to Home",
    subtitle: "Sign in to your account or create a new one",
    signIn: enData.landing.hero.signIn || "Sign In",
    signUp: enData.landing.hero.signUp || "Sign Up",
    email: enData.landing.hero.email || "Email",
    emailPlaceholder: enData.landing.hero.emailPlaceholder || "you@example.com",
    password: enData.landing.hero.password || "Password",
    signInButton: enData.landing.hero.signInButton || "Sign In",
    signInWithGoogle: enData.landing.hero.signInWithGoogle || "Sign in with Google",
    createAccount: enData.landing.hero.createAccount || "Create Account",
    signUpWithGoogle: enData.landing.hero.signUpWithGoogle || "Sign up with Google",
    orContinueWith: enData.landing.hero.orContinueWith || "Or continue with",
    orSignUpWith: enData.landing.hero.orSignUpWith || "Or sign up with",
    iAmA: enData.landing.hero.iAmA || "I am a...",
    teacher: enData.landing.hero.teacher || "Teacher",
    student: enData.landing.hero.student || "Student",
    selectLanguage: enData.landing.hero.selectLanguage || "Select your preferred language",
    english: enData.landing.hero.english || "English",
    hebrew: enData.landing.hero.hebrew || "עברית (Hebrew)",
    errors: enData.landing.hero.errors || {},
    errors2: enData.landing.hero.errors2 || {},
    success: enData.landing.hero.success || {}
};

// Create proper landing section (only nav and hero with landing-specific content)
const landingSection = {
    nav: enData.landing.nav,
    hero: {
        title1: "Agentic AI for",
        title2: "Education",
        subtitle: "Empower your institution with intelligent agents that automate grading, personalize learning, and transform the educational experience.",
        getStarted: "Get Started",
        learnMore: "Learn More",
        badge: "Introducing Perleap AI 2.0",
        contactUs: "Contact Us"
    },
    mission: "At Perleap, we empower teachers to create intelligent, personalized AI agents, built to reflect their voice, goals, and style in every classroom.",
    features: enData.landing.features || {},
    stats: enData.landing.stats || {},
    cta: enData.landing.cta || {},
    footer: enData.landing.footer || {}
};

// Now extract all other sections that were incorrectly nested in landing
const correctedStructure = {
    landing: landingSection,
    auth: authSection,
    studentDashboard: enData.landing.studentDashboard,
    teacherDashboard: enData.landing.teacherDashboard,
    assignmentChat: enData.landing.assignmentChat,
    calendar: enData.landing.calendar,
    createClassroom: enData.landing.createClassroom,
    editClassroom: enData.landing.editClassroom,
    createAssignment: enData.landing.createAssignment,
    editAssignment: enData.landing.editAssignment,
    classroomDetail: enData.landing.classroomDetail,
    submissionsTab: enData.landing.submissionsTab,
    submissionCard: enData.landing.submissionCard,
    submissionDetail: enData.landing.submissionDetail,
    assignmentDetail: enData.landing.assignmentDetail,
    studentClassroom: enData.landing.studentClassroom,
    settings: enData.landing.settings,
    analytics: enData.landing.analytics,
    wellbeing: enData.landing.wellbeing,
    onboarding: enData.landing.onboarding,
    common: enData.landing.common,
    dimensions: enData.landing.dimensions,
    cra: enData.landing.cra,
    studentOnboarding: enData.landing.studentOnboarding,
    teacherOnboarding: enData.landing.teacherOnboarding,
    studentAnalytics: enData.landing.studentAnalytics,
    classroomAnalytics: enData.landing.classroomAnalytics,
    aboutUs: enData.landing.aboutUs,
    assignments: enData.landing.assignments,
    notifications: enData.landing.notifications,
    assignmentTypes: enData.landing.assignmentTypes
};

console.log('\nNew structure - Top level keys:', Object.keys(correctedStructure));
console.log('Total top-level keys:', Object.keys(correctedStructure).length);

// Write the corrected structure
fs.writeFileSync(enPath, JSON.stringify(correctedStructure, null, 2));
console.log('\n✅ English translation file has been restructured!');
