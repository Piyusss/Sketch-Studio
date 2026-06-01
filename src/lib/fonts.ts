export interface FontDef {
  label: string;
  value: string;        // CSS font-family string passed to ctx.font / style
  category: string;
}

export const FONT_FAMILIES: FontDef[] = [
  // Handwritten / Whiteboard
  { label: 'Caveat',        value: 'Caveat, cursive',                       category: 'Handwritten' },
  { label: 'Patrick Hand',  value: '"Patrick Hand", cursive',               category: 'Handwritten' },
  // Professional / Document
  { label: 'Inter',         value: 'Inter, system-ui, sans-serif',          category: 'Professional' },
  { label: 'Roboto',        value: 'Roboto, sans-serif',                    category: 'Professional' },
  { label: 'Open Sans',     value: '"Open Sans", sans-serif',               category: 'Professional' },
  // Code / Monospace
  { label: 'JetBrains Mono',value: '"JetBrains Mono", monospace',          category: 'Code' },
  { label: 'Fira Code',     value: '"Fira Code", monospace',               category: 'Code' },
  // Serif
  { label: 'Merriweather',  value: 'Merriweather, serif',                  category: 'Serif' },
  { label: 'Georgia',       value: 'Georgia, serif',                       category: 'Serif' },
  { label: 'Times New Roman',value: '"Times New Roman", serif',            category: 'Serif' },
];

export const FONT_CATEGORIES = ['Handwritten', 'Professional', 'Code', 'Serif'] as const;

export const DEFAULT_FONT = 'Inter, system-ui, sans-serif';
