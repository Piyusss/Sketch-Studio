import RBush from 'rbush';
import type { CanvasObject, AABB } from '../types';

interface BushItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
}

class SpatialIndex {
  private tree = new RBush<BushItem>();
  private items = new Map<string, BushItem>();

  rebuild(objects: Record<string, CanvasObject>): void {
    this.tree.clear();
    this.items.clear();
    // Only index top-level objects — group children are rendered through their parent
    const items: BushItem[] = [];
    for (const obj of Object.values(objects)) {
      if (obj.parentId) continue;
      const item = this.toItem(obj);
      items.push(item);
      this.items.set(obj.id, item);
    }
    if (items.length > 0) this.tree.load(items);
  }

  insert(obj: CanvasObject): void {
    if (obj.parentId) return; // children are not indexed directly
    const existing = this.items.get(obj.id);
    if (existing) this.tree.remove(existing);
    const item = this.toItem(obj);
    this.tree.insert(item);
    this.items.set(obj.id, item);
  }

  remove(id: string): void {
    const item = this.items.get(id);
    if (item) { this.tree.remove(item); this.items.delete(id); }
  }

  search(aabb: AABB): string[] {
    return this.tree
      .search({ minX: aabb.minX, minY: aabb.minY, maxX: aabb.maxX, maxY: aabb.maxY })
      .map((item) => item.id);
  }

  private toItem(obj: CanvasObject): BushItem {
    return {
      minX: obj.x, minY: obj.y,
      maxX: obj.x + obj.width, maxY: obj.y + obj.height,
      id: obj.id,
    };
  }
}

export const spatialIndex = new SpatialIndex();
