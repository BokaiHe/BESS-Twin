import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { MODULE_LABELS, type ModuleDetail } from './moduleDetails'

type Props = {
  scene: RefObject<SVGSVGElement | null>
  labels: Record<ModuleDetail, { short: string }>
}

// Read the final projected faces, so labels follow all four rack variants.
// They mount only after the reversible animation has settled.
export function ModuleAnnotations({ scene, labels }: Props) {
  const group = useRef<SVGGElement>(null)
  const [anchors, setAnchors] = useState<{ x: number; y: number }[]>([])
  useLayoutEffect(() => {
    const svg = scene.current
    if (!svg) return
    const rootMatrix = svg.getScreenCTM()
    if (!rootMatrix) return
    setAnchors(
      MODULE_LABELS.map((label) => {
        const face = svg.querySelector<SVGPathElement>(
          `[data-piece="${label.piece}"] ${label.key === 'tray' ? '.iso-shade[data-shade="3"]' : '.iso-top'}`,
        )
        const matrix = face?.getScreenCTM()
        if (!face || !matrix) return { x: 0, y: 0 }
        const box = face.getBBox()
        const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
          .matrixTransform(matrix)
          .matrixTransform(rootMatrix.inverse())
        return { x: point.x, y: point.y }
      }),
    )
  }, [scene])
  const box = scene.current?.viewBox.baseVal
  if (!box || !anchors.length) return null
  const scale = box.width / 900
  return (
    <g ref={group} className="module-annotations" aria-hidden="true" pointerEvents="none">
      {MODULE_LABELS.map((label, index) => {
        const left = label.side === 'left'
        const x = box.x + box.width * (left ? 0.04 : 0.96),
          y = box.y + box.height * label.y
        const elbow = box.x + box.width * (left ? 0.28 : 0.72),
          anchor = anchors[index]
        return (
          <g key={label.key} data-annotation={label.key}>
            <path
              className="module-leader"
              d={`M${x} ${y + 7 * scale} H${elbow} L${anchor.x} ${anchor.y}`}
            />
            <circle className="module-anchor" cx={anchor.x} cy={anchor.y} r={2.4 * scale} />
            <text
              className="module-label-text"
              x={x}
              y={y}
              fontSize={12 * scale}
              textAnchor={left ? 'start' : 'end'}
            >
              {String(index + 1).padStart(2, '0')} {labels[label.key].short}
            </text>
          </g>
        )
      })}
    </g>
  )
}
