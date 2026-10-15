import { test, expect, type Page } from '@playwright/test'
async function open(page: Page, kind: 'pv' | 'wind') {
  await page.goto('/')
  await page.getByRole('tab', { name: /Generation/ }).click()
  await page
    .locator('.device-row')
    .filter({ hasText: kind === 'pv' ? 'Solar farm' : 'WT-01' })
    .click()
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
  await expect(page.locator('.renewable-plate')).toHaveAttribute('data-stage', '0')
  await expect(page.getByRole('button', { name: 'Generation principle', exact: true })).toHaveCount(
    0,
  )
  await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toHaveCount(0)
  await page.locator('.renewable-stages button').nth(2).click()
  return page.locator('.generation-overlay')
}
for (const kind of ['pv', 'wind'] as const) {
  test(`${kind}: play directly on exploded parts without replacing the figure`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const overlay = await open(page, kind)
    const figure = page.locator('.renewable-plate'),
      play = page.getByRole('button', { name: 'Play animation', exact: true })
    await expect(figure).toHaveAttribute('aria-busy', 'false')
    await expect(play).toBeEnabled()
    await expect(overlay).toHaveAttribute('data-running', 'false')
    const initialClock = await overlay.getAttribute('data-clock')
    await page.waitForTimeout(200)
    await expect(overlay).toHaveAttribute('data-clock', initialClock!)
    const part = page.locator(`[data-part="${kind === 'pv' ? 'silicon-base' : 'generator'}"]`)
    const pose = await part.getAttribute('transform')
    await page
      .locator('.renewable-svg')
      .evaluate((el) => el.setAttribute('data-identity', 'same-svg'))
    await play.click()
    await expect(overlay).toHaveAttribute('data-running', 'true')
    await expect
      .poll(async () => Number(await overlay.getAttribute('data-clock')))
      .toBeGreaterThan(0.4)
    await expect(part).toHaveAttribute('transform', pose!)
    await expect(page.locator('.renewable-svg')).toHaveAttribute('data-identity', 'same-svg')
    await expect(figure).toHaveAttribute('data-stage', '2')
    // Click the original physical part while particles/rotors are above it.
    const clickId = kind === 'pv' ? 'silicon-base' : 'gearbox'
    const face = page.locator(`[data-part="${clickId}"] .iso-top`)
    // The emitter physically occludes the centre of the lower silicon wafer.
    // Exercise its exposed front edge, not a forced click through another layer.
    const bounds = await face.boundingBox()
    await face.click(
      kind === 'pv' ? { position: { x: bounds!.width * 0.5, y: bounds!.height * 0.85 } } : {},
    )
    await expect(page.locator('.renewable-info-copy h2')).toHaveText(
      kind === 'pv' ? 'Silicon base' : 'Gearbox',
    )
    await expect(page.getByRole('button', { name: 'Pause animation', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Pause animation', exact: true }).click()
    const stopped = await overlay.getAttribute('data-clock')
    await page.waitForTimeout(250)
    await expect(overlay).toHaveAttribute('data-clock', stopped!)
    if (kind === 'wind') {
      expect(Number(await overlay.getAttribute('data-generator-phase'))).toBeCloseTo(
        Number(await overlay.getAttribute('data-rotor-phase')) * 4,
        3,
      )
      const stator = await overlay.locator('[data-fixed="stator"]').getAttribute('transform')
      const rotor = await overlay.locator('[data-moving="rotor"]').getAttribute('transform')
      await play.click()
      await expect
        .poll(() => overlay.locator('[data-moving="rotor"]').getAttribute('transform'))
        .not.toBe(rotor)
      await expect(overlay.locator('[data-fixed="stator"]')).toHaveAttribute('transform', stator!)
    } else {
      await play.click()
      await expect
        .poll(async () => Number(await overlay.getAttribute('data-clock')))
        .toBeGreaterThan(1.5)
      await expect(overlay.locator('.external-electron').first()).toHaveCSS('opacity', '1')
    }
    await page
      .getByRole('switch', { name: kind === 'pv' ? 'Sunlight' : 'Wind', exact: true })
      .click()
    await expect(overlay).toHaveAttribute('data-running', 'false')
    if (kind === 'pv')
      await expect(overlay.locator('.external-electron').first()).toHaveCSS('opacity', '0')
    await page
      .getByRole('switch', { name: kind === 'pv' ? 'Sunlight' : 'Wind', exact: true })
      .click()
    await expect(overlay).toHaveAttribute('data-running', 'true')
    // Offscreen/hidden illustration must suspend its clock.
    await figure.evaluate((el) => (el.style.display = 'none'))
    await expect(overlay).toHaveAttribute('data-running', 'false')
    const hidden = await overlay.getAttribute('data-clock')
    await page.waitForTimeout(200)
    await expect(overlay).toHaveAttribute('data-clock', hidden!)
    await figure.evaluate((el) => el.style.removeProperty('display'))
    await expect(overlay).toHaveAttribute('data-running', 'true')
    await page.locator('.renewable-stages button').nth(1).click()
    await expect(overlay).toHaveAttribute('data-running', 'false')
    await expect(page.locator('.inline-generation')).toHaveCount(0)
    await expect(figure).toHaveAttribute('aria-busy', 'false')
    await page.locator('.renewable-stages button').nth(2).click()
    await expect(play).toBeEnabled()
    await expect(overlay).toHaveAttribute('data-running', 'false')
    await page.getByRole('button', { name: 'Reassemble', exact: true }).click()
    await expect(page.locator('.renewable-svg')).toHaveAttribute('data-progress', '0.0000')
    expect(errors).toEqual([])
  })
  test(`${kind}: reduced motion, narrow view and interrupted expansion`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const overlay = await open(page, kind)
    await expect(overlay).toHaveAttribute('data-ready', 'true')
    await expect(
      page.getByRole('button', { name: 'Reduced motion · static directions', exact: true }),
    ).toBeDisabled()
    await expect(overlay).toHaveAttribute('data-clock', '0.0000')
    await expect(overlay).toHaveAttribute('data-running', 'false')
    await page.getByRole('button', { name: 'Toggle explorer theme' }).click()
    expect(
      await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.getByRole('button', { name: 'Reassemble', exact: true }).click()
    await page.locator('.renewable-stages button').nth(2).click()
    await expect(page.getByRole('button', { name: 'Play animation', exact: true })).toBeEnabled()
    await expect(overlay).toHaveAttribute('data-running', 'false')
  })
}

for (const kind of ['pv', 'wind'] as const) {
  test(`${kind}: incoming energy follows playback and source controls`, async ({ page }) => {
    const overlay = await open(page, kind)
    await page.getByRole('button', { name: 'Play animation', exact: true }).click()
    if (kind === 'pv') {
      const samples = await page.evaluate(
        () =>
          new Promise<{ time: number; photon: number; electron: number; flash: number }[]>(
            (resolve) => {
              const root = document.querySelector('.generation-overlay') as SVGGElement
              const photon = root.querySelector('[data-particle="photon"]') as SVGGElement
              const electron = root.querySelector('[data-particle="electron"]') as SVGGElement
              const flash = root.querySelector('[data-energy="absorption"]') as SVGGElement
              const results: { time: number; photon: number; electron: number; flash: number }[] =
                  [],
                start = performance.now()
              const sample = () => {
                const time = Number(root.dataset.clock)
                results.push({
                  time,
                  photon: Number(photon.style.opacity),
                  electron: Number(electron.style.opacity),
                  flash: Number(flash.dataset.strength),
                })
                if (time >= 2.1 || performance.now() - start > 8000) resolve(results)
                else requestAnimationFrame(sample)
              }
              sample()
            },
          ),
      )
      expect(samples.some((s) => s.time < 1.3 && s.photon > 0.2 && s.electron === 0)).toBe(true)
      expect(
        samples.some((s) => s.time > 1.36 && s.photon === 0 && s.electron > 0.2 && s.flash > 0.1),
      ).toBe(true)
      await expect(overlay.locator('.sunlit-surface')).toHaveCount(1)
    } else {
      const stream = overlay.locator('.wind-streak').first()
      await expect(stream).toHaveAttribute('d', /^M.+L/)
      const initial = await stream.getAttribute('data-phase')
      await expect.poll(() => stream.getAttribute('data-phase')).not.toBe(initial)
    }
    await page.getByRole('button', { name: 'Pause animation', exact: true }).click()
    const clock = await overlay.getAttribute('data-clock')
    await page.waitForTimeout(250)
    await expect(overlay).toHaveAttribute('data-clock', clock!)
    await page
      .getByRole('switch', { name: kind === 'pv' ? 'Sunlight' : 'Wind', exact: true })
      .click()
    await expect(overlay.locator(kind === 'pv' ? '.sunlight-field' : '.wind-field')).toHaveCSS(
      'opacity',
      '0',
    )
    if (kind === 'pv')
      await expect(overlay.locator('.absorption-flash').first()).toHaveCSS('opacity', '0')
  })
}

test('wind: overview auto-plays without advancing and remains controllable', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: /Generation/ }).click()
  await page.locator('.device-row').filter({ hasText: 'WT-01' }).click()
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
  const overlay = page.locator('.generation-overlay'),
    plate = page.locator('.renewable-plate')
  const rotor = overlay.locator('[data-moving="rotor"]')
  await expect(overlay).toHaveAttribute('data-overview', 'true')
  await expect(overlay).toHaveAttribute('data-running', 'true')
  await expect(plate).toHaveAttribute('aria-busy', 'false')
  const angle = await rotor.getAttribute('transform')
  const tower = await page.locator('[data-part="tower"]').getAttribute('transform')
  const stream = await overlay.locator('.wind-streak').first().getAttribute('d')
  await expect.poll(() => rotor.getAttribute('transform')).not.toBe(angle)
  await expect
    .poll(() => overlay.locator('.wind-streak').first().getAttribute('d'))
    .not.toBe(stream)
  await expect(page.locator('[data-part="tower"]')).toHaveAttribute('transform', tower!)
  await expect(plate).toHaveAttribute('data-stage', '0')
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click()
  const paused = await rotor.getAttribute('transform')
  await page.waitForTimeout(250)
  await expect(rotor).toHaveAttribute('transform', paused!)
  await page.getByRole('button', { name: 'Play animation', exact: true }).click()
  await page.getByRole('switch', { name: 'Wind', exact: true }).click()
  await expect(overlay).toHaveAttribute('data-running', 'false')
  await expect(overlay.locator('.wind-field')).toHaveCSS('opacity', '0')
  await page.getByRole('switch', { name: 'Wind', exact: true }).click()
  await expect(overlay).toHaveAttribute('data-running', 'true')
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click()
  await overlay.locator('.full-blade').first().click()
  await expect(plate).toHaveAttribute('data-stage', '1')
  await expect(overlay).toHaveAttribute('data-running', 'false')
  await page.getByRole('button', { name: 'Reassemble', exact: true }).click()
  await expect(overlay).toHaveAttribute('data-running', 'true')
  await expect(plate).toHaveAttribute('data-stage', '0')
})

test('wind: overview stays static with reduced motion on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('tab', { name: /Generation/ }).click()
  await page.locator('.device-row').filter({ hasText: 'WT-01' }).click()
  await page.getByRole('button', { name: 'Explore inside', exact: true }).click()
  await expect(page.locator('.generation-overlay')).toHaveAttribute('data-running', 'false')
  await expect(page.locator('.generation-overlay')).toHaveAttribute('data-overview', 'true')
  await expect(
    page.getByRole('button', { name: 'Reduced motion · static directions', exact: true }),
  ).toBeDisabled()
  expect(
    await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  await expect(page.locator('.full-blade')).toHaveCount(3)
})
