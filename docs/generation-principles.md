# Generation animation — integrated Figure extension

The existing Anatomy SVG remains the sole equipment figure. Preserve the audited PV layers and wind drivetrain, their click targets, selection and reversible disassembly motion. Remove the independent generation page and its connected-cell geometry.

## Interaction

Generation controls appear on Complete turbine and at stage 2: Cell detail or Drivetrain. Enable them only after the expansion settles. Cell detail and Drivetrain are initially paused; explicit Play starts motion without changing the camera, replacing the SVG, reassembling parts or resetting selection. Pause preserves phase. A source switch stops generation. Leaving stage 2 stops playback; returning requires Play again. Component descriptions remain beside the drawing, followed by the generation explanation.

## Coordinate model

PV paths use the original pvCell projection and the final exploded layer positions. Photons precede electron/hole separation; holes remain represented within the semiconductor, and electrons follow a schematic external load circuit from n to p contact. Visible gaps represent the exploded illustration, not transport through air. The camera includes the external circuit and incident light.

Wind overlays use the original wind projection and the same offsets as main shafts, high-speed shaft and generator. Planar shortened blades and generator-face cross-section rotate in their projected planes. A shared clock drives the 1:4 phase relationship, surface marks and AC trace. Stator, bearings and housings remain fixed. Gaps are for inspection, not operating mechanical connections. Rotating overlays are explanatory planar art, not additional audited solid bodies.

## Runtime and checks

One requestAnimationFrame clock updates refs without React state per frame. Playback stops when not ready, paused, source-off, offscreen, document-hidden or reduced motion. The disassembly clock owns the geometry; generation only becomes visible at its settled endpoint. Reduced motion settles the geometry immediately and retains static direction indicators.

Browser regression tests verify same SVG identity and physical part transforms while playing, hit targets under overlays, pause, source switches, offscreen suspension, 4:1 phase ratio, stationary stator, level changes, reassembly, reduced motion and 390 px layout. Existing structural geometry audits remain in `npm run renewables:build`.

References: [DOE photovoltaic cell basics](https://www.energy.gov/cmei/systems/solar-photovoltaic-cell-basics) and [DOE wind turbine mechanisms](https://www.energy.gov/cmei/systems/explore-wind-turbine-text-version), checked 2026-10-14. No plant simulation changes or real equipment controls.

## Incoming energy effects

Nine precomputed wind paths approach the rotor along its local shaft axis. Short moving sections follow the shared clock and fade at both ends. Warm sunlight beams and the optical-coating illumination are projected onto the existing cell layers. Each photon fades at its absorption site; a smooth local ring marks energy absorption before electron/hole markers separate from the same point. A photon excites an electron; it is not converted into one.

No independent CSS animation loops, particle systems or WebGL passes are added. Pausing freezes these effects, source-off hides them, and reduced motion removes the moving flow and absorption pulse. The waveform, rotor, charge carriers and energy effects all use the same clock. The energy paths are schematic overlays, not a CFD or microscopic transport simulation.

## Complete turbine overview

The wind overview auto-plays on entry while preserving stage 0. Full-length blade profiles rotate in the same projected rotor plane around the fixed hub; incoming wind uses the complete turbine coordinates without exploded offsets. Tower and nacelle remain stationary. Pause, source-off, offscreen suspension and reduced motion apply to the overview as well. The framing includes the entire swept rotor disk and incoming airflow at every angle. Direct blade clicks still open the nacelle.

The diagram uses higher-contrast blue airflow and gold illumination, with larger charge symbols and absorption rings. The overview rotor is explanatory planar art; the original static solid geometry audit is not a claim of a dynamic 3D blade simulation.
