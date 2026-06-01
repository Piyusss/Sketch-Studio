/// <reference types="vite/client" />

declare module 'rbush' {
  interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  class RBush<T extends BBox> {
    constructor(maxEntries?: number);
    insert(item: T): RBush<T>;
    load(items: T[]): RBush<T>;
    remove(item: T, equals?: (a: T, b: T) => boolean): RBush<T>;
    clear(): RBush<T>;
    search(bbox: BBox): T[];
    all(): T[];
    collides(bbox: BBox): boolean;
    toBBox(item: T): BBox;
    compareMinX(a: T, b: T): number;
    compareMinY(a: T, b: T): number;
  }

  export default RBush;
}
