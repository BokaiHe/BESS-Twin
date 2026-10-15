import { useEffect, useLayoutEffect, useRef, type PointerEvent } from 'react'
import { cabinetGeometry } from './geometry'
import { ModuleAnnotations } from './ModuleAnnotations'
import { CELL_IDS, cellNumber, matchesDetail, type ModuleDetail } from './moduleDetails'

type Props = {
  enclosed: boolean
  rack: number
  target: number
  active: string
  activeDetail: string | null
  annotated: boolean
  cellLabel: string
  moduleLabels: Record<ModuleDetail, { short: string }>
  reduced: boolean
  visible: boolean
  label: string
  names: Record<string, { name: string }>
  onPick: (part: string, rack: number, piece: string) => void
  onHover: (part: string | null) => void
  onMoving: (moving: boolean) => void
  onSettled: (stage: number) => void
}

// One reversible coordinate, shared by geometry, camera and painter order.
// No independent springs: a cover cannot close before its cells have returned.
const smooth = (n: number, a = 0, b = 1) => {
  const t = Math.max(0, Math.min(1, (n - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const sharesAt = (progress: number): Record<string, number> => ({
  cover: smooth(progress - 1, 0, 0.45),
  cells: smooth(progress - 1, 0.4, 0.8),
  plate: smooth(progress - 1, 0.8, 1),
})

const closedOrder = new Map(cabinetGeometry.container.parts.map((p) => [p.id, p.key]))
export function ContainerAssembly(props: Props) {
  const { rack, target, active, reduced, visible, label, names, onPick, onHover } = props
  const art = cabinetGeometry.racks[rack]
  const shellProgress = useRef(props.enclosed ? 1 : 0)
  const svg = useRef<SVGSVGElement>(null)
  const layer = useRef<SVGGElement>(null)
  const nodes = useRef(new Map<string, SVGGElement>())
  const progress = useRef(0)
  const settled = useRef(props.onSettled)
  useEffect(() => {
    settled.current = props.onSettled
  }, [props.onSettled])

  useLayoutEffect(() => {
    props.onMoving(true)
    let frame = 0,
      last = 0,
      order = ''
    const draw = () => {
      const p = progress.current,
        extract = smooth(Math.min(p, 1)),
        shares = sharesAt(p)
      const expanded = p > 1
      const sorted = art.parts
        .map((piece) => {
          const unfold = shares[piece.layer] ?? 0
          let x = (piece.moving ? art.extraction[0] * extract : 0) + piece.lift[0] * unfold
          let y = (piece.moving ? art.extraction[1] * extract : 0) + piece.lift[1] * unfold
          const shellAmount = smooth(shellProgress.current)
          if (piece.shell) {
            const offset =
              piece.id === 'roof' ? [-8, -30] : piece.id === 'side-skin' ? [24, 0] : [-14, 16]
            x += offset[0] * (1 - shellAmount)
            y += offset[1] * (1 - shellAmount)
          }
          const node = nodes.current.get(piece.id)
          node?.setAttribute('transform', `translate(${x} ${y})`)
          // Leave the parent rack as quiet spatial context during the close-up.
          node?.setAttribute(
            'opacity',
            String(piece.shell ? shellAmount : piece.moving ? 1 : 1 - 0.92 * smooth(p - 1)),
          )
          if (piece.shell && node) node.style.visibility = shellAmount === 0 ? 'hidden' : 'visible'
          if (node)
            node.style.pointerEvents =
              (piece.shell && shellAmount === 0) || (!piece.moving && p > 1.8) ? 'none' : ''
          return {
            id: piece.id,
            depth:
              shellProgress.current > 0
                ? piece.moving
                  ? closedOrder.get(`battery-${rack}-2`)! + piece.key * 0.000001
                  : (closedOrder.get(piece.id) ?? piece.key)
                : expanded
                  ? piece.expandKey + piece.expandDepth * unfold
                  : piece.key + piece.depthLift * extract,
          }
        })
        .sort((a, b) => a.depth - b.depth)
      const nextOrder = sorted.map((p) => p.id).join('|')
      if (nextOrder !== order) {
        for (const p of sorted) {
          const node = nodes.current.get(p.id)
          if (node) layer.current?.appendChild(node)
        }
        order = nextOrder
      }
      const from = art.cameras[expanded ? 1 : 0],
        to = art.cameras[expanded ? 2 : 1]
      const t = expanded ? smooth(p - 1) : extract
      svg.current?.setAttribute('viewBox', from.map((n, i) => n + (to[i] - n) * t).join(' '))
      svg.current?.setAttribute('data-progress', p.toFixed(4))
      svg.current?.setAttribute('data-shell-progress', shellProgress.current.toFixed(4))
    }
    const tick = (now: number) => {
      // This scalar motion needs no spring stability clamp; preserve elapsed time on slow frames.
      const dt = last ? Math.max(0, (now - last) / 1000) : 0
      last = now
      const remaining = target - progress.current
      // Stage 1 takes 1.25s; stage 2 takes 1.65s. Smoothstep gives calm stops.
      const speed =
        progress.current > 1 || (progress.current === 1 && target > 1) ? 1 / 1.65 : 1 / 1.25
      // Open the shell before extracting; seat the module before closing the shell.
      if (props.enclosed || shellProgress.current === 0) {
        progress.current += Math.sign(remaining) * Math.min(Math.abs(remaining), dt * speed)
      }
      const shellTarget = props.enclosed && progress.current === 0 ? 1 : 0
      shellProgress.current +=
        Math.sign(shellTarget - shellProgress.current) *
        Math.min(Math.abs(shellTarget - shellProgress.current), dt / 0.85)
      draw()
      if (
        Math.abs(progress.current - target) < 0.000001 &&
        shellProgress.current === (props.enclosed ? 1 : 0)
      ) {
        settled.current(target)
        frame = 0
      } else frame = requestAnimationFrame(tick)
    }
    const resume = () => {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
      if (reduced) {
        progress.current = target
        shellProgress.current = props.enclosed ? 1 : 0
        draw()
        settled.current(target)
      } else if (visible && !document.hidden) frame = requestAnimationFrame(tick)
    }
    draw()
    resume()
    document.addEventListener('visibilitychange', resume)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [art, target, props.enclosed, props.onMoving, reduced, visible])

  const partAt = (target: EventTarget) =>
    target instanceof Element ? target.closest<SVGGElement>('[data-part]') : null
  const hover = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== 'touch') onHover(partAt(event.target)?.dataset.part ?? null)
  }
  return (
    <svg
      ref={svg}
      className="iso-svg"
      viewBox="0 0 900 560"
      role="img"
      aria-label={label}
      onClick={(e) => {
        const node = partAt(e.target)
        if (node?.dataset.part)
          onPick(node.dataset.part, Number(node.dataset.rack), node.dataset.piece ?? '')
      }}
      onPointerMove={hover}
      onPointerLeave={() => onHover(null)}
    >
      <path className="iso-halo" d={art.halo} />
      <g ref={layer}>
        {art.parts.map((p) => (
          <g
            key={p.id}
            ref={(node) => {
              if (node) nodes.current.set(p.id, node)
              else nodes.current.delete(p.id)
            }}
            className={`iso-solid container-part${p.shell ? ' container-shell' : ''}`}
            data-piece={p.id}
            data-part={p.group}
            data-rack={p.rack}
            data-layer={p.layer}
            data-lit={
              (props.activeDetail ? matchesDetail(p.id, props.activeDetail) : p.group === active)
                ? ''
                : undefined
            }
            data-selected-cell={
              props.activeDetail === p.id && CELL_IDS.includes(p.id) ? '' : undefined
            }
          >
            <title>
              {CELL_IDS.includes(p.id)
                ? `${props.cellLabel} ${cellNumber(p.id)}`
                : names[p.group].name}
            </title>
            <path className="iso-fill" d={p.paths.fill} />
            {p.paths.shades.map((d, i) => (
              <path key={i} className="iso-shade" data-shade={i} d={d} />
            ))}
            <path className="iso-top" d={p.paths.top} />
            <path className="iso-line" data-tone="faint" d={p.paths.crease} />
            <path className="iso-line" data-tone="faint" d={p.paths.bevel} />
            {p.textures.map((d, i) => (
              <path key={i} className="iso-line" data-tone="mid" d={d} />
            ))}
            {p.screws.map(([cx, cy], i) => (
              <circle key={i} className="container-screw" cx={cx} cy={cy} r={0.8} />
            ))}
            <path
              className="iso-line iso-edge"
              data-tone={p.group === 'enclosure' ? 'mid' : 'hi'}
              d={p.paths.outline}
            />
          </g>
        ))}
      </g>
      {props.annotated && <ModuleAnnotations scene={svg} labels={props.moduleLabels} />}
    </svg>
  )
}
