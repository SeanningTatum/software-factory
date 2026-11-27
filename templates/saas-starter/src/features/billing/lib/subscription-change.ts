import { isExpectedChange, isStatus, type Status } from "../machines/subscription.machine.ts";

interface UpdatedEvent {
  readonly data: { readonly previous_attributes?: object };
}

export const unexpectedChange = (
  event: UpdatedEvent,
  to: string,
): { readonly from: Status; readonly to: Status } | undefined => {
  const previous = (event.data.previous_attributes as { status?: unknown } | undefined)?.status;
  const from = typeof previous === "string" ? previous : to;
  return isStatus(from) && isStatus(to) && !isExpectedChange(from, to) ? { from, to } : undefined;
};
