# 🧠 AI-Powered Note-Taking System
A production-oriented AI note system featuring real-time streaming, background job orchestration, and long-term reflection reports.

Built with React, TypeScript, Express, BullMQ, OpenAI, MongoDB, and Server-Sent Events.


## Architecture
The diagram below shows the end-to-end data flow of AI note processing, from user input to real-time streaming and persistent storage.

- API layer remains responsive
- All LLM workloads run asynchronously
- Streaming and persistence are handled independently to ensure consistency
![High-Level Architecture](./docs/images/High-Level%20Architecture%20Diagram.png)

## ✨ Why This Project Stands Out

This is not a simple AI demo or CRUD application.
It is a production-oriented AI system designed to handle **real-time LLM streaming**, 
**asynchronous background processing**, and **long-term data consistency**-the same challenges faced by AI features in real-world products.

**What makes it different:**
- **Real-time AI streaming UX**  
  Users see notes being generated token by token via Server-Sent Events (SSE), while the system guarantees that only validated, complete results are persisted.
- **Asynchronous, retry-safe AI pipeline**  
  All LLM workloads run in background workers (BullMQ + Redis) with deterministic job IDs, ensuring idempotency, safe retries, and no duplicate generation.
- **Designed for reliability, not just speed**  
  Partial AI outputs are never saved. Failures are tracked, retried, or rolled back to maintain data integrity under crashes or API errors.
- **AI-powered reflection, not just summarization**  
  Beyond individual notes, the system generates **weekly and monthly AI reflections** inspired by Spotify Wrapped—helping users understand patterns, habits, and progress over time.
- **Built with production constraints in mind**  
  Token-efficient prompt design, schema-validated LLM output, and a flexible data model support scalability, cost control, and future feature evolution.

This project demonstrates how to build **AI features that are interactive, reliable, and maintainable**—not just impressive in a demo, but viable in production.

## 📝 AI-Powered Note Organization (Core Feature)

The system transforms raw, unstructured notes into **clear, structured, and reusable knowledge** using LLMs.
- Supports multiple note contexts: **meeting, study, interview**
- Applies scenario-specific prompts for higher-quality results
- Produces clean, well-structured Markdown for the end user
- Persists summaries and keywords as internal metadata for token-efficient downstream AI processing

### Real-Time, User-Centric Experience
- Notes are generated with **token-level streaming** via Server-Sent Events (SSE)
- Users see content appear progressively, reducing perceived latency
- Only validated, complete outputs are persisted to the database

### Built for Reliability
- LLM processing runs asynchronously in background workers
- Partial or malformed AI outputs are never saved
- Automatic retries and rollback ensure data consistency

## 📊 AI-Powered Weekly & Monthly Reports
Core Differentiation: Reflection, Not Just Summaries

**Beyond individual note summaries, the system generates AI-powered weekly and monthly reflections inspired by Spotify Wrapped.**
- Aggregates user activity across time (notes, categories, frequency)

- Extracts recurring themes and behavior patterns

- Produces a human-readable, encouraging narrative using an LLM

The focus is **reflection and motivation**, not dashboards or raw analytics.

**Design Highlights**
- **Non-streaming by design**
Reports are generated asynchronously, persisted, and loaded on demand for reliability and simplicity.

- **Idempotent & retry-safe generation**
Each report is uniquely identified by (userId, type, periodKey) and safely retried via BullMQ.

- **Graceful handling of low activity**
When data is insufficient, the system skips LLM calls and returns an empathetic fallback message.

Why This Matters

This feature demonstrates product thinking, thoughtful AI UX, and scalable system design—turning raw notes into long-term insight rather than isolated summaries.

## 🧠 Key Design Decisions

### 1. Asynchronous AI Processing via Background Workers
LLM workloads are fully decoupled from the request–response cycle using BullMQ, ensuring a responsive API and enabling safe retries, idempotency, and horizontal scaling.

### 2. Real-Time Streaming with SSE (Not WebSockets)
Server-Sent Events provide low-latency, one-directional streaming with simpler infrastructure and automatic reconnection, making them a better fit than WebSockets for AI token streaming.

### 3. Data Consistency Over Partial AI Results
Partial or malformed AI outputs are never persisted. Only fully validated results are saved, with rollback and retry logic to guarantee long-term data integrity.

### 4. Token-Efficient AI Data Modeling
Notes persist lightweight summaries and keywords as internal metadata, allowing downstream AI tasks (e.g. reports) to avoid reprocessing full note content and reduce token usage.

### 5. Non-Streaming AI Reports by Design
Weekly and monthly reports are generated asynchronously, persisted, and loaded on demand. This avoids unnecessary streaming complexity for content that is not time-sensitive.

### 6. MongoDB for AI-Generated, Evolving Data
AI outputs are semi-structured and evolve over time. MongoDB’s flexible schema, nested documents, and atomic updates align naturally with this workflow.


