export const MODULE_LABELS = [
  { key: 'cover', piece: 'module-lid', side: 'left', y: 0.22 },
  { key: 'cells', piece: 'cell-2-0', side: 'left', y: 0.49 },
  { key: 'board', piece: 'acquisition-board', side: 'right', y: 0.48 },
  { key: 'terminal', piece: 'terminal-cover', side: 'right', y: 0.63 },
  { key: 'coldplate', piece: 'module-coldplate', side: 'left', y: 0.74 },
  { key: 'tray', piece: 'module-tray', side: 'left', y: 0.86 },
] as const
export type ModuleDetail = (typeof MODULE_LABELS)[number]['key']
export const CELL_IDS = Array.from({ length: 12 }, (_, i) => `cell-${Math.floor(i / 4)}-${i % 4}`)
export const cellNumber = (id: string) => String(CELL_IDS.indexOf(id) + 1).padStart(2, '0')
export function detailForPiece(id: string): string | null {
  if (CELL_IDS.includes(id)) return id
  if (id === 'module-lid' || id.startsWith('module-cover-') || id === 'module-handle')
    return 'cover'
  if (id === 'acquisition-board' || id.startsWith('chip-')) return 'board'
  return MODULE_LABELS.find((label) => label.piece === id)?.key ?? null
}
export const matchesDetail = (id: string, detail: string) =>
  detail === 'cells' ? CELL_IDS.includes(id) : detailForPiece(id) === detail
