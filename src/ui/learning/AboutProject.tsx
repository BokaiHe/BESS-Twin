import { useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { PROJECT_SOURCE, projectCopy } from '../../learning/projectCopy'
import './about-project.css'
export default function AboutProject() {
  const { lang, t } = useI18n(),
    c = projectCopy[lang]
  const [active, setActive] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div className="about-project">
      <div role="tablist" aria-label={t.about} className="project-tabs">
        {c.tabs.map((title, i) => (
          <button
            key={i}
            ref={(el) => {
              tabs.current[i] = el
            }}
            role="tab"
            id={`about-tab-${i}`}
            aria-controls={`about-panel-${i}`}
            aria-selected={active === i}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? 1
                    : ['ArrowRight', 'ArrowLeft'].includes(e.key)
                      ? 1 - i
                      : null
              if (next !== null) {
                e.preventDefault()
                setActive(next)
                tabs.current[next]?.focus()
              }
            }}
          >
            {title}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`about-panel-${active}`}
        aria-labelledby={`about-tab-${active}`}
        tabIndex={0}
      >
        {active === 0 ? (
          t.aboutBody.map((p) => <p key={p}>{p}</p>)
        ) : (
          <>
            <p className="project-eyebrow">BESS Twin · React / TypeScript / Three.js</p>
            <h3>{c.title}</h3>
            <p>{c.intro}</p>
            <h4>{c.decisionsTitle}</h4>
            <div className="project-decisions">
              {c.decisions.map((d) => (
                <article key={d.title}>
                  <strong>{d.title}</strong>
                  <p>{d.body}</p>
                </article>
              ))}
            </div>
            <h4 id="project-architecture">{c.architecture}</h4>
            <ol className="project-architecture" aria-labelledby="project-architecture">
              {c.stages.map((s, i) => (
                <li key={s.title}>
                  <span aria-hidden="true">0{i + 1}</span>
                  <strong>{s.title}</strong>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
            <h4>{c.checksTitle}</h4>
            <p>{c.checks}</p>
            <h4>{c.limitsTitle}</h4>
            <p>{c.limits}</p>
            <a href={PROJECT_SOURCE} target="_blank" rel="noreferrer">
              {c.source} ↗
            </a>
            <p>{c.demo}</p>
          </>
        )}
      </section>
    </div>
  )
}
