# Development Guide

This guide shows you how to work with the refactored Perleap codebase and add new features following the established patterns.

## Adding a New Feature

Follow these steps to add a new feature to the application:

### 1. Define Types (`src/types/`)

Add your domain models and API types:

```typescript
// src/types/models.ts
export interface NewFeature {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

// src/types/api.types.ts
export interface CreateNewFeatureInput {
  name: string;
  description: string;
}
```

### 2. Create Service (`src/services/`)

Create a service to handle all business logic:

```typescript
// src/services/newFeatureService.ts
import { supabase, handleSupabaseError } from '@/api/client';
import type { NewFeature, CreateNewFeatureInput, ApiError } from '@/types';

/**
 * Fetch all features for a user
 */
export const getUserFeatures = async (
  userId: string,
): Promise<{ data: NewFeature[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('new_features')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Create a new feature
 */
export const createFeature = async (
  userId: string,
  input: CreateNewFeatureInput,
): Promise<{ data: NewFeature | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('new_features')
      .insert([{ ...input, user_id: userId }])
      .select()
      .single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

// Export from src/services/index.ts
export * from './newFeatureService';
```

### 3. Create Custom Hook (`src/hooks/`)

Create a hook if you need state management:

```typescript
// src/hooks/useFeatures.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserFeatures } from '@/services';
import type { NewFeature, ApiError } from '@/types';

interface UseFeaturesResult {
  features: NewFeature[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user features
 */
export const useFeatures = (): UseFeaturesResult => {
  const { user } = useAuth();
  const [features, setFeatures] = useState<NewFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchFeatures = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getUserFeatures(user.id);

    if (fetchError) {
      setError(fetchError);
    } else {
      setFeatures(data || []);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  return {
    features,
    loading,
    error,
    refetch: fetchFeatures,
  };
};

// Export from src/hooks/index.ts
export * from './useFeatures';
```

### 4. Create Components (`src/components/features/`)

Build focused, reusable components:

```typescript
// src/components/features/feature/FeatureCard.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { NewFeature } from '@/types';

interface FeatureCardProps {
  feature: NewFeature;
  onClick?: () => void;
}

/**
 * Display a single feature card
 */
export const FeatureCard = ({ feature, onClick }: FeatureCardProps) => {
  return (
    <Card onClick={onClick} className="cursor-pointer hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle>{feature.name}</CardTitle>
        <CardDescription>
          Created: {new Date(feature.created_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{feature.description}</p>
      </CardContent>
    </Card>
  );
};

// src/components/features/feature/FeatureList.tsx
import { EmptyState, LoadingSpinner } from '@/components/common';
import { FeatureCard } from './FeatureCard';
import { Plus } from 'lucide-react';
import type { NewFeature } from '@/types';

interface FeatureListProps {
  features: NewFeature[];
  loading: boolean;
  onFeatureClick: (feature: NewFeature) => void;
  onCreateClick: () => void;
}

/**
 * Display list of features
 */
export const FeatureList = ({
  features,
  loading,
  onFeatureClick,
  onCreateClick,
}: FeatureListProps) => {
  if (loading) {
    return <LoadingSpinner text="Loading features..." />;
  }

  if (features.length === 0) {
    return (
      <EmptyState
        icon={Plus}
        title="No features yet"
        description="Create your first feature to get started"
        action={{
          label: 'Create Feature',
          onClick: onCreateClick,
        }}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <FeatureCard
          key={feature.id}
          feature={feature}
          onClick={() => onFeatureClick(feature)}
        />
      ))}
    </div>
  );
};
```

### 5. Create Page (`src/pages/`)

Put it all together in a page component:

```typescript
// src/pages/FeaturesPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layouts';
import { FeatureList } from '@/components/features/feature';
import { useFeatures } from '@/hooks';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { NewFeature } from '@/types';

/**
 * Features management page
 */
export const FeaturesPage = () => {
  const navigate = useNavigate();
  const { features, loading, error, refetch } = useFeatures();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleFeatureClick = (feature: NewFeature) => {
    navigate(`/features/${feature.id}`);
  };

  const handleCreateClick = () => {
    setDialogOpen(true);
  };

  if (error) {
    toast.error(error.message);
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Features"
        subtitle="Manage your features"
        backTo="/dashboard"
        actions={
          <Button onClick={handleCreateClick} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create Feature
          </Button>
        }
      />

      <main className="container py-4 md:py-8 px-4">
        <FeatureList
          features={features}
          loading={loading}
          onFeatureClick={handleFeatureClick}
          onCreateClick={handleCreateClick}
        />
      </main>

      {/* Add dialog for creating features */}
    </div>
  );
};
```

## Code Style Guidelines

### TypeScript

```typescript
// ✅ Good: Explicit types
const getUserName = (user: User): string => {
  return user.name;
};

// ❌ Bad: Implicit any
const getUserName = (user) => {
  return user.name;
};

// ✅ Good: Proper null handling
const name = user?.name ?? 'Unknown';

// ❌ Bad: No null check
const name = user.name;
```

### React Components

```typescript
// ✅ Good: Props interface, proper structure
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const MyButton = ({ label, onClick, disabled = false }: ButtonProps) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};

// ❌ Bad: No types, inline props
export const MyButton = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};
```

### Service Functions

```typescript
// ✅ Good: Proper error handling, types
export const getData = async (
  id: string,
): Promise<{ data: Data | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

// ❌ Bad: No error handling, throws errors
export const getData = async (id) => {
  const { data } = await supabase.from('table').select('*').eq('id', id).single();
  return data;
};
```

## Common Patterns

### Error Handling

```typescript
// In components
const { data, error } = await someService();

if (error) {
  toast.error(error.message);
  return;
}

// Use data
```

### Loading States

```typescript
// In components
if (loading) {
  return <LoadingSpinner />;
}

if (error) {
  return <div>Error: {error.message}</div>;
}

return <YourContent data={data} />;
```

### Empty States

```typescript
// In list components
if (items.length === 0) {
  return (
    <EmptyState
      icon={IconComponent}
      title="No items"
      description="Get started by creating one"
      action={{
        label: 'Create',
        onClick: handleCreate,
      }}
    />
  );
}
```

## Best Practices

### 1. Keep Components Small
- Max 200 lines per component
- Split into smaller components if needed
- Use composition

### 2. Single Responsibility
- Each function/component does one thing
- Easy to test and maintain
- Clear purpose

### 3. Type Everything
- No `any` types
- Proper interfaces for all data
- Use TypeScript features

### 4. Consistent Naming
- Components: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: Match component name

### 5. Use Existing Patterns
- Follow the established service/hook/component pattern
- Reuse common components
- Don't reinvent the wheel

### 6. Document Your Code
- JSDoc for exported functions
- Comments for complex logic
- Clear variable names

## Testing (Future)

```typescript
// Unit test example for service
describe('getUserFeatures', () => {
  it('should fetch features successfully', async () => {
    const { data, error } = await getUserFeatures('user-id');
    
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

// Component test example
describe('FeatureCard', () => {
  it('should render feature information', () => {
    const feature = { id: '1', name: 'Test', description: 'Desc' };
    render(<FeatureCard feature={feature} />);
    
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## Useful Commands

```bash
# Development
npm run dev

# Build
npm run build

# Lint
npm run lint

# Format code
npx prettier --write .

# Deploy edge functions
supabase functions deploy function-name
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React Docs](https://react.dev/)
- [Airbnb Style Guide](https://github.com/airbnb/javascript)
- [Supabase Docs](https://supabase.com/docs)

## Getting Help

- Check existing code for patterns
- Review the architecture documentation
- Ask team members
- Refer to TypeScript/React docs

