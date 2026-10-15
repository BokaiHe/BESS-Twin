import { describe, expect, it } from 'vitest'
import { GLOSSARY, searchGlossary } from './glossary'
import { parameterTerms, strategyTerms } from './termLinks'
import { PARAMETER_RULES } from '../domain/parameters'
describe('learning glossary', () => {
  it('has unique bilingual entries and valid cross-references', () => {
    const ids = new Set(GLOSSARY.map((e) => e.id))
    expect(ids.size).toBe(GLOSSARY.length)
    expect(ids.size).toBeGreaterThanOrEqual(20)
    for (const entry of GLOSSARY) {
      for (const lang of ['zh', 'en'] as const) {
        expect(entry.term[lang].trim()).not.toBe('')
        expect(entry.short[lang].trim()).not.toBe('')
        expect(entry.short[lang]).not.toMatch(/undefined|NaN|Infinity/)
      }
      expect(entry.short.zh.length).toBeLessThanOrEqual(40)
      expect(entry.short.en.split(/\s+/).length).toBeLessThanOrEqual(25)
      for (const id of entry.related ?? []) expect(ids.has(id)).toBe(true)
    }
  })
  it('covers every editable parameter and all dispatch strategies', () => {
    expect(Object.keys(parameterTerms)).toEqual(Object.keys(PARAMETER_RULES))
    for (const id of [...Object.values(parameterTerms), ...Object.values(strategyTerms)])
      expect(GLOSSARY.some((e) => e.id === id)).toBe(true)
    expect(Object.keys(strategyTerms)).toHaveLength(8)
  })
  it('searches both languages, acronyms and multiple case-insensitive words', () => {
    expect(searchGlossary('削峰').some((e) => e.id === 'peak-shaving')).toBe(true)
    expect(searchGlossary('  state CHARGE ').map((e) => e.id)).toContain('soc')
    expect(searchGlossary('PCS').map((e) => e.id)).toContain('pcs')
    expect(searchGlossary('not-a-real-term')).toEqual([])
    expect(searchGlossary('   ')).toHaveLength(GLOSSARY.length)
  })
})
