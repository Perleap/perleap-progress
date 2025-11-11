# Quick Start Guide

This is your starting point for understanding the Perleap codebase after the refactoring.

## Overview

Perleap is an educational platform powered by the Quantum Education Doctrine, featuring AI-assisted learning through conversational interfaces and 5D student assessments.

## What Was Done

The codebase was comprehensively refactored from MVP to production-ready code:
- ✅ Strict TypeScript with proper types
- ✅ Clean architecture with 4 layers
- ✅ Services for all business logic
- ✅ Custom hooks for state management
- ✅ Reusable components
- ✅ Refactored edge functions
- ✅ Comprehensive documentation

## Quick Navigation

1. **[Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md)** - How the frontend is organized
2. **[Refactoring Summary](./3-REFACTORING-SUMMARY.md)** - What changed and why
3. **[Implementation Details](./4-IMPLEMENTATION-COMPLETE.md)** - Complete implementation guide
4. **[Development Guide](./5-DEVELOPMENT-GUIDE.md)** - How to add new features

## Getting Started

### For New Developers

1. Read the [Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md) to understand the structure
2. Review the [Development Guide](./5-DEVELOPMENT-GUIDE.md) for coding patterns
3. Check the [Implementation Details](./4-IMPLEMENTATION-COMPLETE.md) for what's been built

### For Continuing Development

1. The codebase follows Airbnb JavaScript/React style guide
2. All business logic is in `src/services/`
3. Use custom hooks from `src/hooks/`
4. Keep components under 200 lines
5. Use TypeScript strict mode

## Project Structure

```
perleap-progress/
├── src/
│   ├── api/              # API client layer
│   ├── config/           # Constants & routes
│   ├── services/         # Business logic
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript definitions
│   ├── components/       # UI components
│   │   ├── common/       # Reusable components
│   │   ├── layouts/      # Layout components
│   │   └── features/     # Feature-specific components
│   └── pages/            # Page components
├── supabase/
│   └── functions/        # Edge functions
│       └── _shared/      # Shared utilities
└── docs/                 # Documentation (you are here)
```

## Key Technologies

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + Shadcn/UI
- **State**: React Query + Custom Hooks
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **AI**: OpenAI GPT-4 Turbo

## Next Steps

### ⚠️ CRITICAL: Deploy Edge Functions

**The application REQUIRES 5 edge functions to be deployed:**

```bash
supabase functions deploy perleap-chat
supabase functions deploy generate-feedback
supabase functions deploy regenerate-scores
supabase functions deploy generate-followup-assignment
supabase functions deploy analyze-student-wellbeing
```

**See [Edge Functions Guide](./EDGE_FUNCTIONS_GUIDE.md) for complete deployment instructions.**

### Other Tasks
- Review components to integrate new services/hooks
- Add tests for critical paths
- Set up monitoring and error tracking

## Support

For questions about the refactoring, refer to the detailed documentation files in this folder.

