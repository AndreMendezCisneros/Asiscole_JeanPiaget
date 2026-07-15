export type SuccessFlashPayload = {
  title: string;
  description?: string;
};

type Listener = (payload: SuccessFlashPayload) => void;

let listener: Listener | null = null;

export function subscribeSuccessFlash(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function showSuccessFlash(payload: SuccessFlashPayload): void {
  listener?.(payload);
}
