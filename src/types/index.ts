export type Tool = 'select' | 'pan' | 'rect' | 'ellipse' | 'diamond' | 'line' | 'text' | 'image' | 'pen' | 'arrow' | 'eraser' | 'laser';

export type ObjectType = 'rect' | 'ellipse' | 'diamond' | 'text' | 'group' | 'image' | 'pen' | 'arrow';

export type ArrowHead = 'none' | 'arrow' | 'dot';

export interface PenPoint { x: number; y: number; }

export interface BaseObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  layerId: string;
  parentId: string | null;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface RectObject extends BaseObject {
  type: 'rect';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export interface EllipseObject extends BaseObject {
  type: 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface DiamondObject extends BaseObject {
  type: 'diamond';
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface TextObject extends BaseObject {
  type: 'text';
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight?: number;  // multiplier, default 1.25
}

export interface GroupObject extends BaseObject {
  type: 'group';
  childIds: string[];
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface ImageObject extends BaseObject {
  type: 'image';
  src: string;
  originalWidth: number;
  originalHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  objectFit: 'contain' | 'cover' | 'fill';
}

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type CanvasGridStyle = 'dots' | 'grid' | 'none';

export interface PenObject extends BaseObject {
  type: 'pen';
  points: PenPoint[];   // relative to (obj.x, obj.y) in world units
  color: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
}

export interface ArrowObject extends BaseObject {
  type: 'arrow';
  x1: number;          // absolute world coords of start point
  y1: number;
  x2: number;          // absolute world coords of end point
  y2: number;
  curved: boolean;
  bendOffset: number;  // perpendicular offset of bezier control point (world units)
  startHead: ArrowHead;
  endHead: ArrowHead;
  stroke: string;
  strokeWidth: number;
}

export type CanvasObject = RectObject | EllipseObject | DiamondObject | TextObject | GroupObject | ImageObject | PenObject | ArrowObject;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'arrow-start' | 'arrow-end';

export type InteractionMode =
  | 'idle'
  | 'panning'
  | 'selecting'
  | 'moving'
  | 'resizing'
  | 'drawing'
  | 'drawing-pen'
  | 'drawing-arrow'
  | 'erasing'
  | 'rotating'
  | 'editing-text';

export interface SnapGuide {
  type: 'h' | 'v';
  pos: number;
}
