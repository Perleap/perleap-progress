# Remaining Work - Code Review

After reviewing the entire codebase, here's what still needs to be refactored to meet production standards.

## ⚠️ Critical Issues to Address

### 1. **Pages Still Use Direct Supabase Calls**

All page components still bypass the service layer we created:

**Files Affected:**
- `src/pages/teacher/TeacherDashboard.tsx` (255 lines)
- `src/pages/student/StudentDashboard.tsx` (502 lines) ⚠️ **VERY LARGE**
- `src/pages/teacher/ClassroomDetail.tsx` (554 lines) ⚠️ **VERY LARGE**
- `src/pages/student/AssignmentDetail.tsx`
- `src/pages/student/StudentClassroomDetail.tsx`
- `src/pages/teacher/SubmissionDetail.tsx`
- `src/pages/teacher/TeacherSettings.tsx`
- `src/pages/student/StudentSettings.tsx`
- `src/pages/onboarding/TeacherOnboarding.tsx` (320 lines)
- `src/pages/onboarding/StudentOnboarding.tsx`

**Problem:**
```typescript
// ❌ Current (direct Supabase calls in components)
const { data, error } = await supabase
  .from('classrooms')
  .select('*')
  .eq('teacher_id', user?.id);

// ✅ Should be (using services)
const { data, error } = await getTeacherClassrooms(user.id);

// ✅ Even better (using hooks)
const { classrooms, loading, error } = useClassrooms('teacher');
```

### 2. **Type Definitions Duplicated**

Each page defines its own interfaces instead of using centralized types:

**Problem:**
```typescript
// ❌ In TeacherDashboard.tsx
interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  _count?: { enrollments: number };
}

// ❌ In ClassroomDetail.tsx  
interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  course_title: string;
  // ... more fields
}

// ✅ Should be (from src/types/models.ts)
import type { Classroom } from '@/types';
```

### 3. **Large Components Need Splitting**

**ClassroomDetail.tsx (554 lines):**
Should be split using the components we already created:
- Use `ClassroomOverview` component
- Use `ClassroomAssignments` component
- Use `ClassroomStudents` component
- Currently: All logic inline

**StudentDashboard.tsx (502 lines):**
Needs splitting into:
- `StudentClassroomsList` component
- `StudentAssignmentsList` component
- `JoinClassroomDialog` component
- Currently: Everything in one file

### 4. **Missing Notification Service Integration**

There's a `notificationService` being imported but it's not in our services:

```typescript
// From TeacherDashboard.tsx line 17
import { getUnreadNotifications, markAsRead, markAllAsRead, type Notification } from "@/lib/notificationService";
```

**Action Needed:**
- Move to `src/services/notificationService.ts`
- Add proper types to `src/types/`
- Create `useNotifications` hook

### 5. **Components Not Using New Layouts**

Pages should use our new layout components:

**Current:**
```typescript
// Duplicated header code in every dashboard
<header className="border-b">
  <div className="container flex h-14 md:h-16 items-center justify-between px-4">
    <h1>Title</h1>
    {/* Profile, logout, etc */}
  </div>
</header>
```

**Should Be:**
```typescript
import { DashboardHeader } from '@/components/layouts';

<DashboardHeader
  title="Teacher Dashboard"
  avatarUrl={profile.avatar_url}
  initials={initials}
  onProfileClick={() => navigate('/teacher/settings')}
/>
```

### 6. **Existing Components Not Using New Pattern**

These components exist but haven't been refactored:

**Need Refactoring:**
- `CreateClassroomDialog.tsx`
- `EditClassroomDialog.tsx`
- `CreateAssignmentDialog.tsx`
- `EditAssignmentDialog.tsx`
- `SubmissionsTab.tsx`
- `ClassroomAnalytics.tsx` (still the old version, we created new split components)
- `AssignmentChatInterface.tsx`
- `RegenerateScoresButton.tsx`

**Should:**
- Use services instead of direct Supabase calls
- Use proper types from `@/types`
- Be split if > 200 lines
- Follow new patterns

## 📋 Detailed Refactoring Plan

### Phase 1: Update Core Services (High Priority)

1. **Move Notification Service**
```typescript
// Create src/services/notificationService.ts
export const getUnreadNotifications = async (userId: string) => {
  // Move logic from lib/notificationService
};
```

2. **Update Service Exports**
```typescript
// src/services/index.ts
export * from './notificationService';
```

### Phase 2: Update Dashboard Components

#### TeacherDashboard.tsx Refactoring

**Before (255 lines):**
- Direct Supabase calls
- Inline profile fetching
- Inline notification handling
- Duplicated types

**After (<150 lines):**
```typescript
import { useClassrooms, useProfile, useNotifications } from '@/hooks';
import { DashboardHeader, LoadingSpinner, EmptyState } from '@/components';
import type { Classroom } from '@/types';

const TeacherDashboard = () => {
  const { classrooms, loading } = useClassrooms('teacher');
  const { profile, initials } = useProfile('teacher');
  const { notifications, unreadCount } = useNotifications();

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Teacher Dashboard"
        avatarUrl={profile?.avatar_url}
        initials={initials}
        onProfileClick={() => navigate('/teacher/settings')}
        additionalActions={
          <NotificationDropdown 
            notifications={notifications}
            unreadCount={unreadCount}
          />
        }
      />
      {/* Simplified content */}
    </div>
  );
};
```

#### StudentDashboard.tsx Refactoring

**Before (502 lines):**
- Massive component with everything inline
- Direct Supabase calls
- Complex join classroom logic
- Multiple responsibilities

**After - Split into:**

1. **StudentDashboard.tsx (<150 lines)**
```typescript
const StudentDashboard = () => {
  const { classrooms, loading: classroomsLoading } = useClassrooms('student');
  const { assignments, loading: assignmentsLoading } = useStudentAssignments();
  const { profile, initials } = useProfile('student');
  
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Student Dashboard"
        avatarUrl={profile?.avatar_url}
        initials={initials}
        onProfileClick={() => navigate('/student/settings')}
      />
      <main className="container py-4 md:py-8 px-4">
        <StudentClassroomsList 
          classrooms={classrooms}
          loading={classroomsLoading}
        />
        <StudentAssignmentsList
          assignments={assignments}
          loading={assignmentsLoading}
        />
      </main>
    </div>
  );
};
```

2. **StudentClassroomsList.tsx (<100 lines)**
```typescript
export const StudentClassroomsList = ({ classrooms, loading }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div>
      <h2>My Classes</h2>
      {/* Classroom cards */}
      <JoinClassroomDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};
```

3. **JoinClassroomDialog.tsx (<100 lines)**
```typescript
import { joinClassroom, findClassroomByInviteCode, isStudentEnrolled } from '@/services';

export const JoinClassroomDialog = ({ open, onOpenChange }: Props) => {
  // All join logic here
};
```

#### ClassroomDetail.tsx Refactoring

**Before (554 lines):**
- Huge monolithic component
- All tabs inline
- Direct Supabase calls
- Complex state management

**After (<200 lines) - Use components we already created:**
```typescript
import { 
  ClassroomOverview, 
  ClassroomAssignments, 
  ClassroomStudents 
} from '@/components/features/classroom';
import { ClassroomAnalytics } from '@/components/features/analytics';
import { PageHeader } from '@/components/layouts';
import { useClassroom, useAssignments, useEnrolledStudents } from '@/hooks';

const ClassroomDetail = () => {
  const { id } = useParams();
  const { classroom, loading } = useClassroom(id);
  const { assignments, refetch: refetchAssignments } = useClassroomAssignments(id);
  const { students } = useEnrolledStudents(id);

  if (loading) return <LoadingSpinner />;
  if (!classroom) return <NotFound />;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={classroom.name}
        subtitle={classroom.subject}
        backTo="/teacher/dashboard"
      />
      <main className="container py-4 md:py-8 px-4">
        <Tabs defaultValue="overview">
          <TabsList>...</TabsList>
          <TabsContent value="overview">
            <ClassroomOverview 
              classroom={classroom}
              onEdit={() => setEditDialogOpen(true)}
            />
          </TabsContent>
          <TabsContent value="assignments">
            <ClassroomAssignments
              assignments={assignments}
              onCreateAssignment={() => setAssignmentDialogOpen(true)}
              onEditAssignment={handleEdit}
              onDeleteAssignment={handleDelete}
            />
          </TabsContent>
          {/* Other tabs using our components */}
        </Tabs>
      </main>
    </div>
  );
};
```

### Phase 3: Create Missing Hooks

**Hooks to Create:**

1. **useNotifications.ts**
```typescript
export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Implementation
  return { notifications, unreadCount, markAsRead, markAllAsRead };
};
```

2. **useClassroom.ts** (single classroom)
```typescript
export const useClassroom = (classroomId: string) => {
  const { user } = useAuth();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  // Fetch single classroom
  return { classroom, loading, error, refetch };
};
```

3. **useEnrolledStudents.ts**
```typescript
export const useEnrolledStudents = (classroomId: string) => {
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  // Fetch enrolled students with profiles
  return { students, loading, error, refetch };
};
```

### Phase 4: Refactor Existing Components

**For Each Component:**
1. Replace direct Supabase calls with services
2. Use types from `@/types`
3. Split if > 200 lines
4. Add JSDoc comments
5. Use proper error handling

**Priority Order:**
1. `ClassroomAnalytics.tsx` - Replace with our new split components
2. `AssignmentChatInterface.tsx` - Use `useConversation` hook
3. `CreateClassroomDialog.tsx` - Use `createClassroom` service
4. `CreateAssignmentDialog.tsx` - Use `createAssignment` service
5. `EditClassroomDialog.tsx` - Use `updateClassroom` service
6. `EditAssignmentDialog.tsx` - Use `updateAssignment` service

### Phase 5: Settings Pages

**Refactor Settings Pages:**
- `TeacherSettings.tsx`
- `StudentSettings.tsx`

**Should use:**
- `useProfile` hook
- `updateTeacherProfile` / `updateStudentProfile` services
- Common form components
- Proper validation

### Phase 6: Onboarding Pages

**Refactor:**
- `TeacherOnboarding.tsx` (320 lines)
- `StudentOnboarding.tsx`

**Should:**
- Split form sections into components
- Use services for profile creation
- Use `saveFiveDSnapshot` service
- Proper step navigation

## 🎯 Success Criteria

When refactoring is complete:

- ✅ All pages under 200 lines
- ✅ No direct Supabase calls in components
- ✅ All types from `@/types`
- ✅ All business logic in services
- ✅ All stateful logic in hooks
- ✅ Components focus on presentation only
- ✅ Consistent error handling
- ✅ No code duplication
- ✅ JSDoc comments on all functions
- ✅ Proper loading and empty states

## 📊 Current Progress

**Completed:**
- ✅ Configuration & tooling
- ✅ Directory structure
- ✅ Type system
- ✅ Service layer (core services)
- ✅ Custom hooks (core hooks)
- ✅ Edge functions refactored
- ✅ Common/Layout components
- ✅ Feature components (analytics, classroom)
- ✅ Documentation

**Remaining:**
- ⏳ Update all pages to use services/hooks
- ⏳ Refactor large dashboard components
- ⏳ Refactor dialog components
- ⏳ Create missing hooks
- ⏳ Replace old ClassroomAnalytics with new components
- ⏳ Refactor settings pages
- ⏳ Refactor onboarding pages
- ⏳ Add notification service
- ⏳ Final code cleanup

## 💡 Recommendations

### Immediate Actions:

1. **Create Missing Services/Hooks First**
   - Notification service & hook
   - Individual classroom hook
   - Enrolled students hook

2. **Refactor Dashboards**
   - Start with TeacherDashboard (simpler)
   - Then StudentDashboard (more complex)
   - Test thoroughly after each

3. **Update ClassroomDetail**
   - Use the components we already created
   - Should be straightforward

4. **Refactor Dialog Components**
   - Small, focused changes
   - Easy wins

5. **Settings & Onboarding Last**
   - Less critical
   - Can use patterns from dashboards

### Testing Strategy:

After each component refactor:
1. Test all user flows
2. Verify no regressions
3. Check error handling
4. Verify loading states
5. Test edge cases

## 📝 Notes

- The foundation is solid - services, hooks, types, and components are ready
- Most work is updating existing pages to use the new infrastructure
- Each refactor should be done incrementally and tested
- Focus on one page/component at a time
- Use the new components we created (ClassroomOverview, etc.)

## Next Steps

Start with Phase 1 (notification service) and work through each phase systematically. Each phase builds on the previous one.

