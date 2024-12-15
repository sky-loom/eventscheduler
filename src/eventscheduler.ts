import { nanoid } from "nanoid";
import { EventHandler } from "./eventhandler.js";

export type EventStatus = "scheduled" | "running" | "done" | "paused" | "resuming";

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

export class EventScheduler {
  private eventMap: Map<string, Event> = new Map(); // Map of ID to Event
  private callbackMap: Map<string, EventHandler> = new Map(); // Map of lookup names to callbacks
  private status: EventStatus;

  /**
   * Add a callback function for a specific lookup name.
   */
  constructor() {
    //start paused so we can register callbacks and all saved events before executing
    this.status = "paused";
  }

  public registerCallback(lookupName: string, callback: EventHandler): void {
    if (this.callbackMap.has(lookupName)) {
      throw new Error(`Callback for '${lookupName}' already registered.`);
    }
    this.callbackMap.set(lookupName, callback);
  }

  public getAllEvents() {
    return this.eventMap;
  }
  /**
   * Add a new event to the scheduler.
   */
  public addEvent(id: string = nanoid(), lookupName: string, params: any, duration: number, autoRepeat: boolean = false): string {
    if (this.eventMap.has(id)) {
      //console.log(`Event with ID '${id}' already exists. Overwriting.`);
    }
    if (!this.callbackMap.has(lookupName)) {
      throw new Error(`No callback registered for '${lookupName}'.`);
    }

    const event: Event = {
      id,
      lookupName,
      params,
      status: this.status == "paused" ? "paused" : "scheduled", //add as paused if global state paused
      addedAtTime: Date.now(),
      remainingTime: duration,
      duration,
      autoRepeat,
    };

    this.scheduleEvent(event);
    return id;
  }

  public eventIsScheduled(id: string): boolean {
    let event = this.eventMap.get(id);
    console.log("Checking Event - " + id);
    if (event) console.log(event);
    return event && (event.status == "scheduled" || event.status == "running" || event.status == "paused") ? true : false;
  }
  /**
   * Remove an event by its ID.
   */
  public removeEvent(id: string): void {
    const event = this.eventMap.get(id);
    if (!event) return;

    //console.log("Removing Event..." + event?.id);
    if (event.jobId) {
      //console.log("Clearning timeout for Event..." + event?.id);

      clearTimeout(event.jobId);
    }
    this.eventMap.delete(id);
  }

  /**
   * Pause an event by its ID.
   */
  public pauseEvent(id: string): void {
    const event = this.eventMap.get(id);
    if (!event || event.status !== "scheduled") return;

    if (event.jobId) {
      clearTimeout(event.jobId);
      event.remainingTime -= Date.now() - event.addedAtTime;
      event.status = "paused";
      event.jobId = undefined;
    }
  }

  /**
   * Resume a paused event by its ID.
   */
  public async resumeEvent(id: string): Promise<void> {
    const event = this.eventMap.get(id);
    console.log(this.status);
    if (!event || event.status !== "paused") return;

    event.status = "scheduled";
    event.addedAtTime = Date.now();
    await this.scheduleEvent(event, event.remainingTime);
  }

  /**
   * Pause all events.
   */
  public async pauseAll(): Promise<void> {
    for (const id of this.eventMap.keys()) {
      this.pauseEvent(id);
    }
    //really really wait for everything to pause before we exit this method
    await this.waitForIdle();
  }
  private async waitForIdle(): Promise<void> {
    while (Array.from(this.eventMap.values()).some((event) => event.status === "running")) {
      console.log("Scheduler: Waiting for idle...");
      await new Promise((resolve) => setTimeout(resolve, 10)); // Poll every 10ms
    }
  }

  public async removeAllByType(type: string): Promise<void> {
    let lst = [];
    for (const id of this.eventMap.keys()) {
      if (this.eventMap.get(id)?.lookupName == type) {
        lst.push(id);
      }
    }
    lst.forEach(async (id) => {
      this.removeEvent(id);
    });
  }
  /**
   * Resume all paused events.
   */
  public async resumeAll(): Promise<void> {
    console.log(this.eventMap);
    this.status = "running";
    const eventKeys = Array.from(this.eventMap.keys());
    for (const id of eventKeys) {
      console.log("Resuming..." + id);
      await this.resumeEvent(id);
    }
  }

  /**
   * Schedule an event for execution.
   */
  private async scheduleEvent(event: Event, delay?: number): Promise<void> {
    if (this.eventMap.has(event.id)) {
      this.removeEvent(event.id);
    }
    //console.log("Scheduling Event: " + event.lookupName);
    if (event.remainingTime <= 0) event.remainingTime = event.duration;

    const timeToRun = delay ?? event.remainingTime;
    if (this.status == "paused") {
      console.log("Cannot resume - scheduler is paused");
      event.status = "paused";
    } else {
      event.status = "scheduled";
      //console.log("Scheduling Event...." + event.id + " for " + timeToRun / 1000 + " seconds away - " + event.remainingTime);
      const jobId = setTimeout(async () => {
        await this.runEvent(event);
      }, timeToRun);

      event.jobId = jobId;
    }

    this.eventMap.set(event.id, event);
  }

  public async executeImmediately(id: string) {
    const event = this.eventMap.get(id);
    if (!event || event.status !== "scheduled") return;

    if (event.jobId) {
      clearTimeout(event.jobId);
      event.jobId = undefined;
    }
    await this.runEvent(event);
  }
  /**
   * Execute an event's callback.
   */
  private async runEvent(event: Event): Promise<void> {
    const callback = this.callbackMap.get(event.lookupName);
    if (!callback) {
      throw new Error(`Callback for '${event.lookupName}' not found.`);
    }

    event.status = "running";
    console.log("Executing Event: " + event.lookupName);
    await callback.execute(this, {
      ...event.params,
    });

    event.status = "done";
    event.jobId = undefined;

    if (event.autoRepeat) {
      this.addEvent(event.id, event.lookupName, event.params, event.duration, true);
    } else {
      this.removeEvent(event.id);
    }
  }
  public saveEvents(): string {
    const serializedEvents = Array.from(this.eventMap.values()).map((event) => {
      const { jobId, ...rest } = event; // Exclude jobId (cannot be serialized)
      return rest;
    });
    return JSON.stringify(serializedEvents);
  }
  public loadEvents(serializedData: string): void {
    const events: Omit<Event, "jobId">[] = JSON.parse(serializedData);
    events.forEach((eventData) => {
      const event: Event = {
        ...eventData,
        jobId: undefined, // Reset jobId
      };
      if (event.status === "scheduled" || event.status === "paused") {
        console.log("remains " + event.remainingTime);
        this.scheduleEvent(event, event.remainingTime);
      }
      //is this needed?
      //this.eventMap.set(event.id, event);
    });
  }
}
