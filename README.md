# @skyloom/eventscheduler

## Description

A simple event scheduling system with serialization. The `EventScheduler` class allows you to schedule, execute, pause, resume, and remove events based on unique IDs, categories, and callback functions. It supports automatic repetition of events and provides methods to save and load scheduled events.

## Installation

```bash
npm install @skyloom/eventscheduler

```

## Usage

```typescript
import { EventScheduler, EventHandler, EventStatus } from "@skyloom/eventscheduler";

// Initialize the Event Scheduler
const scheduler = new EventScheduler();

// Define an event handler
const exampleHandler: EventHandler = {
  execute: async (scheduler, params) => {
    console.log("Event executed with params:", params);
  },
};

// Register the event handler
scheduler.registerCallback("exampleEvent", exampleHandler);

//event id
const eventId = "your-id-here";
// Add an event to the scheduler
scheduler.addEvent(eventId, "exampleEvent", { message: "Hello, World!" }, 5000, false);

// Pause the event
scheduler.pauseEvent(eventId);

// Resume the event
await scheduler.resumeEvent(eventId);

// Remove the event
scheduler.removeEvent(eventId);

// Save all events to a string
const serializedEvents = scheduler.saveEvents();

// Load events from a string
scheduler.loadEvents(serializedEvents);
```

## API

### EventScheduler

- **`registerCallback(lookupName: string, callback: EventHandler): void`**

  - Registers a callback function for a specific event type.

- **`addEvent(id: string = nanoid(), lookupName: string, params: any, duration: number, autoRepeat: boolean = false): string`**

  - Adds a new event to the scheduler.

- **`removeEvent(id: string): void`**

  - Removes an event by its ID.

- **`pauseEvent(id: string): void`**

  - Pauses an event by its ID.

- **`resumeEvent(id: string): Promise<void>`**

  - Resumes a paused event by its ID.

- **`pauseAll(): Promise<void>`**

  - Pauses all events.

- **`resumeAll(): Promise<void>`**

  - Resumes all paused events.

- **`executeImmediately(id: string): Promise<void>`**

  - Executes an event's callback immediately.

- **`saveEvents(): string`**

  - Saves all events to a string in JSON format.

- **`loadEvents(serializedData: string): void`**
  - Loads events from a JSON string.

## EventHandler

```typescript
export interface EventHandler {
  execute(scheduler: EventScheduler, params: any): Promise<void>;
}
```

## Event

```typescript
export interface Event {
  id: string; // Unique ID for the event
  lookupName: string; // Key for the callback function
  params: any; // Parameters for the callback
  status: EventStatus; // Current status
  addedAtTime: number; // Timestamp when the event was added
  remainingTime: number; // Remaining time before execution
  duration: number; // Total duration in milliseconds
  autoRepeat: boolean; // Whether the event should repeat
  jobId?: NodeJS.Timeout; // Timeout reference for scheduling
}
```
