# Perleap Documentation Index

Welcome to the Perleap documentation! This index helps you navigate all documentation files.

## 📖 Documentation Files (In Order)

### For New Engineers

1. **[Quick Start Guide](./1-QUICK-START.md)** ⭐ **START HERE**
   - Overview of the project
   - Quick navigation guide
   - Key technologies
   - Project structure

2. **[Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md)**
   - Detailed architecture explanation
   - Directory structure
   - Design patterns
   - Code organization principles

3. **[Development Guide](./5-DEVELOPMENT-GUIDE.md)** *(if present)*
   - How to add new features
   - Code style guidelines
   - Common patterns
   - Best practices
   - Examples and templates

### For Understanding the Refactoring

4. **[Refactoring Summary](./3-REFACTORING-SUMMARY.md)**
   - What was changed and why
   - Before vs After comparisons
   - Architecture improvements
   - Key metrics

5. **[Implementation Complete](./4-IMPLEMENTATION-COMPLETE.md)**
   - Complete list of what was implemented
   - All files created
   - Success criteria
   - How to use the new architecture

### For Continuing Development

6. **[Remaining Work](./6-REMAINING-WORK.md)**
   - Post-refactor backlog (dialogs, legacy components)
   - Verify-perleap regression matrix
   - Ongoing conventions

## 🎯 Quick Reference by Task

### "I'm new to the project"
→ Start with [Quick Start](./1-QUICK-START.md), then [Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md)

### "I need to add a new feature"
→ Read [Development Guide](./5-DEVELOPMENT-GUIDE.md)

### "I need to understand what was refactored"
→ Read [Refactoring Summary](./3-REFACTORING-SUMMARY.md) and [Implementation Complete](./4-IMPLEMENTATION-COMPLETE.md)

### "I need to continue development after the page refactor"
→ Read [Remaining Work](./6-REMAINING-WORK.md) for the post-M backlog

### "I need to understand the architecture"
→ Read [Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md)

## 📊 Refactoring Status

### ✅ Completed (Phase 1 + page refactors A–M)
- Configuration & tooling setup
- Directory structure and feature modules under `components/features/`
- Type system and service layer (including onboarding, planner, submission services)
- Custom hooks and edge function refactors
- Page shells → `*Content` orchestrators for all major product routes
- Feature barrels, shared dashboard helpers (`classroomViewMode`), i18n polish
- verify-perleap features for classroom, assignment, activity, submission flows

### ⏳ Backlog (post-refactor)
- Root-level dialogs and legacy components (see [Remaining Work](./6-REMAINING-WORK.md))
- Marketing pages (low priority)
- Optional admin monitoring file renames

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────┐
│         Components (Presentation)        │
│         - Pure UI, no business logic    │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          Custom Hooks (State)            │
│          - State management             │
│          - Side effects                  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│        Services (Business Logic)         │
│        - API calls                       │
│        - Data transformation            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         API Client (Data Access)         │
│         - Supabase integration          │
└─────────────────────────────────────────┘
```

## 🔍 Finding Information

### By Topic

**Configuration**
- [Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md) - Configuration section

**Services**
- [Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md) - Service pattern
- [Development Guide](./5-DEVELOPMENT-GUIDE.md) - Creating services

**Hooks**
- [Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md) - Hook pattern
- [Development Guide](./5-DEVELOPMENT-GUIDE.md) - Creating hooks

**Components**
- [Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md) - Component pattern
- [Development Guide](./5-DEVELOPMENT-GUIDE.md) - Creating components

**Code Style**
- [Development Guide](./5-DEVELOPMENT-GUIDE.md) - Code style guidelines
- [Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md) - Style guide section

**What Needs Work**
- [Remaining Work](./6-REMAINING-WORK.md) - Complete breakdown

## 📝 Document Summaries

| Document | Lines | Purpose | Audience |
|----------|-------|---------|----------|
| 1-QUICK-START.md | 120 | Entry point, overview | Everyone |
| 2-FRONTEND-ARCHITECTURE.md | 300 | Architecture details | Developers |
| 3-REFACTORING-SUMMARY.md | 250 | What changed | Everyone |
| 4-IMPLEMENTATION-COMPLETE.md | 450 | Implementation details | Technical leads |
| 5-DEVELOPMENT-GUIDE.md | 400 | How to develop | Developers |
| 6-REMAINING-WORK.md | ~120 | Post-refactor backlog | Technical leads |

## 🚀 Next Steps

1. **For New Engineers:**
   - Read Quick Start → Architecture → Development Guide
   - Review existing code patterns
   - Start with small tasks from Remaining Work

2. **For ongoing product work:**
   - Follow [Frontend Architecture](./2-FRONTEND-ARCHITECTURE.md) page-shell pattern
   - Pick items from [Remaining Work](./6-REMAINING-WORK.md) backlog as needed
   - Run unit tests + verify-perleap smoke for touched routes

3. **For Adding Features:**
   - Follow patterns in Development Guide
   - Use existing services and hooks
   - Keep components small and focused

## 💡 Tips

- All docs are interconnected - use links to navigate
- Start with Quick Start for overview
- Refer to Development Guide when coding
- Check Remaining Work before starting new tasks
- Keep this index as your navigation hub

## 📞 Support

Questions? Check relevant documentation first, then ask team members.

---

**Last Updated**: Aug 2026 (Track M complete)
**Status**: Page refactor tracks A–M complete; see Remaining Work for backlog

