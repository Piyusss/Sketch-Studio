type OnLoadCallback = () => void;

const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, OnLoadCallback[]>();

export function getImage(src: string, onLoad: OnLoadCallback): HTMLImageElement | null {
  if (cache.has(src)) return cache.get(src)!;

  if (pending.has(src)) {
    pending.get(src)!.push(onLoad);
    return null;
  }

  pending.set(src, [onLoad]);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    cache.set(src, img);
    const cbs = pending.get(src) ?? [];
    pending.delete(src);
    cbs.forEach((cb) => cb());
  };
  img.onerror = () => pending.delete(src);
  img.src = src;
  return null;
}

export function preloadImage(src: string): void {
  if (!cache.has(src) && !pending.has(src)) {
    getImage(src, () => {});
  }
}

export function clearImageCache(): void {
  cache.clear();
  pending.clear();
}
