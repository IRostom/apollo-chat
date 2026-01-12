---
name: Stop Generation Feature
overview: Add the ability for users to stop an ongoing AI response generation by aborting the streaming request on the frontend and propagating the cancellation to the Ollama backend.
todos:
  - id: api-signal
    content: Add AbortSignal support to sendMessage in chatService.ts
    status: pending
  - id: stream-abort
    content: Add AbortController and abort() function to useChatStream.ts
    status: pending
    dependencies:
      - api-signal
  - id: composable-expose
    content: Expose stopGeneration from useChat.ts
    status: pending
    dependencies:
      - stream-abort
  - id: backend-close
    content: Add client disconnect handler to abort Ollama request
    status: pending
  - id: ui-stop-button
    content: Add stop button to ChatInput when streaming
    status: pending
    dependencies:
      - composable-expose
---

# Stop Generation Feature

## Summary

When streaming or awaiting a response, replace the send button with a stop button that aborts the current request and stops the backend generation.

## Architecture

```mermaid
sequenceDiagram
    participant UI as ChatInput
    participant Stream as useChatStream
    participant API as chatService
    participant Backend as /chat/stream
    participant Ollama as ollamaClient

    UI->>Stream: send message
    Stream->>API: sendMessage(options, signal)
    API->>Backend: fetch with AbortSignal
    Backend->>Ollama: stream response
    Note over UI: User clicks Stop
    UI->>Stream: abort()
    Stream->>API: controller.abort()
    API-->>Backend: connection closed
    Backend->>Ollama: ollamaResponse.abort()
    Backend-->>API: save partial response
```

## Changes

### 1. Frontend API Layer - [`apps/frontend/src/api/chatService.ts`](apps/frontend/src/api/chatService.ts)

- Add optional `signal: AbortSignal` parameter to `sendMessage()`
- Pass signal to `fetch()` call

### 2. Stream Hook - [`apps/frontend/src/queries/useChatStream.ts`](apps/frontend/src/queries/useChatStream.ts)

- Create an `AbortController` ref that persists across renders
- Pass `controller.signal` to `sendMessage()`
- Add `abort()` function that calls `controller.abort()` and resets streaming state
- Handle `AbortError` gracefully (not as an error to throw)

### 3. Chat Composable - [`apps/frontend/src/composables/useChat.ts`](apps/frontend/src/composables/useChat.ts)

- Expose `stopGeneration` from `useChatStream`

### 4. Chat View - [`apps/frontend/src/components/ChatView.vue`](apps/frontend/src/components/ChatView.vue)

- Pass `stopGeneration` function to `ChatInput`

### 5. Chat Input - [`apps/frontend/src/components/chat/ChatInput.vue`](apps/frontend/src/components/chat/ChatInput.vue)

- Add `@stop` emit and `stopGeneration` handler
- When `isStreaming` is true, show a stop button (square icon) instead of send/mic button

### 6. Backend - [`apps/backend/src/routes/chat.ts`](apps/backend/src/routes/chat.ts)

- Add `req.on('close', ...)` listener to detect client disconnection
- When client disconnects, call `ollamaResponse.abort()` and save partial response
