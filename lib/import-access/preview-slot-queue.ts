import { PREVIEW_MAX_WAITING } from "./constants";

export type PreviewSlot = {
  release(): void;
};

export type PreviewSlotQueue = {
  tryAcquire(): PreviewSlot | undefined;
};

/** One active navigation plus up to {@link PREVIEW_MAX_WAITING} queued previews. */
export function createPreviewSlotQueue(
  maxInFlight = PREVIEW_MAX_WAITING + 1,
): PreviewSlotQueue {
  let inFlight = 0;

  return {
    tryAcquire(): PreviewSlot | undefined {
      if (inFlight >= maxInFlight) {
        return undefined;
      }
      inFlight += 1;
      return {
        release(): void {
          inFlight = Math.max(0, inFlight - 1);
        },
      };
    },
  };
}

let defaultQueue: PreviewSlotQueue | undefined;

export function getPreviewSlotQueue(): PreviewSlotQueue {
  defaultQueue ??= createPreviewSlotQueue();
  return defaultQueue;
}

export function resetPreviewSlotQueueForTests(): void {
  defaultQueue = undefined;
}
