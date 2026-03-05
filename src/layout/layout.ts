export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

export const SlotStatus = {
  Idle: 0,
  Attached: 1,
  Detached: 2,
} as const;
