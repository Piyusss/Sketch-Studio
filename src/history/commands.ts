import type { CanvasObject } from '../types';
import { useCanvasStore } from '../store/canvasStore';
import { spatialIndex } from '../engine/spatialIndex';
import type { Command } from './historyManager';

export class AddObjectCommand implements Command {
  description = 'Add object';
  constructor(private obj: CanvasObject) {}

  execute(): void {
    useCanvasStore.getState().addObject(this.obj);
    spatialIndex.insert(this.obj);
  }

  undo(): void {
    useCanvasStore.getState().removeObject(this.obj.id);
    spatialIndex.remove(this.obj.id);
    useCanvasStore.getState().removeFromSelection(this.obj.id);
  }
}

export class RemoveObjectsCommand implements Command {
  description = 'Delete objects';
  private objects: CanvasObject[];

  constructor(ids: string[]) {
    this.objects = ids
      .map((id) => useCanvasStore.getState().getObject(id))
      .filter((o): o is CanvasObject => o !== undefined);
  }

  execute(): void {
    const store = useCanvasStore.getState();
    this.objects.forEach((obj) => {
      store.removeObject(obj.id);
      spatialIndex.remove(obj.id);
    });
    store.clearSelection();
  }

  undo(): void {
    const store = useCanvasStore.getState();
    this.objects.forEach((obj) => {
      store.addObject(obj);
      spatialIndex.insert(obj);
    });
  }
}

export class UpdateObjectCommand implements Command {
  description = 'Update object';

  constructor(
    private id: string,
    private from: Partial<CanvasObject>,
    private to: Partial<CanvasObject>,
  ) {}

  execute(): void {
    const store = useCanvasStore.getState();
    store.updateObject(this.id, this.to);
    const obj = store.getObject(this.id);
    if (obj) spatialIndex.insert(obj);
  }

  undo(): void {
    const store = useCanvasStore.getState();
    store.updateObject(this.id, this.from);
    const obj = store.getObject(this.id);
    if (obj) spatialIndex.insert(obj);
  }
}
