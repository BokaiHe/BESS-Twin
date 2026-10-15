import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { cellGeometry, cellTurnOrder } from './cellGeometry'
import { cellView, cellCamera, frontAnchor, DEFAULT_ORBIT } from './cellView'
import { BELOW_ORDER } from './cellOrbitConfig'
import { CellTransport, type CellFlowMode } from './CellTransport'

export type CellMaterial = 'positive' | 'negative' | 'separator' | 'electrolyte'
export const CELL_MATERIALS: CellMaterial[] = ['positive', 'separator', 'negative', 'electrolyte']
const smooth = (value: number, a: number, b: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function CellCutaway({
  active,
  onSelect,
  reduced,
  visible,
  open,
  onMoving,
  flowMode,
  flowPlaying,
  cameraCommand,
}: {
  active: CellMaterial
  onSelect: (key: CellMaterial) => void
  reduced: boolean
  visible: boolean
  open: boolean
  onMoving: (moving: boolean) => void
  flowMode: CellFlowMode
  flowPlaying: boolean
  cameraCommand: { id: number; kind: 'reset' | 'in' | 'out' }
}) {
  const { t } = useI18n(),
    c = t.cabinet
  const svg = useRef<SVGSVGElement>(null),
    layer = useRef<SVGGElement>(null)
  const nodes = useRef(new Map<string, SVGGElement>()),
    progress = useRef(0),
    callback = useRef(onMoving)
  const [settled, setSettled] = useState(false)
  const orbit = useRef({ ...DEFAULT_ORBIT })
  const drawRef = useRef<() => void>(() => {})
  const pendingFrame = useRef(0)
  const drag = useRef<{
    id: number
    x: number
    y: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const suppressClick = useRef(false)
  const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value))
  const redraw = () => {
    if (!pendingFrame.current)
      pendingFrame.current = requestAnimationFrame(() => {
        pendingFrame.current = 0
        drawRef.current()
      })
  }
  const zoom = (factor: number, x = 450, y = 295) => {
    const view = orbit.current,
      next = clamp(view.zoom * factor, 0.65, 2.2),
      ratio = next / view.zoom
    view.panX = (x - 450) * (1 - ratio) + view.panX * ratio
    view.panY = (y - 295) * (1 - ratio) + view.panY * ratio
    view.zoom = next
    redraw()
  }
  useEffect(() => () => cancelAnimationFrame(pendingFrame.current), [])
  useEffect(() => {
    const node = svg.current
    const wheel = (event: WheelEvent) => {
      if (!settled || !open) return
      event.preventDefault()
      event.stopPropagation()
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        node!.getScreenCTM()!.inverse(),
      )
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 560 : 1)
      zoom(Math.exp(-clamp(delta, -240, 240) * 0.0015), point.x, point.y)
    }
    node?.addEventListener('wheel', wheel, { passive: false })
    return () => node?.removeEventListener('wheel', wheel)
  }, [settled, open])
  const lastCommand = useRef(cameraCommand.id)
  useEffect(() => {
    if (lastCommand.current === cameraCommand.id) return
    lastCommand.current = cameraCommand.id
    if (!settled || !open) return
    if (cameraCommand.kind === 'reset') {
      orbit.current = { ...DEFAULT_ORBIT }
      redraw()
    } else zoom(cameraCommand.kind === 'in' ? 1.15 : 1 / 1.15)
  }, [cameraCommand, settled, open])
  useEffect(() => {
    callback.current = onMoving
  }, [onMoving])
  useEffect(() => {
    let raf = 0,
      last = 0,
      order = '',
      wasTurning = false
    const target = open ? 1 : 0
    setSettled(false)
    callback.current(true)
    const draw = () => {
      const t = progress.current
      const unfold = Math.min(1, t / 0.62)
      const turn = smooth(t, 0.62, 1)
      const shares = { shell: smooth(unfold, 0, 0.4), layers: smooth(unfold, 0.45, 1) }
      svg.current?.setAttribute('data-turn', turn.toFixed(4))
      svg.current?.setAttribute('data-unfold', unfold.toFixed(4))
      const sorted = cellGeometry
        .map((p) => {
          const share = shares[p.ride as keyof typeof shares]
          const node = nodes.current.get(p.id)
          node?.setAttribute(
            'transform',
            turn > 0
              ? 'translate(0 0)'
              : `translate(${p.offset[0] * share} ${p.offset[1] * share})`,
          )
          node?.setAttribute(
            'opacity',
            String(
              p.group === 'housing'
                ? (1 - 0.9 * smooth(unfold, 0.25, 0.6)) * (1 - smooth(turn, 0, 0.6))
                : 1,
            ),
          )
          let depth = p.key + p.depth * share
          if (node && (turn > 0 || wasTurning) && !(p.group === 'housing' && turn >= 0.6)) {
            const art =
              turn > 0
                ? cellView(p, turn, orbit.current)
                : { ...p.paths, pores: p.pores, textures: p.textures, depth }
            node.querySelector('.iso-fill')?.setAttribute('d', art.fill)
            node.querySelector('.iso-top')?.setAttribute('d', art.top)
            node.querySelector('.iso-edge')?.setAttribute('d', art.outline)
            node.querySelector('.cell-wetting')?.setAttribute('d', art.shades[2])
            node
              .querySelectorAll('.iso-shade')
              .forEach((face, i) => face.setAttribute('d', art.shades[i]))
            node.querySelectorAll('.cell-pore').forEach((dot, i) => {
              dot.setAttribute('cx', String(art.pores[i][0]))
              dot.setAttribute('cy', String(art.pores[i][1]))
            })
            node
              .querySelectorAll('.iso-line:not(.iso-edge)')
              .forEach((line, i) => line.setAttribute('d', art.textures[i]))
            if (turn > 0) {
              depth = cellTurnOrder.indexOf(p.id)
              if (cellCamera(turn, orbit.current).elevation < 0 && p.group !== 'housing')
                depth = 100 + BELOW_ORDER.indexOf(p.id)
            }
          }
          return { id: p.id, key: depth }
        })
        .sort((a, b) => a.key - b.key)
      wasTurning = turn > 0
      const key = sorted.map((p) => p.id).join('|')
      if (key !== order) {
        for (const p of sorted) {
          const node = nodes.current.get(p.id)
          if (node) layer.current?.appendChild(node)
        }
        order = key
      }
      svg.current?.setAttribute('data-progress', t.toFixed(4))
      svg.current?.setAttribute('data-yaw', String(orbit.current.yaw))
      svg.current?.setAttribute('data-pitch', String(orbit.current.pitch))
      svg.current?.setAttribute('data-zoom', orbit.current.zoom.toFixed(4))
      svg.current?.setAttribute(
        'data-bottom',
        String(cellCamera(turn, orbit.current).elevation < 0),
      )
      svg.current?.querySelectorAll('[data-label-piece]').forEach((label) => {
        const [x, y] = frontAnchor(label.getAttribute('data-label-piece')!, orbit.current)
        const lx = Number(label.getAttribute('data-label-x')),
          ly = Number(label.getAttribute('data-label-y'))
        label.querySelector('path')?.setAttribute('d', `M${lx} ${ly - 12} L${x} ${y}`)
        label.querySelector('circle')?.setAttribute('cx', String(x))
        label.querySelector('circle')?.setAttribute('cy', String(y))
      })
      svg.current?.dispatchEvent(new Event('cell-view-change'))
    }
    drawRef.current = draw
    const tick = (now: number) => {
      const dt = last ? Math.max(0, (now - last) / 1000) : 0
      last = now
      progress.current +=
        Math.sign(target - progress.current) *
        Math.min(Math.abs(target - progress.current), dt / 2.8)
      draw()
      if (Math.abs(target - progress.current) < 0.000001) {
        if (target === 0) {
          orbit.current = { ...DEFAULT_ORBIT }
          draw()
        }
        setSettled(true)
        callback.current(false)
        raf = 0
      } else raf = requestAnimationFrame(tick)
    }
    const resume = () => {
      cancelAnimationFrame(raf)
      last = 0
      if (reduced) {
        progress.current = target
        draw()
        if (target === 0) {
          orbit.current = { ...DEFAULT_ORBIT }
          draw()
        }
        setSettled(true)
        callback.current(false)
      } else if (visible && !document.hidden) raf = requestAnimationFrame(tick)
    }
    draw()
    resume()
    document.addEventListener('visibilitychange', resume)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [open, reduced, visible])
  const callouts = [
    { key: 'positive', id: 'positive-electrode', x: 180, y: 475 },
    { key: 'separator', id: 'separator', x: 450, y: 495 },
    { key: 'negative', id: 'negative-electrode', x: 720, y: 475 },
    { key: 'electrolyte', id: 'separator', x: 450, y: 145 },
  ] as const
  return (
    <svg
      ref={svg}
      className="iso-svg cell-cutaway-svg"
      viewBox="0 0 900 560"
      role="img"
      tabIndex={0}
      data-interactive={settled && open}
      onPointerDown={(e) => {
        if (!settled || !open || e.button !== 0 || e.pointerType === 'touch') return
        e.currentTarget.focus({ preventScroll: true })
        drag.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        }
        suppressClick.current = false
      }}
      onPointerMove={(e) => {
        const state = drag.current
        if (!state || state.id !== e.pointerId) return
        if (!state.moved && Math.hypot(e.clientX - state.startX, e.clientY - state.startY) < 5)
          return
        if (!state.moved) e.currentTarget.setPointerCapture(e.pointerId)
        state.moved = true
        suppressClick.current = true
        const scale = 900 / e.currentTarget.getBoundingClientRect().width
        orbit.current.yaw = clamp(orbit.current.yaw + (e.clientX - state.x) * scale * 0.18, -55, 55)
        orbit.current.pitch = clamp(
          orbit.current.pitch - (e.clientY - state.y) * scale * 0.16,
          -25,
          40,
        )
        state.x = e.clientX
        state.y = e.clientY
        e.currentTarget.setAttribute('data-dragging', 'true')
        redraw()
      }}
      onPointerUp={(e) => {
        if (drag.current?.id !== e.pointerId) return
        drag.current = null
        e.currentTarget.removeAttribute('data-dragging')
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => {
        drag.current = null
        svg.current?.removeAttribute('data-dragging')
      }}
      onLostPointerCapture={() => {
        drag.current = null
        svg.current?.removeAttribute('data-dragging')
      }}
      onKeyDown={(e) => {
        if (!settled || !open) return
        if (
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(
            e.key,
          )
        )
          return
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'Home') orbit.current = { ...DEFAULT_ORBIT }
        else if (e.key === '+' || e.key === '=') zoom(1.15)
        else if (e.key === '-') zoom(1 / 1.15)
        else {
          orbit.current.yaw = clamp(
            orbit.current.yaw + (e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : 0),
            -55,
            55,
          )
          orbit.current.pitch = clamp(
            orbit.current.pitch + (e.key === 'ArrowUp' ? 5 : e.key === 'ArrowDown' ? -5 : 0),
            -25,
            40,
          )
        }
        redraw()
      }}
      aria-label={`${c.camera.help} ${c.cellDiagram} ${c.flow[flowMode].ions} ${c.flow[flowMode].electrons}`}
      onClick={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false
          return
        }
        const key = (e.target as Element).closest('[data-material]')?.getAttribute('data-material')
        if (settled && open && CELL_MATERIALS.includes(key as CellMaterial))
          onSelect(key as CellMaterial)
      }}
    >
      <g ref={layer}>
        {cellGeometry.map((p) => {
          const porous = p.id.endsWith('-electrode') || p.id === 'separator'
          return (
            <g
              key={p.id}
              ref={(node) => {
                if (node) nodes.current.set(p.id, node)
                else nodes.current.delete(p.id)
              }}
              data-cell-piece={p.id}
              data-material={p.group === 'housing' ? undefined : p.group}
              className="iso-solid cell-internal-part"
              data-lit={active === p.group || (active === 'electrolyte' && porous) ? '' : undefined}
            >
              <path className="iso-fill" d={p.paths.fill} />
              {p.paths.shades.map((d, i) => (
                <path key={i} className="iso-shade" data-shade={i} d={d} />
              ))}
              <path className="iso-top" d={p.paths.top} />
              {porous && (
                <path
                  className="cell-wetting"
                  data-active={active === 'electrolyte'}
                  d={p.paths.shades[2]}
                />
              )}
              {p.pores.map(([cx, cy], i) => (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={p.group === 'separator' ? 1.25 : 0.55}
                  className="cell-pore"
                />
              ))}
              {p.textures.map((d, i) => (
                <path key={i} d={d} className="iso-line" data-tone="mid" />
              ))}
              <path className="iso-line iso-edge" d={p.paths.outline} data-tone="hi" />
            </g>
          )
        })}
      </g>
      {settled && open && (
        <CellTransport
          mode={flowMode}
          playing={flowPlaying}
          reduced={reduced}
          visible={visible}
          orbit={orbit}
        />
      )}
      {settled && open && (
        <g className="cell-callouts">
          {callouts.map((label) => {
            const [x, y] = frontAnchor(label.id, orbit.current)
            return (
              <g
                key={label.key}
                data-material={label.key}
                className="cell-callout"
                data-label-piece={label.id}
                data-label-x={label.x}
                data-label-y={label.y}
              >
                <path d={`M${label.x} ${label.y - 12} L${x} ${y}`} className="module-leader" />
                <circle cx={x} cy={y} r={2.5} className="module-anchor" />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  className="module-label-text"
                  fontSize={15}
                >
                  {c.internalParts[label.key].short}
                </text>
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}
