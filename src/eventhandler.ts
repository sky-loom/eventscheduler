import { EventScheduler } from "./eventscheduler.js";

export interface EventHandler {
  execute(scheduler: EventScheduler, params: any): Promise<void>;
}
