# Perleap - Educational Platform

An AI-powered educational platform based on the Quantum Education Doctrine, featuring personalized learning experiences and 5D student assessments.

## 📚 Documentation

All documentation is organized in the `docs/` folder:

1. **[Quick Start Guide](./docs/1-QUICK-START.md)** - Start here!
2. **[Frontend Architecture](./docs/2-FRONTEND-ARCHITECTURE.md)** - How the code is organized
3. **[Refactoring Summary](./docs/3-REFACTORING-SUMMARY.md)** - What was changed
4. **[Implementation Complete](./docs/4-IMPLEMENTATION-COMPLETE.md)** - Detailed implementation guide
5. **[Development Guide](./docs/5-DEVELOPMENT-GUIDE.md)** - How to add features
6. **[Remaining Work](./docs/6-REMAINING-WORK.md)** - What still needs to be done

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🏗️ Project Structure

```
perleap-progress/
├── src/
│   ├── api/              # API client layer
│   ├── config/           # Constants & routes
│   ├── services/         # Business logic services
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript definitions
│   ├── components/       # UI components
│   └── pages/            # Page components
├── supabase/
│   └── functions/        # Edge functions
├── docs/                 # Documentation
└── README.md             # This file
```

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + Shadcn/UI
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **AI**: OpenAI GPT-4 Turbo
- **State**: React Query + Custom Hooks

## 📖 Key Features

- **AI-Powered Conversations**: Interactive learning with OpenAI
- **5D Student Assessment**: Multi-dimensional student evaluation
- **Real-Time Feedback**: Instant personalized feedback for students and teachers
- **Classroom Management**: Complete classroom and assignment management
- **Analytics Dashboard**: Comprehensive student progress tracking

## 🔧 Development

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Code Style

This project follows the Airbnb JavaScript/React Style Guide with:
- TypeScript strict mode
- 2-space indentation
- 100 character line length
- Comprehensive type definitions

See [Development Guide](./docs/5-DEVELOPMENT-GUIDE.md) for detailed coding standards.

## 📦 Deployment

### Frontend (Vercel)

```bash
npm run build
# Deploy to Vercel
```

### Edge Functions (Supabase)

```bash
supabase functions deploy perleap-chat
supabase functions deploy generate-feedback
```

## 🔐 Environment Variables

Required environment variables:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Edge Functions (set in Supabase dashboard)
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4-turbo-preview (optional)
```

## 🧪 Testing (Future)

```bash
npm run test        # Run unit tests
npm run test:e2e    # Run end-to-end tests
npm run test:cover  # Run with coverage
```

## 📄 License

Proprietary - All rights reserved

## 👥 Team

Perleap Development Team

## 📞 Support

For questions or issues, please refer to the documentation in the `docs/` folder.

---

**Note**: This project has been refactored from MVP to production-ready code. See [Refactoring Summary](./docs/3-REFACTORING-SUMMARY.md) for details.
