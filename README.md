# Apollo Chat

A modern, full-stack chat application built with Vue.js and Express.js, designed to interact with local LLM providers like Ollama. Apollo Chat provides a beautiful, feature-rich interface for conversational AI with support for vision, tools, streaming responses, and persistent chat history. (Okay, maybe "beautiful" is aspirational—the UI is still a work in progress, but the features are solid! 😅)

## Features

### Chat & Conversation Management

- [x] Chat history with SQLite persistence
- [x] List chats
- [x] List chat messages
- [x] Response streaming
- [x] Loading indicator
- [ ] Generate conversation title
- [ ] Conversation summary
- [ ] Export chat as JSON
- [ ] Delete chat
- [ ] Archive chat
- [ ] Folders for organizing chats
- [ ] Start chat from branch

### LLM Provider Integration

- [x] Ollama integration
- [x] List models
- [ ] Poll server status
- [ ] Ollama options configuration
- [ ] LM Studio API integration

### Tools & Capabilities

- [x] Web search tool
- [x] Fetch tool
- [x] Thinking mode
- [x] Tools with output
- [ ] Display model capabilities (tools, thinking, etc.)

### Vision & Media

- [x] Vision support
- [x] File uploads
- [ ] Image generation icons and logos

### Chat Features

- [ ] Output style customization
- [ ] System message configuration
- [ ] Code styling in responses
- [ ] Markdown formatting enhancements
- [ ] Assistant response artifacts
- [ ] Context window usage display

### Message Management

- [ ] Message tools
  - [ ] Copy message
  - [ ] Edit user message
  - [ ] Retry assistant response
  - [ ] Show assistant response metadata

### UI & UX Improvements

- [ ] Error handling (frontend and backend)
- [ ] Context management
- [ ] Abort Ollama requests on client close

### Advanced Features

- [x] Voice to text
- [ ] Vercel SDK integration
- [ ] RAG (Retrieval-Augmented Generation)
- [ ] Translation and writing focused page
- [ ] Comparison mode
- [ ] Admin panel
- [ ] Memories
- [ ] Save response metadata on completion

### Settings

- [ ] Settings page
  - [ ] Ollama provider configuration
  - [ ] LM Studio provider configuration
  - [ ] Other providers configuration

## Tech Stack

### Backend

- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **Drizzle ORM** - TypeScript ORM for database operations
- **Ollama** - Local LLM integration
- **SQLite** - Database (via libSQL)
- **Multer** - File upload handling

### Frontend

- **Vue.js 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Next-generation frontend tooling
- **Tailwind CSS** - Utility-first CSS framework
- **TanStack Query** - Data fetching and caching
- **Pinia** - State management
- **Vue Router** - Official router for Vue.js
- **Reka UI** - Vue component library
- **Markdown-it** - Markdown parser

## How to Run Locally for Development

### Prerequisites

- **Node.js** - Version `^20.19.0` or `>=22.12.0`
- **pnpm** - Version `>=8.0.0`
- **Ollama** - Install and run Ollama locally ([ollama.ai](https://ollama.ai))

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd apollo-chat
```

2. Install dependencies:

```bash
pnpm install
```

### Development

#### Run Both Frontend and Backend

Start both the frontend and backend in development mode with hot reload:

```bash
pnpm dev
```

This will start:

- Backend server (typically on `http://localhost:3000`)
- Frontend development server (typically on `http://localhost:5173`)

#### Run Individual Services

**Backend only:**

```bash
pnpm dev:backend
```

**Frontend only:**

```bash
pnpm dev:frontend
```

### Environment Setup

Make sure you have Ollama running locally. The backend will connect to Ollama's default endpoint (`http://localhost:11434`).

### Available Scripts

#### Root Level

- `pnpm dev` - Run both frontend and backend in development mode
- `pnpm dev:backend` - Run backend only
- `pnpm dev:frontend` - Run frontend only
- `pnpm build` - Build all packages
- `pnpm build:backend` - Build backend only
- `pnpm build:frontend` - Build frontend only
- `pnpm test` - Run all tests
- `pnpm test:backend` - Run backend tests
- `pnpm start` - Start backend in production mode
- `pnpm lint` - Lint all packages
- `pnpm format` - Format all packages

#### Backend Scripts

- `pnpm --filter backend dev` - Start backend with hot reload
- `pnpm --filter backend build:ts` - Build TypeScript to JavaScript
- `pnpm --filter backend watch:ts` - Watch TypeScript files
- `pnpm --filter backend test` - Run backend tests
- `pnpm --filter backend start` - Start backend in production mode

#### Frontend Scripts

- `pnpm --filter frontend dev` - Start frontend development server
- `pnpm --filter frontend build` - Build for production
- `pnpm --filter frontend preview` - Preview production build
- `pnpm --filter frontend lint` - Lint code
- `pnpm --filter frontend format` - Format code

## Installation

> **Coming Soon** - Installation instructions for production deployment will be added here.

## Project Structure

```
apollo-chat/
├── apps/
│   ├── backend/          # Express.js backend API
│   │   ├── src/
│   │   │   ├── routes/   # API route handlers
│   │   │   ├── services/ # Business logic
│   │   │   ├── db/       # Database schema and client
│   │   │   ├── ollama/   # Ollama integration
│   │   │   └── utils/    # Utility functions
│   │   └── uploads/      # Uploaded files storage
│   └── frontend/         # Vue.js frontend application
│       └── src/
│           ├── components/  # Vue components
│           ├── api/         # API service layer
│           ├── composables/ # Vue composables
│           ├── queries/     # TanStack Query hooks
│           ├── stores/      # Pinia stores
│           └── router/     # Vue Router configuration
├── package.json           # Root package.json with workspace scripts
└── pnpm-workspace.yaml    # pnpm workspace configuration
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

Copyright (c) 2026 Apollo Chat

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
