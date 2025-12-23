# 🧠 AI Note-Taking System
A real-time AI-powered note processing system with streaming, background jobs, and a scalable architecture.
Built using React, Express, BullMQ, OpenAI, MongoDB, and Server-Sent Events.


## Architecture
![High-Level Architecture](./public/High-Level%20Architecture%20Diagram.png)

## 1. Overview
This project is a real-time AI-powered note processing system designed with production-level archiecture principles.
Users submit raw notes through a React frontend, and an asynchronous background worker processses the content using OpenAI's streaming API.
The system delivers real-time AI-generated enhancements back to the client via **Server-Sent Events**, ensuring low-latency user experience without blocking the main application/

The architecture demonstrates clean separation of concerns between the **API layer, queue system, worker, streaming layer**, and **AI provider**, similar to patterns used in scalable industry systems.
Long-running tasks are offloaded to **BullMQ**, while the frontend maintains a persistent SSE connection to receive incremental AI output.

This project highlights:
- Real-time streaming pipelines
- Background job orchestration
- Reliable error handling and retry strategies
- Safe write operations with rollback
- Token-efficient AI prompt engineering
- Modular and hotizontally scalable architecture

It is designed and implemented with modern engineering practices suitable for large-scale production environments.


## 2. Motivation
In daily work and study, I often create large number amounts of unstructured notes--meeting minutes, interview preparation logs, technical learning notes, and personal summaries.
These notes are useful, but extremely fragmented. Whenever I wanted to ture them into structured insights, I had to repeatedly craft prompts in ChatGPT and manually organize the results. Worse, past AI outputs were easily lost inside long chat histories.

To solve this problem, I designed a dedicated AI-powered note processing system that:
- Automatically transforms raw, messy notes into structured summaries
- Uses scenario-specific prompts (meeting, interview, study, etc.) for higher-quality output
- Saves and tracks all processsed notes persistently 
- Provides **real-time AI streaming for an interactive, low-latency experience
Additionally, inspired by Spotify Wrapped, I wanted to help users visualize their long-term leaning or work patterns.
The system is designed to eventually generate **weekly and monthly reports**, showing trends such as:
- How many meetings were recorded
- How many interviews were prepared
- What topics were learned
- Overall emotional tone and progress overtime
The goal is to provide not only AI-enhanced note organization, but also insight, reflection, and motivation through data.

## 🚀 Features

### 🔥 Real-Time AI Note Processing
- **LLM-powered note organization** using `gpt-5-nano` via OpenAI Responses API
- **Token-level streaming(SSE)** for a smooth, typewriter-style real-time UI
- Robust **JSON-mode output parsing** with fallback repairing
- Automatic detection & extraction of:
  - **Structured content**
  - **Summaries**
  - **Keywords**
  - **Cleaned Markdown**

---
### 🧵 End-to-End Streaming Architecture (SSE)
- Frontend subscribes to `/api/notes/:id/stream` via **Server-Sent Events**
- Backend fowards AI worker deltas in real-time
- Client updates UI progressively for maximum responsiveness
- Includes:
  - `start` event
  - incremental `chunk` events
  - `done` event for final result
  - `error` events for retry or rollback
  
---

### 🏗️ Background Job Processing (BullMQ + Redis)
- All heavy LLM tasks run asynchronously via **BullMQ Worker**
- Configured **concurrency**, **rate limiting**, and **idempotency**
- Automatic **retry logic**, error handling & final **rollback**
- Worker supports:
 - backup of previous user input
 - structured prompt building
 - streaming consumption of OpenAI chunks
 - reliable DB save & SSE dispatch

---

### 🔒 Secure Authentication & Token Refresh
- Full JWT auth flow:
  - **Register**
  - **Login**
  - **Protected routes**
  - **Automatic access-token refresh**
- HttpOnly cookies to prevent XSS attacks
- Axios interceptors for frictionless session recovery

---

### 🗃️ Clean Note CRUD + Optimized Querying
- Create, update, delete notes with efficient DB access patterns
- Optimized sidebar infinite loading (`useNotesInfiniteQuery`)
- Real-time rendering + optimistic UI update support

---

### 🧩 Modular, Extensible Architecture
- Clear separation between:
 - **Frontend UI layer**
 - **Backend API layer**
 - **Queue / Background workers**
 - **Database**
 - **LLM service integration**
- Easily extendable for future:
  - weekly / monthly reports
  - multi-model support
  - plugin-like prompt templates

---

### 🎨 Modern, Polished Frontend UX
- Fully responsive UI
- React Query for caching / sync / request de-duplication
- "AI is generating your note" indicator during note generation to enhance user feedback
- Clean note navigation (sidebar, infinite scroll, etc.)

## 📊 AI-Powered Weekly & Monthly Reports
This project includes an AI-generated reflection system inspired by Spotify Wrapped, designed to help users understand their note-taking habits over time.

## ✨ What Problem It Solves
Instead of showing raw notes, the system:
- Aggregates user activity over a **weekly / monthly period**
- Extracts meaningful patterns (active days, frequent themes)
- Generates a warm, human-readable reflection using an LLM

The goal is not analytics dashboards, but self-awareness and encouragement.
---
## 🧠 Key Design Decisions

### 1. Non-Streaming AI Reports(Intentional)
Unlike note summarization, reports are: 
- Generated via background jobs
- Persisted in the database
- Loaded on demand by the frontend
### Why?
- Reports combine text + statistics, which don’t fit streaming UX
- Users may open the page long after generation
- Improves reliability and simplifies frontend logic
---
### 2. Idempotent Background Generation
- Weekly & monthly reports are triggered by cron jobs
- Each report is uniquely identified by:
```
(userId, type, periodKey)
```
- BullMQ jobId guarantees no duplicete jobs
- Users can also trigger generation manually if needed
--- 
### 3. Structured LLM Output with Schema Validation
AI output is validated using a strict JSON schema:
```
{
  summary: string[],
  poeticLine: string
}

```
- Prevents malformed responses
- Eliminates fragile JSON.parse logic
- Ensures type-safe consumption by the frontend
---

### 4. Graceful handling of Low or No Activity
If a user has little or no activity during a period:
- The system **skipes the LLM call**
- Generates a short, empathetic fallback message
- Avoids unnecessary API cost while maintaining UX consistency
---
### 5. Clear Report Lifecycle & Retry Support
Each report has a well-defined lifecycle:
```
pending → processing → completed / failed
```
- Failures are persisted
- Users can manually retry generation
- Successful reports are cached and reused

## 🔧 Tech Stack Highlights
- Backend: Node.js, MongoDB, Mongoose, BullMQ, node-cron
- AI: OpenAI API with schema-validated structured output
- Frontend: React, React Query
- Architecture: Background jobs, deterministic period keys, idempotent processing

## Tech Stack

### **Frontend**
- **React** -UI rendering and component architecture 
- **React Query** - Data fetching, caching, query lifecycle management
- **Redux Toolkit** - Client state for authentication flow (login/logout, token refresh)
- **Vite** - Fast development bundler
- **TypeScript** - Type-safe React application
- **Server-Send Events (SSE)** - Real-time UI updates during AI processing

### **Backend**
- **Node.js / Express**  - REST API layer and SSE streaming endpoints
- **MongoDB** - Persistent storage for notes, tasks, and processed results
- **Mongoose** - Data modeling and schema validation
- **BullMQ** - Distributed job queue for async AI processing
- **Redis** - Job scheduling, retry, and worker coordination
- **TypeScript** - Shared types between backend and worker

### **AI Processing Worker**
- **Node.js Worker Service** - Isolated background worker
- **OpenAI API (Streaming)** - Token-level streaming from GPT models
- **Structured Output Parsing** - JSON parsing + validation
- **Automatic Retry / Backoff** - Powered by BullMQ retry policies
- **Transactional Logic** - Save results, rollback on failure

### **DevOps / Tooling**
- **Docker / Docker Compose** - Local environment reproducibility
- **ESLint + Prettier** - Code consistency
- **GitHub Actions (optional)** - CI testing and linting


## Project Structure
```
smart-note/
  ├── backend/              # Backend: Express API + MongoDB + BullMQ
  │   ├── config/             # Redis config
  │   ├── controllers/        # Note, Report controllers
  │   ├── jobs/               # Scheduled jobs (weekly/monthly reports)
  │   ├── logs/               # Worker logs
  │   ├── middleware/         # Auth middleware
  │   ├── models/             # Mongoose schemas (Note, User, Report)
  │   ├── queues/             # BullMQ queue definitions
  │   ├── routes/             # Express route definitions
  │   ├── utils/              # Shared helpers 
  │   ├── workers/            # AI processing/Report workers
  │
  ├── src/                    # Frontend: React + React Query + Redux
  │   ├── api/                # Axios interceptors
  │   ├── components/         # Components
  │   ├── hooks/              # Custom hooks
  │   ├── redux/              # Auth slice + store
  │   ├── styles/             # Components styles (scss modules)
  │   ├── utils/              # Frontend utils
  │   ├── APP.tsx
  │   ├── main.tsx
  ├── README.md

```

## ⭐ Key Design Decisions

### 1. Async Architecture with Background Processing (BullMQ)
LLM processing is completely decoupled from the request-response cycle, ensuring a responsive API and enabling horizontal scalability through worker scaling.

---

### 2. Real-Time AI Streaming via SSE
SSE provides low-latency token streaming with simple server infrastructure and built-in automatic reconnection, making it more lightweight than WebSockets for one-directional streaming.

---

### 3. Data Consistency & Reliability
Partial outputs are never persisted.
A combination of:
  - worker retries
  - final JSON parsing
  - rollback logic
ensures only valid, complete AI-generated notes reach the database.

---
### 4. Token-Efficient Prompt & Data Model Design
Each note maintains keywords, simplified summaries, and structured metadata, allowing the worker to craft low-token prompts while still preserving semantic context.

---

### 5. MongoDB over Relational Databases: Schema Flexibility & Write Optimization
This project handles AI-generated, semi-structured, and rapidly evolving data. Models like Note and Report include nested arrays, dynamic metadata, flexible AI fields, and nulti-stage processsing outputs.
MongoDB is a natural fit because:
  - **Schema flexibility:** AI outputs evolve over time(keywords, summaries, rollback fields, stats). MongoDB allows adding fields without migrations.
  - **Nested JSON documents:** Structures like stats.topKeywords[] and categories[] map directly to MongoDB documents without joining multiple tables.
  - **High write throughput:** The worker performs frequent state updates(pending -> processing -> completed). MongoDB handles these lightweight writes efficiently
  - **Atomic document updates:** Notes often undergo partial updates or rollbacks; MongoDB's single document atomicity matches this workflow.
  - **Report generation fits the document model:** Reports are precomputed aggregates with nested structures-ideal for document storage.
Relational databases would require excessive table normalization, migrations, joins, and rigid schema management, adding unnecessary complexity for this AI-driven system.

## 🚀 Getting Started
Follow the steps below to run both the backend and frontend locally.
### 1. Prerequisites

Make sure you have the following installed:

- Node.js (v18+)

- npm (comes with Node)

- Redis (used for queue & job processing)

### 2. Installation
Clone the project and install dependencies for both backend and frontend:
```
https://github.com/Allen-Wang-01/smart-notes.git
cd smart notes
```

#### Install frontend dependencies:
```
npm install
```

#### Install backend dependencies:

```
cd backend 
npm install
```

### 3. Environment Variables
This project requires environment variables to run.
Create a .env file in the following directories:
Backend
```
PORT=3001
MONGO_URI=your-mongodb-uri
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-key
REDIS_HOST=localhost
REDIS_PORT=6379

```
Frontend 
```
VITE_API_URL=http://localhost:3001
```

### 4. Running the Project
Terminal 1 — Start Redis
```
brew services start redis
```

Terminal 2 — Start Frontend
```
npm run dev
```

Terminal 3 — Start Backend
```
cd backend
npm run dev
```

Stopping Redis
```
brew services stop redis
```