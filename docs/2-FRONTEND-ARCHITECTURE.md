# Perleap Frontend Architecture

This document outlines the refactored architecture of the Perleap educational platform frontend.

## Directory Structure

```
src/
├── api/              # API client & Supabase abstraction
│   └── client.ts     # Supabase client with error handling
├── components/       # React components
│   ├── common/       # Reusable UI components
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── ProfileAvatar.tsx
│   ├── features/     # Feature-specific components (barrel: index.ts per module)
│   │   ├── admin/       # AI prompts, platform monitoring
│   │   ├── analytics/   # Classroom analytics, lesson brief, pilot report
│   │   ├── assignment/  # Assignment detail, submissions, wizard
│   │   ├── auth/        # Sign-in, callback, role selection
│   │   ├── classroom/   # Teacher/student classroom detail sections
│   │   ├── dashboard/   # Dashboard content and classroom list views
│   │   ├── langchain/   # Visual pipeline editor
│   │   ├── liveSession/ # Live session teacher flow
│   │   ├── onboarding/  # Student/teacher onboarding wizards
│   │   ├── planner/     # Teacher assignment calendar
│   │   ├── settings/    # Student/teacher settings tabs
│   │   ├── submission/  # Submission detail tabs
│   │   ├── syllabus/    # Syllabus editor, activity page
│   │   └── index.ts     # Re-exports all feature modules
│   ├── layouts/      # Layout components
│   │   ├── DashboardHeader.tsx
│   │   └── PageHeader.tsx
│   └── ui/           # Shadcn UI components
├── config/           # App configuration & constants
│   ├── constants.ts  # Application constants
│   └── routes.ts     # Route definitions
├── contexts/         # React contexts
│   └── AuthContext.tsx
├── hooks/            # Custom React hooks
│   ├── useAssignments.ts
│   ├── useClassrooms.ts
│   ├── useConversation.ts
│   └── useProfile.ts
├── integrations/     # External integrations
│   └── supabase/
├── lib/              # Utility functions
│   └── utils.ts
├── pages/            # Page components
│   ├── onboarding/
│   ├── student/
│   └── teacher/
├── services/         # Business logic & data services
│   ├── analyticsService.ts
│   ├── assignmentService.ts
│   ├── classroomService.ts
│   ├── profileService.ts
│   ├── onboardingService.ts
│   ├── plannerService.ts
│   └── submissionService.ts
└── types/            # TypeScript type definitions
    ├── api.types.ts
    └── models.ts
```

## Architecture Principles

### 1. Separation of Concerns

- **Services**: Handle all business logic and API calls
- **Hooks**: Manage state and side effects
- **Components**: Pure presentation layer
- **Types**: Centralized type definitions

### 2. Code Organization

- Components under 200 lines
- Functions under 50 lines
- Clear single responsibility
- Proper abstraction layers

### 3. TypeScript Strict Mode

- No `any` types
- Strict null checks
- Proper type annotations
- Type-safe API calls

### 4. Style Guide

Following Airbnb JavaScript/React Style Guide:
- 2-space indentation
- Single quotes
- Trailing commas
- 100 character line length
- Semicolons required

## Key Patterns

### Service Pattern

Services encapsulate all data operations:

```typescript
// services/classroomService.ts
export const getClassroomById = async (
  classroomId: string,
  teacherId: string,
): Promise<{ data: Classroom | null; error: ApiError | null }> => {
  // Implementation
};
```

### Hook Pattern

Custom hooks manage stateful logic:

```typescript
// hooks/useClassrooms.ts
export const useClassrooms = (role: 'teacher' | 'student') => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  // ... fetch logic
  return { classrooms, loading, error, refetch };
};
```

### Page shell → Content pattern

Refactored routes use a thin page shell and a feature orchestrator:

```typescript
// src/pages/teacher/ClassroomDetail.tsx (~30 lines)
import { ClassroomDetailContent } from '@/components/features/classroom';

export default function ClassroomDetail() {
  const { id } = useParams();
  // loading / null guards, normalize route params
  return <ClassroomDetailContent classroomId={id!} />;
}
```

- **Page:** routing, auth guards, lazy-load boundary, minimal props
- **`*Content`:** hooks, layout, section routing, dialog state
- **Sections / dialogs:** presentational UI; callbacks from content
- **Imports:** pages use `@/components/features/<feature>` barrels, not deep paths

Shared helpers (e.g. classroom list view modes) live in `src/lib/` (`classroomViewMode.ts`).

### Component Pattern

Components focus on presentation:

```typescript
export const ClassroomOverviewSection = ({ classroom }: Props) => {
  // Pure presentation, no direct Supabase calls
  return <Card>...</Card>;
};
```

## Configuration

### Constants

All magic strings and numbers are in `src/config/constants.ts`:

```typescript
export const INVITE_CODE_LENGTH = 6;
export const LEARNING_DIMENSIONS = {
  COGNITIVE: 'cognitive',
  EMOTIONAL: 'emotional',
  // ...
};
```

### Routes

All routes are defined in `src/config/routes.ts`:

```typescript
export const ROUTES = {
  TEACHER_DASHBOARD: '/teacher/dashboard',
  // ...
};

export const buildRoute = {
  teacherClassroom: (id: string) => `/teacher/classroom/${id}`,
};
```

## Error Handling

Consistent error handling across the application:

```typescript
try {
  const { data, error } = await someService();
  if (error) {
    toast.error(error.message);
    return;
  }
  // Handle data
} catch (error) {
  console.error('Unexpected error:', error);
  toast.error('An unexpected error occurred');
}
```

## Component Guidelines

### 1. Props Interface

Always define prop interfaces:

```typescript
interface MyComponentProps {
  title: string;
  onAction: () => void;
  optional?: boolean;
}
```

### 2. JSDoc Comments

Document all exported functions:

```typescript
/**
 * Fetch classrooms for a teacher
 * @param teacherId - The teacher's user ID
 * @returns Promise with classrooms data and error
 */
export const getTeacherClassrooms = async (teacherId: string) => {
  // Implementation
};
```

### 3. Component Structure

```typescript
// 1. Imports
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { MyType } from '@/types';

// 2. Types/Interfaces
interface MyComponentProps {
  // ...
}

// 3. Component
export const MyComponent = ({ prop1, prop2 }: MyComponentProps) => {
  // Hooks
  const [state, setState] = useState();

  // Event handlers
  const handleClick = () => {
    // ...
  };

  // Render
  return <div>...</div>;
};
```

## Performance

- React.memo for expensive components
- useMemo/useCallback for optimizations
- Lazy loading for routes
- Code splitting

## Contributing

When adding new features:

1. Add types to `src/types/`
2. Create services in `src/services/`
3. Create custom hooks if needed
4. Build components using existing patterns
5. Follow ESLint and Prettier rules
6. Add JSDoc comments

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

