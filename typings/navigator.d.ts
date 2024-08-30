interface Navigator {
  scheduling: Scheduling;
}

interface Scheduling {
  isInputPending(options?: SchedulingisInputPendingOptions): boolean;
}

interface SchedulingisInputPendingOptions {
  includeContinuous?: boolean;
}
