# BESS Container Explorer

An Anatomy Figure: a healthy, integrated AC storage container, inspired by the
PowerTitan 2.0 product reference supplied by the owner:
https://www.sungrowpower.com/ca/en/products/utility-energy-storage-system/powertitan2

Design brief (before geometry): long 20-foot-style enclosure, single service side,
multiple battery racks with rack-associated string PCS, separated service bay.
The reference establishes 2.5 MW / 5 MWh integration and rack-level conversion;
it does not establish our exact internal dimensions or bill of materials.
All rack, pack and cell counts in this illustration are representative. Existing
simulation ratings remain 2.5 MW / 5 MWh per unit, 4 units total. No faults,
remote controls, new telemetry or manufacturer performance claims are added.

## Planned parts

- Enclosure: 4 corner feet, base, rear wall, end wall, 2 service posts, partition.
- Four representative rack bays: each has one PCS, three module drawers with
  cold plates and handles, a BMS controller and a DC protection box.
- Cooling bay: equipment pedestal, liquid cooling unit, service face, radiator fins.
- Safety: roof support rail, detector heads, fire-control panel and alarm indicator.
- Auxiliary: mounting shelf, power supply, UPS and communications gateway.
- Removable shell: roof and four front panels; panel seams, fasteners, closed
  ventilation slots and handles are projected onto their physical faces.
- Module detail: tray, cold plate, twelve representative cells, acquisition board,
  terminal covers. No implied product-specific series/parallel configuration.

## Interaction

Four viewing stages: Enclosure, Systems (default), Battery module, Cell layers. Removing
the enclosure reveals the healthy equipment; the module view is an educational
detail, not a physical maintenance procedure. Click geometry or accessible
part buttons for explanations (English or Chinese, following the app language). Optional tour changes highlights, not
equipment state. Pause on interaction; reduced motion disables automatic motion.
The modal pauses main timeline playback and preserves time on exit. It does not
display scenario faults or fabricate cell-level telemetry. Ratings are static
design context, read from CONFIG. Light/dark drawing themes and mobile layout.

## Reproducibility

`npm run cabinet:build` regenerates SVG paths and runs Anatomy support/depth
audits. Geometry is lazy-loaded with the inspector, never calculated per frame.
Kit source: https://github.com/wheresryan22/anatomy
Revision e6600ffc4e8e6620eeb45bf49bcdbd5e4b84163f. MIT license in
scripts/anatomy-kit/LICENSE; iso.css has the same provenance.

Keep this change local; publication is not authorized for this iteration.

Open it from the **Inside the equipment** hub below the KPI cards, or from
**Explore inside** in the BESS cluster or unit detail card. Legacy `?view=container`
links now land on the overview.

## Layered disassembly (local iteration)

The same physical drawer slides out of the selected rack, then its cover lifts,
followed by the representative cell array and acquisition board, then the cold
plate. A single reversible progress coordinate preserves this order on return.
Four rack variants use the same geometry and trajectory. The camera follows the
drawer continuously; no separate module illustration replaces the scene.
Parts: existing container plus a split five-piece cover, support tray, cold plate,
twelve prismatic cells with terminals, acquisition board, five chips and terminal
cover. The top drawer is the representative example for each rack. This is an
educational exploded view, not a maintenance sequence or exact product CAD.

Validation: each rack is audited at 21 extraction poses and 21 staged unfold poses, including resting and fully expanded positions. Runtime transforms and painter keys use these same trajectories. Browser tests cover physical rack picking, interrupted reverse motion, return-before-enclosure, keyboard input and reduced motion across all four racks.

## Component annotations and cell selection

Six callouts identify the cover, cells, monitoring board, DC interface,
cold plate and support tray in the settled exploded view. Their endpoints are
read from the projected component faces, so all rack variants remain aligned.
Callouts disappear during motion. On small screens the same names appear as
static labels below the drawing. One representative cell is highlighted; direct
cell picking or a single keyboard-accessible action opens the cell interior.
Cell numbering is illustrative; no cell telemetry or electrical rating is implied.

## Single-cell cutaway

Replace the 12-cell button grid with direct cell picking and one inspection action.
Preserve the highlighted cell on returning to the module. A dedicated prismatic
cell Figure opens its housing before separating one representative electrode pair.
Parts: base, back, removable front and two sides, lid, two terminal assemblies,
terminal mounting pads, fasteners, eight housing crimps, positive electrode and
collector/tab, porous separator, negative electrode and collector/tab.
Electrolyte is a wetting overlay on porous surfaces, never a fourth solid sheet.
Dimensions, pore sizes and layer thickness are enlarged for teaching. No claim
about manufacturer cell construction, actual wiring, chemistry or live data.
Sources: https://www.cei.washington.edu/research/energy-storage/lithium-ion-battery/
and https://www.energy.gov/cmei/ammto/breaking-it-down-next-generation-batteries

The cell uses a reversible 2.8-second sequence: the housing opens first, then
the electrode layers separate. Reduced motion settles immediately. Material
callouts appear only at rest; four controls provide keyboard and mobile access.
Returning to the module preserves its expanded pose and highlighted cell.
`npm run cell:build` regenerates the 33 solids and validates 21 motion states,
including support, clearance and painter order. Browser checks cover physical
cell/material picking, electrolyte wetting, reverse motion, focus and mobile use.

## Charge transport (local iteration)

The expanded cell overlays two distinct schematic routes anchored to the existing
electrode surfaces and collector tabs. Li+ crosses the wetted separator; electrons
travel through an external load (discharge) or DC source (charge). Directions
reverse together. Positive/cathode and negative/anode labels retain the discharge
convention. The electron arrows are opposite to conventional current.

Routes use one reversible animation phase; direction, particles, arrowheads and
explanation all read the same mode. Pause retains positions. The loop
stops offscreen, in hidden tabs and for reduced motion, and unmounts during cell
disassembly/reassembly. Static arrows remain available in reduced-motion mode.
No plant snapshots, SOC, power balance or telemetry are changed. Particle counts,
spacing and speed are illustrative and are not microscopic simulation results.
Existing material selection passes through the non-interactive transport overlay.

Reference: https://www.cei.washington.edu/research/energy-storage/lithium-ion-battery/

## Front inspection camera

The sequence unfolds the housing and layers before turning the orthographic
camera from 70° azimuth / 20° elevation to 90° / 0°. The view expands around the
electrodes while the housing fades out. Geometry, pores and surface details are
reprojected from their world coordinates. Transport and callouts appear only
after the camera settles, with anchors from the same final projection. Reassembly
reverses the camera first, then closes the cell. Reduced motion jumps to the front
view. The 21 sampled camera poses are included in `npm run cell:build` depth checks.
Slate-blue ions and graphite electrons use symbols and line styles in addition
to colour; the palette adapts to both drawing themes.

## Interactive camera

Mouse drag changes yaw and elevation after the automatic reveal; native wheel
events zoom at the pointer without scrolling the modal. A 5-pixel threshold
separates picking from orbiting; capture begins only after that threshold.
Bounds: yaw ±55°, elevation −25° to 40°, zoom 0.65–2.2. Reset and keyboard
controls restore access to the front view. Touch page scrolling remains native.

Faces are culled by their world normals. Looking below the cell uses a separate
verified order for the tabs, collectors and electrodes. The orbit audit samples
72 views across the supported range. Routes and particles now have world
coordinates, project through the same camera as the parts, and retain their
phase while paused, zooming or rotating. Callout endpoints and terminal contacts
are reprojected on camera updates, including reduced-motion mode. Reassembly
blends the user camera back into the initial projection before closing the cell.
