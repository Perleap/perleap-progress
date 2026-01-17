-- Create activity types enum
create type activity_type as enum (
  'create',
  'update',
  'delete',
  'view'
);

-- Create entity types enum
create type entity_type as enum (
  'classroom',
  'assignment',
  'submission',
  'student'
);

-- Create table
create table activity_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users not null,
  type activity_type not null,
  entity_type entity_type not null,
  entity_id uuid not null,
  title text not null,
  route text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

-- Index for fast retrieval of recent events per teacher
create index activity_events_teacher_created_idx on activity_events (teacher_id, created_at desc);

-- RLS
alter table activity_events enable row level security;

create policy "Teachers can view their own activity"
  on activity_events for select
  using (auth.uid() = teacher_id);

create policy "Teachers can insert their own activity"
  on activity_events for insert
  with check (auth.uid() = teacher_id);
