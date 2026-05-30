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

### Edge Functions (Supabase) ⚠️ REQUIRED

**You MUST deploy all 5 edge functions for the app to work!**

```bash
# Deploy all critical functions
supabase functions deploy perleap-chat
supabase functions deploy generate-feedback
supabase functions deploy regenerate-scores
supabase functions deploy generate-followup-assignment
supabase functions deploy analyze-student-wellbeing
```

**See [Edge Functions Guide](./docs/EDGE_FUNCTIONS_GUIDE.md) for detailed instructions.**

## 🔐 Environment Variables

Required environment variables:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Edge Functions (set in Supabase dashboard)
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5.4

# Optional: Opik Cloud tracing for LLM edge functions (https://www.comet.com/docs/opik/reference/rest-api/overview)
# Shared secrets; each function POSTs traces asynchronously (failures never break the handler).
OPIK_API_KEY=your_opik_api_key
OPIK_WORKSPACE=your_comet_workspace_name
# Optional Opik overrides:
# OPIK_PROJECT_NAME=pearleap-student-chat
# OPIK_ENVIRONMENT=production
# OPIK_URL_OVERRIDE=https://www.comet.com/opik/api
# OPIK_TRACE_DISABLE=true

# If Chat Completions streaming returns 400 on stream_options, disable usage-on-stream (perleap-chat only):
# PERLEAP_CHAT_STREAM_USAGE=false

# Log the provider/model/usage/cost sent to Opik for each LLM call (stdout, debugging only):
# OPIK_COST_DEBUG=true
```

After changing secrets, redeploy edge functions that emit traces. If `OPENAI_MODEL` is unset, the code default is `gpt-5.4`. Opik posts are fire-and-forget (`queueOpikTrace` in `supabase/functions/shared/opikTrace.ts`); they never block the HTTP response when Opik is down. Traces include `metadata.edge_function`, `metadata.openai_usage` when the OpenAI chat completion returns usage, and `metadata.perleap_client_trace_id` for correlation. **Trace `name`** examples: `perleap-chat.reply`, `generate-feedback.main`, `generate-feedback.hard-skills`, `text-to-speech.synthesis` (no usage on audio). Filter in the Opik UI by project, tag, or `metadata.edge_function`.

**Cost tracking (estimated cost in the Opik dashboard):** for each LLM call we also emit a child span with `type: "llm"`, `provider`, the resolved `model` (`resolveChatModel` in `supabase/functions/shared/openai.ts`), and normalized token `usage` (`prompt_tokens`/`completion_tokens`/`total_tokens` via `normalizeOpikTokenUsage`, which maps OpenAI Chat, OpenAI Responses `input_tokens`/`output_tokens`, and Gemini `promptTokenCount`/`candidatesTokenCount`). Opik computes cost from supported models automatically; for models it may not price (e.g. `gpt-5.5`) we also attach a manual `total_cost` from `MODEL_PRICING_USD_PER_TOKEN` (`gpt-5.5` = $5/1M input, $30/1M output; `gpt-4o-mini` = $0.15/$0.60), which overrides Opik's own calc so cost never shows "-". Update that map in `opikTrace.ts` when pricing or models change. Audio (Whisper/TTS) has no token usage, so those spans carry no cost. Set `OPIK_COST_DEBUG=true` to log what is sent. Helper tests: `deno test supabase/functions/shared/opikTrace.test.ts`.

**User flags → Opik feedback scores:** When students flag chat sentences or teachers flag AI-generated feedback/assignments, the app calls `opik-ai-flag-feedback`, which posts `student_flag: 0` or `teacher_flag: 0` on the linked trace. Filter traces by those feedback score names in Opik to review bad outputs.

**Deploy / smoke (when validating tracing):**  
`perleap-chat`, `teacher-assistant-chat`, `rephrase-text`, `suggest-assignment-hard-skills`, `generate-student-facing-task`, `generate-followup-assignment`, `generate-feedback`, `evaluate-from-feedback`, `explain-analytics-5d`, `regenerate-scores`, `analyze-student-wellbeing`, `compute-nuance-insights`, `extract-unit-memory`, `transcribe-live-session`, `text-to-speech`, `speech-to-text`, `opik-ai-flag-feedback`.

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
