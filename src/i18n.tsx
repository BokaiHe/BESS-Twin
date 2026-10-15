import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type {
  AlarmCode,
  Lang,
  Localized,
  NodeKind,
  ScenarioId,
  StrategyCode,
  TariffBand,
} from './domain/types'
import { cabinetChinese, renewableChinese } from './explorerCopyZh'

const renewableEnglish = {
  principle: {
    title: 'Generation principle',
    play: 'Play animation',
    pause: 'Pause animation',
    static: 'Reduced motion · static directions',
    running: 'Teaching animation · playing',
    paused: 'Teaching animation · paused',
    on: 'On',
    off: 'Off',
    controls: 'Illustration controls',
    note: 'Conceptual, slowed teaching animation. Particle sizes, layer thicknesses and motion are exaggerated. These controls affect this illustration only; plant simulation and live equipment are unchanged.',
    pv: {
      title: 'From sunlight to DC electricity',
      caption: 'CONNECTED CELL SECTION · ELECTRON FLOW',
      sourceLabel: 'Sunlight',
      inactive: 'Light off · no photocurrent shown',
      load: 'DC load',
      photons: 'Photons',
      electrons: 'Electrons',
      holes: 'Holes',
      nSide: 'n-side (−)',
      pSide: 'p-side (+)',
      circuit: 'External electron path',
      steps: [
        {
          title: '01 · Absorb light',
          body: 'Sunlight illuminates the cell. When a photon is absorbed, its energy can excite an electron and leave a hole. A brief glow marks absorption, followed by charge separation: the photon does not literally turn into an electron.',
        },
        {
          title: '02 · Collect charge',
          body: 'In this representative p-base / n-emitter cell, the junction helps collect electrons toward the n-side and holes toward the p-side. Holes represent missing electrons in the semiconductor; they are not particles flowing through the metal wire.',
        },
        {
          title: '03 · Power a load',
          body: 'Collected electrons travel from the front n-contact through the external load to the rear p-contact. This is electron flow; conventional current points in the opposite direction. The circuit and junction thickness are schematic.',
        },
      ],
      detail:
        'Exploded teaching view: the gaps separate layers for inspection. Charge routes show collection in an intact cell, not travel through air. Diffusion, recombination and microscopic carrier statistics are omitted.',
      source: 'https://www.energy.gov/cmei/systems/solar-photovoltaic-cell-basics',
    },
    wind: {
      title: 'From blade lift to electrical power',
      caption: 'CONNECTED DRIVETRAIN · GENERATOR SECTION',
      sourceLabel: 'Wind',
      airflow: 'Airflow toward blades',
      overviewLegend: 'Wind-driven rotor',
      overviewDetail:
        'Watch incoming wind turn the rotor. Pause or switch Wind off to inspect the complete turbine; click it to open the nacelle. Slowed teaching motion, not measured wind speed or RPM.',
      inactive: 'Wind off · motion stopped',
      rotor: 'Blades + main shaft · 1×',
      generator: 'Generator rotor · 4×',
      stator: 'Stator · stationary',
      output: 'AC before power electronics',
      steps: [
        {
          title: '01 · Capture wind',
          body: 'Incoming airflow is shown by moving streaks approaching the rotor. Aerodynamic lift turns the three blades and hub. The low-speed shaft turns at the same rate; its surface marks follow the blade phase.',
        },
        {
          title: '02 · Transmit rotation',
          body: 'The gearbox drives the high-speed shaft and generator rotor. This animation uses an illustrative 4:1 speed increase so both rotations remain visible; it is not the gearbox ratio of the simulated turbine.',
        },
        {
          title: '03 · Induce voltage',
          body: 'The rotating magnetic field changes the flux through stationary stator windings, inducing voltage. Only the magnetic rotor turns in this representative permanent-magnet section. The housing, stator, bearings and supports stay fixed.',
        },
      ],
      detail:
        'Exploded teaching view: the separated shafts and generator rotate in phase to explain the intact drivetrain. Gaps are for inspection, not real power-transmitting connections. Rotor blades are shortened. A single magnetic pole pair and a representative AC phase are shown; actual generator designs, pole counts and drivetrain ratios vary. Power electronics and a transformer prepare the output for the collection grid. Speed and electrical frequency are not to scale.',
      source: 'https://www.energy.gov/cmei/systems/explore-wind-turbine-text-version',
    },
  },

  context: 'HEALTHY SYSTEM · STRUCTURE EXPLORER',
  loading: 'Preparing the equipment…',
  levels: 'Viewing level',
  components: 'Select a component',
  role: 'WHAT IT DOES',
  connection: 'HOW IT CONNECTS',
  reset: 'Reassemble',
  back: 'Previous level',
  theme: 'Toggle explorer theme',
  moving: 'Moving components…',
  reference: 'Technical reference · U.S. Department of Energy',
  selectHint: 'Select a named component for its role.',
  cellHint: 'Click the silicon wafer to inspect its layers',
  pv: {
    title: 'Solar Module Explorer',
    subtitle: 'From a complete module to the junction inside one solar cell.',
    stages: ['Complete module', 'Laminate layers', 'Cell detail'],
    next: ['Separate laminate layers', 'Inspect one solar cell', 'Reassemble module'],
    hints: [
      'Click the module to separate its layers',
      'Click a cell to look inside',
      'Select a layer to learn its function',
    ],
    defaults: ['frame', 'glass', 'silicon'],
    note: 'Educational glass/backsheet crystalline-silicon module. Cell count, thickness and spacing are illustrative. Glass/glass modules and other cell architectures differ. The inverter is separate equipment.',
    source: 'https://www.energy.gov/cmei/systems/solar-photovoltaic-manufacturing-basics',
    parts: [
      {
        id: 'frame',
        name: 'Frame & mounting',
        level: 0,
        role: 'Aluminium rails protect the laminate edges and transfer wind and snow loads to the mounting structure.',
        connection:
          'Clamps attach the frame to the support rails. Frame bonding is part of the installation grounding design.',
      },
      {
        id: 'glass',
        name: 'Front glass',
        level: 1,
        role: 'The transparent front cover admits sunlight and protects the fragile cells against weather and impact.',
        connection:
          'It is bonded to the cells through an encapsulant. Transparency here is exaggerated so the cell layout stays visible.',
      },
      {
        id: 'encapsulant',
        name: 'Encapsulant',
        level: 1,
        role: 'Polymer layers hold the cells in place, provide electrical insulation and help protect the cell circuit from moisture.',
        connection:
          'Front and rear encapsulant bond the glass, cell circuit and rear protective layer during lamination.',
      },
      {
        id: 'cells',
        name: 'Silicon cells',
        level: 1,
        role: 'Semiconductor cells absorb light and produce direct-current electrical power. Click a cell to examine a representative junction.',
        connection:
          'Metal contacts and ribbons connect cells into the module circuit. The 24 cells drawn here are a simplified layout, not a product specification.',
      },
      {
        id: 'ribbons',
        name: 'Interconnect ribbons',
        level: 1,
        role: 'Conductive ribbons carry current between cell contacts.',
        connection:
          'Series connections add cell voltages; substring and module wiring determine the complete electrical layout.',
      },
      {
        id: 'backsheet',
        name: 'Protective backsheet',
        level: 1,
        role: 'An insulating rear laminate protects the cell circuit from the environment.',
        connection:
          'This example uses a polymer backsheet. Some modules use rear glass instead, including many bifacial designs.',
      },
      {
        id: 'junction',
        name: 'Junction box & connectors',
        level: 1,
        role: 'The rear junction box provides a protected termination for the module circuit and its output connections.',
        connection:
          'DC output leads connect modules into strings. A downstream inverter converts DC into grid-compatible AC.',
      },
      {
        id: 'contact',
        name: 'Rear contact',
        level: 2,
        role: 'The rear metal contact collects charge from the back of the cell and completes its electrical connection.',
        connection:
          'It connects to the adjacent cell through module interconnects. This is a simplified front/rear-contact architecture.',
      },
      {
        id: 'silicon',
        name: 'Silicon base',
        level: 2,
        role: 'Light absorbed in silicon can create mobile electrons and holes. Carrier collection allows the illuminated cell to supply an external circuit.',
        connection:
          'The base and emitter form a semiconductor junction. The drawing exaggerates their thicknesses for visibility.',
      },
      {
        id: 'junction',
        name: 'Emitter & junction',
        level: 2,
        role: 'A thin region with different doping forms a junction with the silicon base. The junction helps separate photogenerated charge carriers.',
        connection:
          'This is a conceptual p–n junction, not a drawing of every passivation or selective-contact layer in a modern commercial cell.',
      },
      {
        id: 'coating',
        name: 'Anti-reflection coating',
        level: 2,
        role: 'A thin optical coating reduces reflected light so more light enters the semiconductor.',
        connection:
          'It lies at the illuminated surface. Its thickness is greatly exaggerated; real cells also use surface texturing and passivation.',
      },
      {
        id: 'contacts',
        name: 'Front contact grid',
        level: 2,
        role: 'Fine metal fingers collect current and deliver it to larger busbars while shading only part of the illuminated area.',
        connection:
          'Busbars connect to the module ribbons. The external circuit connects the front and rear contacts.',
      },
    ],
  },
  wind: {
    title: 'Wind Turbine Explorer',
    subtitle: 'Follow the mechanical path from wind-driven blades to the generator.',
    stages: ['Complete turbine', 'Nacelle interior', 'Drivetrain'],
    next: ['Open the nacelle', 'Separate the drivetrain', 'Reassemble turbine'],
    hints: [
      'Click the turbine to open its nacelle',
      'Click the shaft or gearbox to separate the drivetrain',
      'Select a component to follow the power path',
    ],
    defaults: ['rotor', 'gearbox', 'generator'],
    note: 'Educational three-bladed, upwind turbine with a gearbox. Direct-drive turbines omit the gearbox. Shape, spacing and proportions are illustrative and do not specify the simulated farm’s 4 MW turbine model. Expanded joints show assembly relationships, not an operating state.',
    source: 'https://www.energy.gov/cmei/systems/explore-wind-turbine-text-version',
    parts: [
      {
        id: 'rotor',
        name: 'Blades, hub & pitch',
        level: 0,
        role: 'Aerodynamic lift turns the blades and hub. Pitch mechanisms adjust blade angle to regulate aerodynamic loading and power.',
        connection:
          'The hub transfers rotor torque to the main shaft. The three blade shapes here are simplified, not aerodynamic design profiles.',
      },
      {
        id: 'tower',
        name: 'Tower & foundation',
        level: 0,
        role: 'The tower raises the rotor into the wind and carries the nacelle and rotor loads to the foundation.',
        connection:
          'The yaw bearing connects the tower top to the nacelle. Electrical cables run down the tower to power-conversion and collection equipment.',
      },
      {
        id: 'housing',
        name: 'Nacelle enclosure',
        level: 1,
        role: 'The protective housing shelters drivetrain and auxiliary equipment from the weather.',
        connection:
          'Panels are lifted away in this teaching view. They are not doors that open during normal generation.',
      },
      {
        id: 'shaft',
        name: 'Low-speed main shaft',
        level: 1,
        role: 'The main shaft carries high torque from the slowly rotating rotor toward the gearbox.',
        connection:
          'Main bearings support the shaft. Internal shaft sections are concealed inside the illustrated bearing housings.',
      },
      {
        id: 'bearing',
        name: 'Main bearings',
        level: 1,
        role: 'Bearing assemblies support the rotating shaft and transfer mechanical loads into the bedplate.',
        connection:
          'Their housings sit on pedestals. Bearings allow shaft rotation while the surrounding structure remains stationary.',
      },
      {
        id: 'gearbox',
        name: 'Gearbox',
        level: 1,
        role: 'The gearbox increases rotational speed and reduces torque for the generator-side shaft, with mechanical losses.',
        connection:
          'This figure shows its outer housing, not individual gear teeth. Direct-drive turbines connect their rotor to a generator without this stage.',
      },
      {
        id: 'coupling',
        name: 'High-speed shaft',
        level: 1,
        role: 'The generator-side shaft transmits torque from the gearbox output.',
        connection:
          'Couplings accommodate the mechanical connection to the generator. Expanded gaps reveal this connection path.',
      },
      {
        id: 'brake',
        name: 'Mechanical brake',
        level: 1,
        role: 'A disc and caliper provide mechanical braking or holding as part of the turbine’s control and safety design.',
        connection:
          'This example places the brake on the high-speed side. Blade pitch also plays a major role in controlling and stopping the rotor.',
      },
      {
        id: 'generator',
        name: 'Generator',
        level: 1,
        role: 'Electromagnetic interaction converts mechanical rotation into electrical power.',
        connection:
          'Power electronics and a transformer condition the output for the collection network; these downstream systems are outside this nacelle detail.',
      },
      {
        id: 'yaw',
        name: 'Yaw bearing & bedplate',
        level: 1,
        role: 'The bedplate supports the drivetrain. The yaw system changes the nacelle heading to face the wind.',
        connection:
          'The yaw bearing sits at the tower top. Yaw motors and gearing are omitted from this simplified cutaway.',
      },
      {
        id: 'cooling',
        name: 'Cooling equipment',
        level: 1,
        role: 'Thermal-management equipment removes heat produced by mechanical and electrical losses.',
        connection:
          'Actual turbines may combine liquid loops, oil cooling and air heat exchangers. The housing shown is a representative cooling unit.',
      },
      {
        id: 'sensors',
        name: 'Wind sensing',
        level: 1,
        role: 'Wind-direction and wind-speed measurements support turbine control.',
        connection:
          'The roof-mounted vane represents wind sensing here. The controller uses wind and equipment measurements to coordinate yaw, pitch and generation.',
      },
    ],
  },
}

const cabinetEnglish = {
  title: 'BESS Container Explorer',
  subtitle: 'A closer look at a utility-scale AC block.',
  loading: 'Preparing the container…',
  context: 'HEALTHY SYSTEM · STRUCTURE EXPLORER',
  reference: 'PowerTitan 2.0 architecture reference',
  note: 'Educational cutaway inspired by PowerTitan 2.0. Layout, rack and cell counts are illustrative; this is not manufacturer CAD. Ratings describe the whole BESS unit.',
  enclosure: 'Enclosure',
  systems: 'Internal systems',
  module: 'Battery module',
  cells: 'Cell layers',
  reveal: 'Reveal cell layers',
  reassemble: 'Reassemble module',
  rack: 'Rack',
  rackSelection: 'Choose a rack to extract its top module',
  moving: 'Moving layers…',
  stageStatus: ['Modules seated', 'Module extracted', 'Cell layers expanded'],
  extractHint: 'Click the extracted module to reveal cells',
  extractedBattery: {
    name: 'An extracted battery module',
    short: 'Battery module',
    kicker: '02 / RACK-TO-MODULE',
    body: 'The top example module slides forward from the selected rack. It remains assembled: a protective cover encloses the cells, with a cold plate and support tray underneath.',
    items: ['Protective module cover', 'Cell array inside', 'Cold plate & support tray'],
    connection:
      'Reveal the cell layers to lift the cover, separate the representative cells and monitoring board, and expose the cold plate. This motion explains the hierarchy; it is not a servicing procedure.',
  },
  labelsHeading: 'Module components',
  cellLabel: 'Cell',
  cellHint: 'Click a cell in the drawing to open its cutaway.',
  cellContext: 'Representative cell · top example module',
  cell: {
    name: 'Battery cell',
    short: 'Prismatic cell',
    kicker: 'CELL / ENERGY STORAGE',
    body: 'A cell is the basic electrochemical energy-storage unit. During charging it stores energy chemically; during discharging it supplies DC electrical energy to the connected circuit.',
    items: [
      'Electrodes and electrolyte store and release energy',
      'Positive and negative terminals carry current',
      'A prismatic housing contains the cell assembly',
    ],
    connection:
      'Cells are interconnected to form a module. Monitoring electronics measure cell voltage and temperature for the BMS, while heat passes toward the cold plate. The visible terminals are schematic; this view does not specify wiring, capacity or live measurements.',
  },
  moduleDetails: {
    cover: {
      name: 'Protective module cover',
      short: 'Module cover',
      kicker: 'MODULE / ENCLOSURE',
      body: 'The cover encloses the cell assembly and helps protect internal components from accidental contact. It lifts away in this educational view to reveal the module layers.',
      items: ['Top cover and side panels', 'Module front face', 'Handling feature'],
      connection:
        'The cover belongs to the module housing. It does not store energy or convert electrical power.',
    },
    cells: {
      name: 'Battery cell array',
      short: 'Battery cells',
      kicker: 'MODULE / CELL ARRAY',
      body: 'These representative prismatic cells form the energy-storage core of the module. Click a cell in the drawing to open its cutaway.',
      items: ['Twelve representative cells', 'Top terminal surfaces', 'Individual cell selection'],
      connection:
        'Electrical interconnects combine cells into a module. Cell count and placement are illustrative and do not define a manufacturer-specific series or parallel arrangement.',
    },
    board: {
      name: 'Module monitoring board',
      short: 'Monitoring board',
      kicker: 'MODULE / BMS SENSING',
      body: 'The monitoring board acquires cell measurements and passes information to the battery management system. It represents the module-level sensing electronics.',
      items: [
        'Cell-voltage acquisition',
        'Temperature sensor inputs',
        'Communication with the BMS',
      ],
      connection:
        'Sensing leads connect cells and sensors to this board; those leads are omitted here. The board monitors the battery and does not perform AC/DC conversion.',
    },
    terminal: {
      name: 'DC terminal interface',
      short: 'DC terminals',
      kicker: 'MODULE / ELECTRICAL INTERFACE',
      body: 'This covered interface represents the module connection to the battery rack DC circuit. Conductors carry charging and discharging current through the connection.',
      items: [
        'Module connection point',
        'Insulating terminal cover',
        'Bidirectional DC current path',
      ],
      connection:
        'The module DC path continues through rack connections and protection toward the PCS. Internal busbars and wiring are omitted from this illustration.',
    },
    coldplate: {
      name: 'Liquid-cooling cold plate',
      short: 'Cold plate',
      kicker: 'MODULE / HEAT REMOVAL',
      body: 'The cold plate provides a thermal path beneath the cells. Coolant circulating through internal channels carries heat toward the liquid-cooling unit.',
      items: [
        'Heat-transfer surface',
        'Internal coolant channels',
        'Connection to the cooling circuit',
      ],
      connection:
        'Heat travels from the cells through their thermal interface to the plate. Coolant ports, channels and pipework are not drawn in this simplified view.',
    },
    tray: {
      name: 'Module support tray',
      short: 'Support tray',
      kicker: 'MODULE / MECHANICAL SUPPORT',
      body: 'The tray provides a mechanical base for the module assembly and supports the layers above it inside the rack.',
      items: ['Structural base', 'Support for the module layers', 'Rack mounting interface'],
      connection:
        'The tray holds the module assembly in position. It is shown separately from the cold plate to distinguish mechanical support from heat removal.',
    },
  },
  cellView: 'Single-cell cutaway',
  openCell: 'Open cell cutaway',
  backToModule: 'Back to module',
  expandCell: 'Expand cell',
  assembleCell: 'Reassemble cell',
  cellMaterials: 'Cell materials',
  cellDiagram:
    'Exploded prismatic lithium-ion cell with electrodes, separator and electrolyte. Use the material buttons for keyboard navigation.',
  cellCutawayHint: 'Drag to rotate · scroll to zoom · click to inspect',
  camera: {
    title: 'Cell camera',
    hint: 'Drag to rotate · scroll to zoom',
    out: 'Zoom out',
    in: 'Zoom in',
    reset: 'Reset view',
    help: 'Drag with the mouse to rotate; scroll to zoom at the pointer. Arrow keys rotate, plus and minus zoom, Home resets the front view.',
  },
  cellStructureNote:
    'One representative electrode pair. Thicknesses and pores are enlarged. Electrolyte wets the porous electrodes and separator; it is not a separate solid layer.',
  cellReference: 'Battery science reference',
  internalParts: {
    positive: {
      name: 'Cathode · Positive electrode',
      short: 'Cathode (+)',
      kicker: 'CELL / POSITIVE ELECTRODE',
      body: 'The positive electrode accepts lithium ions during discharge and releases them during charging.',
      items: ['Lithium-containing active material', 'Metal current collector'],
      connection:
        'Ions arrive through the electrolyte; electrons arrive through the external circuit. Cathode and anode names here follow the discharge convention.',
    },
    negative: {
      name: 'Anode · Negative electrode',
      short: 'Anode (−)',
      kicker: 'CELL / NEGATIVE ELECTRODE',
      body: 'The negative electrode stores lithium during charging and releases it during discharge. Graphite is a common active material.',
      items: ['Lithium-storage active material', 'Metal current collector'],
      connection:
        'During discharge, lithium ions enter the electrolyte while electrons travel through the external circuit.',
    },
    separator: {
      name: 'Porous separator',
      short: 'Separator',
      kicker: 'CELL / ELECTRICAL SEPARATION',
      body: 'The separator keeps the electrodes from touching while allowing lithium ions to pass through electrolyte-filled pores.',
      items: ['Electrically insulating membrane', 'Microscopic pores'],
      connection:
        'It blocks direct electronic contact between electrodes. The enlarged dots represent pores, not their real size or arrangement.',
    },
    electrolyte: {
      name: 'Electrolyte',
      short: 'Electrolyte',
      kicker: 'CELL / ION TRANSPORT',
      body: 'The electrolyte carries lithium ions between the electrodes. It wets the porous electrodes and separator.',
      items: ['Ion-conducting medium', 'Liquid within the porous structure'],
      connection:
        'The muted blue-grey tint marks wetted surfaces. It does not represent a separate sheet; electrons travel through the external circuit.',
    },
  },
  flow: {
    title: 'Charge transport',
    mode: 'Charge or discharge',
    pause: 'Pause flow',
    play: 'Play flow',
    ions: 'Li⁺ · Lithium ions',
    electrons: 'e⁻ · Electrons',
    ionSymbol: 'Li⁺',
    electronSymbol: 'e⁻',
    external: 'External circuit · electron flow',
    note: 'Illustrative loop; no live SOC or particle-speed scale. Arrows show electron flow, opposite to conventional current.',
    reduced:
      'Reduced motion: static particles and direction arrows. Electron flow is opposite to conventional current.',
    expand:
      'Expand the cell to see the transport paths. Electron flow is opposite to conventional current.',
    discharge: {
      label: 'Discharge',
      device: 'Load',
      ions: 'Negative → positive, through the electrolyte and separator pores.',
      electrons:
        'Negative → external load → positive, delivering electrical energy. Electrons do not cross the separator.',
    },
    charge: {
      label: 'Charge',
      device: 'DC source',
      ions: 'Positive → negative, through the electrolyte and separator pores; lithium is stored in the negative electrode.',
      electrons:
        'The source draws electrons from the positive electrode and supplies them to the negative electrode, storing energy.',
    },
  },
  views: 'Viewing level',
  components: 'Explore components',
  dark: 'Dark drawing',
  light: 'Light drawing',
  tour: 'Component tour',
  stopTour: 'Pause tour',
  hint: 'Click a battery rack to extract its top module',
  moduleHint: 'Click a cell to look inside',
  assembledHint: 'Click the enclosure to look inside',
  open: 'Remove enclosure',
  inspect: 'Inspect a battery module',
  back: 'Back to systems',
  contains: 'WHAT YOU ARE LOOKING AT',
  role: 'HOW IT CONNECTS',
  design: 'Design context',
  rating: 'Unit rating',
  duration: 'Nominal duration',
  hours: '2 hours',
  format: 'Container format',
  feet: '20 ft class',
  figure: 'FIG. 01',
  moduleFigure: 'FIG. 02',
  diagram: 'Isometric storage container. Use the component buttons for keyboard navigation.',
  moduleDiagram:
    'Battery module cutaway with representative cells, a cold plate and monitoring electronics.',
  moduleBattery: {
    name: 'Inside a battery module',
    short: 'Battery cells',
    kicker: '02 / CELL-TO-MODULE',
    body: 'This lid-off detail reveals representative prismatic cells. Their terminals sit on top, with a monitoring board alongside and a cold plate underneath. Cell count and arrangement are illustrative.',
    items: ['Cells & terminal surfaces', 'Module monitoring board', 'Cold plate & support tray'],
    connection:
      'In a real module, electrical interconnects join the cells and sensing leads feed the monitoring board. Those internal connections are omitted here; no series or parallel configuration is implied.',
  },
  parts: {
    enclosure: {
      name: 'Container enclosure',
      short: 'Enclosure',
      kicker: '01 / STRUCTURE',
      body: 'The weather-protective enclosure brings batteries, power conversion and service equipment into one AC storage block. The long service face provides access to the rack bays.',
      items: ['Structural frame', 'Service doors', 'Separated compartments'],
      connection:
        'The AC output connects to external collection and transformer equipment. The station transformer is outside this illustration.',
    },
    battery: {
      name: 'Battery racks & modules',
      short: 'Battery racks',
      kicker: '02 / ENERGY STORAGE',
      body: 'Cells store energy electrochemically. Cells are assembled into modules, and modules form battery racks. Repeated drawers here show that hierarchy, not the exact product configuration.',
      items: ['Prismatic cells', 'Battery modules', 'Rack supports'],
      connection:
        'Each rack connects through DC protection to its associated string PCS. Cold plates remove heat from the battery modules.',
    },
    bms: {
      name: 'Battery Management System',
      short: 'BMS',
      kicker: '03 / MONITORING',
      body: 'Distributed monitoring electronics collect cell voltage and temperature information. Rack and system controllers use these measurements for battery supervision, balancing and operating limits.',
      items: ['Module acquisition board', 'Rack controller', 'Communication links'],
      connection:
        'The BMS shares battery state and permissible charging or discharging limits with the PCS and supervisory controller. It does not perform AC/DC conversion.',
    },
    protection: {
      name: 'DC connection & protection',
      short: 'DC protection',
      kicker: '04 / ELECTRICAL CONNECTION',
      body: 'The DC interface connects a battery rack to power conversion equipment. Switching, isolation and protective devices are grouped around this connection.',
      items: ['DC terminals & busbars', 'Fuses & switching devices', 'Electrical monitoring'],
      connection:
        'Power passes through the DC connection on its way between batteries and PCS. Small terminal covers represent the connection points in the module view.',
    },
    pcs: {
      name: 'Power Conversion System',
      short: 'String PCS',
      kicker: '05 / BIDIRECTIONAL CONVERSION',
      body: 'The PCS converts AC to DC while charging, and DC to AC while discharging. The reference architecture associates a string PCS with each battery rack, rather than relying on one central converter.',
      items: ['Power electronics', 'Converter controller', 'Thermal & electrical interfaces'],
      connection:
        'Rack-side DC becomes AC for the collection circuit. The illustrated lower converter blocks identify the function; their positions are schematic.',
    },
    cooling: {
      name: 'Liquid cooling system',
      short: 'Liquid cooling',
      kicker: '06 / THERMAL MANAGEMENT',
      body: 'A liquid cooling unit conditions coolant and circulates it through distribution lines and module cold plates. Heat leaves the battery through the cold plate rather than through the electrical terminals.',
      items: ['Liquid cooling unit', 'Pump & distribution circuit', 'Module cold plates'],
      connection:
        'The service-bay unit and the thin plates beneath the drawers belong to the same thermal system. Internal plumbing is omitted in this simplified cutaway.',
    },
    safety: {
      name: 'Fire detection & safety',
      short: 'Fire & safety',
      kicker: '07 / SYSTEM SAFETY',
      body: 'Detection, fire-control equipment and compartment separation form part of the system safety design. Small sensor heads and a control panel identify these functions in a healthy system.',
      items: ['Detection sensors', 'Fire-control panel', 'Compartment separation'],
      connection:
        'Detection and safety controls coordinate with the storage equipment. Suppression and venting arrangements depend on the selected product and project configuration.',
    },
    auxiliary: {
      name: 'Auxiliary power & communication',
      short: 'Auxiliary systems',
      kicker: '08 / SUPPORT SERVICES',
      body: 'Auxiliary distribution powers control and service equipment. Local controllers and network devices exchange operating information with the station-level energy management system.',
      items: ['Control power supply', 'Backup control power', 'Communication gateway'],
      connection:
        'The station EMS schedules charging and discharging; the BMS supervises the batteries and the PCS converts power. The station EMS is outside this container view.',
    },
  },
}

export type RenewableCopy = typeof renewableEnglish
export type CabinetCopy = typeof cabinetEnglish

const zh = {
  cabinet: cabinetChinese,
  renewables: renewableChinese,
  hub: {
    title: '设备内部探索',
    count: '3 个探索器',
    sub: '拆开储能集装箱、光伏组件和风机，看电是怎么发出来、存起来的。',
    show: '展开设备探索',
    hide: '收起',
    enter: '进入探索',
    items: {
      container: {
        name: '储能集装箱',
        desc: '外壳 → 电池簇 → 模组 → 电芯，含充放电离子流动画',
      },
      pv: { name: '光伏组件', desc: '层压结构 → 电芯 PN 结，含光生发电动画' },
      wind: { name: '风力发电机', desc: '机舱 → 齿轮箱 → 发电机，含传动与发电动画' },
    },
  },
  exploreInside: '查看集装箱内部',
  exploreEquipment: '探索设备内部',
  brandSub: '源网荷储数字孪生',
  site: '风光储综合园区',
  simBadge: '仿真演示',
  langSwitch: 'EN',
  langSwitchLabel: 'Switch to English',
  scenarios: {
    sunny: { name: '晴天典型日', hint: '光伏消纳 · 晚峰放电' },
    cloudy: { name: '阴天风弱日', hint: '谷时充电 · 保障供电' },
    fault: { name: '储能故障日', hint: '17:30 BESS-04 离线' },
  } satisfies Record<ScenarioId, { name: string; hint: string }>,
  kpi: {
    renewable: '清洁能源出力',
    load: '用户负荷',
    storage: '储能 SOC',
    grid: '电网交换',
    pv: '光伏',
    wind: '风电',
    factory: '工业',
    homes: '居民',
    balanced: '供需平衡',
    shortfall: '供电缺口',
  },
  flow: {
    charging: '充电',
    discharging: '放电',
    idle: '待机',
    offline: '离线',
    import: '购电',
    export: '上网',
    none: '无交换',
    running: '运行中',
    stopped: '停发',
    supplied: '供电中',
  },
  tariff: { valley: '谷', flat: '平', peak: '峰' } satisfies Record<TariffBand, string>,
  tariffLong: { valley: '谷时电价', flat: '平时电价', peak: '峰时电价' } satisfies Record<
    TariffBand,
    string
  >,
  strategy: {
    'hard-shave': '并网削峰',
    absorb: '光伏消纳',
    'export-surplus': '余电上网',
    'valley-charge': '谷时充电',
    'flat-charge': '平段补电',
    'peak-discharge': '峰时放电',
    'hold-reserve': '保留削峰电量',
    standby: '待机',
  } satisfies Record<StrategyCode, string>,
  strategyReason: {
    'hard-shave': (l: string) => `负荷超过 15 MW 并网上限，储能放电把购电压到 ${l} MW 以内`,
    absorb: () => '风光出力大于负荷，多余的电存进储能',
    'export-surplus': () => '储能已满，多余风光电在限额内上网',
    'valley-charge': () => '谷价最便宜，提前从电网充电备战用电高峰',
    'flat-charge': () => '高峰前补足电量，保证晚峰能持续放电',
    'peak-discharge': (l: string) => `峰价时段，储能放电把购电稳定在 ${l} MW`,
    'hold-reserve': () => '可调电量已到预留线，暂停放电以备削峰',
    standby: () => '风光与电网已能满足负荷，储能待命',
  } as Record<StrategyCode, (level: string) => string>,
  replanned: '故障后已重新规划',
  kinds: {
    grid: '外部电网',
    transformer: '变电设备',
    bus: '汇集站',
    pv: '光伏',
    wind: '风电',
    bess: '储能',
    factory: '工业用户',
    residential: '居民用户',
  } satisfies Record<NodeKind, string>,
  groups: { gen: '发电', grid: '电网', storage: '储能', load: '用户' },
  detail: {
    overview: '储能电站总览',
    clusterName: '储能电站 · 4 × 2.5 MW / 5 MWh',
    soc: '荷电状态',
    power: '当前功率',
    online: '在线能力',
    installed: '安装容量',
    temp: '电池温度',
    soh: '健康度 SOH',
    available: '可用放电能力',
    voltage: '额定电压',
    connectionVoltage: '并网侧额定电压',
    voltageNote: '交流额定电压等级；当前仿真不计算运行电压。',
    storageVoltageNote: '35 kV 为升压后的接入母线等级，并非电池直流或 PCS 端电压。',
    voltageSidesNote: '斜线分隔设备两侧的额定电压，不表示实时电压变化。',
    rating: '额定配置',
    output: '实际出力',
    dcPotential: '直流可用功率',
    clipping: '逆变器限发',
    loadNow: '当前用电',
    share: '占园区负荷',
    importP: '购电功率',
    exportP: '上网功率',
    limit: '双向限额',
    lines: '关联线路',
    strategy: '当前策略',
    level: '峰段购电目标',
    target: '充电目标电量',
    units: '储能单元',
    capacityFactor: '出力率',
    backToCluster: '返回储能总览',
    reserve: '削峰预留',
    throughput: '通过功率',
    stored: '储存电量',
    lineFrom: '→',
  },
  timeline: {
    title: '全天回放',
    play: '播放',
    pause: '暂停',
    restart: '回到 00:00',
    speed: '倍速',
    chart: '运行曲线',
    renewable: '风光',
    load: '负荷',
    grid: '购电',
    battery: '储能',
    soc: 'SOC',
    baseline: '晴天基准',
    importCap: '购电上限',
    bookmarks: { night: '00:30 夜间', noon: '12:00 午间', fault: '17:30 故障', peak: '19:00 晚峰' },
    tariffNote: '示例分时电价',
  },
  tour: {
    start: '功能导览',
    stop: '结束导览',
    next: '下一步',
    back: '上一步',
    finish: '开始探索',
    skip: '退出导览',
    hint: '导览期间回放暂停，可随时退出。',
    steps: {
      overview: {
        title: '认识能源园区',
        body: '光伏、风电、储能和用户端通过同一条汇集母线连接。线路上的粒子表示电能方向；这是仿真演示，没有远程控制功能。',
      },
      generation: {
        title: '清洁能源发电',
        body: '光伏装机为 20 MWp / 16 MWac，风机为 3 × 4 MW。天气和时刻决定出力；选择场景中的设备，可查看实时功率、容量及相关线路。',
      },
      storage: {
        title: '储能电站 BESS',
        body: '四个储能单元合计 10 MW / 20 MWh，可双向充放电。SOC 表示剩余电量；系统优先削峰，再消纳多余风光和按电价调度。',
      },
      grid: {
        title: '电网与变电站',
        body: '外部电网经 110/35 kV 主变接入园区。购电和上网各限 15 MW；园区内部采用配电连接，箭头和文字区分购电与上网。',
      },
      loads: {
        title: '工业、居民与充电负荷',
        body: '工厂主要在白天用电，居民与充电负荷在晚间增加。错峰曲线让你看到储能如何平衡发电和需求。',
      },
      scenarios: {
        title: '切换全天剧本',
        body: '晴天、阴天风弱和储能故障是三种全天剧本。故障日 BESS-04 于 17:30 离线，剩余额定功率降至 7.5 MW；切换后查看曲线和告警。',
      },
      metrics: {
        title: '读取关键指标',
        body: '这里汇总风光出力、总负荷、储能 SOC、电网交换和累计电费节省。所有指标都对应时间轴当前选择的同一分钟。',
      },
      timeline: {
        title: '回放与功率曲线',
        body: '拖动滑块或点击曲线选择时刻；书签直达午间或晚高峰。播放按钮演示全天变化，色带标出谷、平、峰电价。点击图例可隐藏曲线；故障日虚线是晴天基准。',
      },
      details: {
        title: '查看设备详情',
        body: '选择模型、标签或设备列表后，这里显示该设备专属指标。储能显示 SOC、温度和可用放电功率；光伏显示直流容量、交流容量及出力。',
      },
      devices: {
        title: '按类别查找设备',
        body: '发电、电网、储能和用户四个分类列出设备状态。点击一行即可定位三维模型、展开详情并高亮关联线路。',
      },
      savings: {
        title: '理解电费差额',
        body: '点击电费卡片可查看全天或截至当前的账单拆解。基准缺电时只显示账单差额；故障日另外说明电量变化与离线冻结电量。',
      },
      alarms: {
        title: '查看并定位告警',
        body: '铃铛显示当前分钟的告警。打开后点击告警可定位设备；故障日会先出现温升预警，再在 17:30 触发离线告警。',
      },
      camera: {
        title: '调整视角，开始探索',
        body: '使用加减号缩放、旋转按钮环视，主页按钮回到园区全景。完成导览后，先选一个全天剧本，再用时间轴比较午间和晚高峰。',
      },
    },
  },
  camera: { zoomIn: '放大', zoomOut: '缩小', reset: '复位视角', rotate: '自动旋转' },
  savings: {
    title: '电费节省',
    sub: '对比无储能方案',
    stored: (v: string): string => `另有 ${v} MWh 已储存待用`,
    infeasible: '基准方案缺电，不可比',
    explainTitle: '电费节省怎么算',
    scopeNow: '截至当前',
    scopeDay: '全天',
    whereFrom: '省下的钱从哪来',
    lessBuy: (b: string): string => `${b}时少买电`,
    moreBuy: (b: string): string => `${b}时多买电（给储能充电）`,
    lessSell: '少卖余电（存起来晚上自用）',
    moreSell: '多卖余电',
    net: '净节省',
    billDifference: '账单差额（不可比）',
    differenceFrom: '账单差额构成',
    faultEnergy: (delta: string, offline: string): string =>
      `本统计期储存电量变化 ${delta} MWh；期末离线冻结电量 ${offline} MWh。故障日不满足首尾电量相同；账单未对电池存量变化估值，冻结电量当前不可用。`,
    gapNote: (v: string): string =>
      `无储能方案少供 ${v} MWh，两方案供电量不同；此处仅展示账单差额，不代表同等供电条件下的节省`,
    howTo: '计算口径',
    notes: [
      '两种方案的天气、负荷、电价完全相同，唯一区别是有没有储能。',
      '储能把便宜时段（或光伏多余）的电存起来，到峰价时段放出来，少买贵电。',
      '晴天与阴天按周期稳态运行，24:00 电量与 00:00 相同；故障日沿用晴天初始状态，期末电量可能不同。',
      '电价为示例值，未计需量电费、折旧与运维。',
    ],
    explain: [
      '节省 = 同气象、同负荷、同电价的「无储能方案」净电费 − 当前方案净电费，累计到当前时刻。',
      '充电时先花钱、放电时才省钱，所以中午可能暂时为负；卡片同时显示已储存待用的电量。',
      '仅晴天与阴天满足首尾电量相同；故障日需结合期末电量变化及离线冻结电量解读账单。',
      '电价为示例：谷 ¥0.35、平 ¥0.68、峰 ¥1.08 / kWh；上网 ¥0.28 / kWh。未计需量电费、折旧与运维。',
    ],
    baseline: '无储能方案',
    current: '当前方案',
  },
  alarms: {
    title: '告警',
    none: '当前时刻无告警',
    locate: '定位',
    'bess-temp-high': { title: 'BESS-04 温度偏高', impact: '电池温度持续上升，可能触发过温保护' },
    'bess-overheat-trip': {
      title: 'BESS-04 过温保护离线',
      impact: '在线功率上限降至 7.5 MW；该单元剩余电量暂不可调度，剩余三台重新分配',
    },
  } as { title: string; none: string; locate: string } & Record<
    AlarmCode,
    { title: string; impact: string }
  >,
  labels: { windFarm: '风电场', bessPlant: '储能电站' },
  legend: { renewable: '风光发电', grid: '电网 / 配电', charge: '储能充电', discharge: '储能放电' },
  close: '关闭',
  loading: '正在预计算全天 1,440 个时刻…',
  loadFailed: '仿真数据加载失败',
  reload: '重新加载',
  noWebgl: '当前环境无法显示三维场景，指标与曲线仍可使用。',
  sceneLoading: '正在载入三维场景…',
  modelNote: '仿真演示 · 有功功率平衡 · 示例参数',
  about: '关于模型',
  aboutBody: [
    '园区级有功功率仿真：每个剧本一次计算 1,440 分钟，拖动时间轴只读取缓存结果，不会重复累计电量或费用。',
    '容量：光伏 20 MWp / 16 MWac；风电 3 × 4 MW；储能 4 × 2.5 MW / 5 MWh（SOC 10%–90%，充放电效率各 95%）；并网购电与上网各限 15 MW。',
    '策略：①负荷超过并网上限时储能优先削峰 ②风光富余先充储能 ③谷时（及平段补电）只充到恰好够用，先算上预计的风光富余 ④峰时把购电压平到一个规划水位，只动用削峰预留以上的电量。',
    '假设已知全天天气和负荷（完美预测）；设备故障不可预知，发生后重新规划。未模拟潮流、无功、电池老化；温度、SOH 为演示值。',
  ],
}
export type Dict = typeof zh

const en: Dict = {
  cabinet: cabinetEnglish,
  renewables: renewableEnglish,
  hub: {
    title: 'Inside the equipment',
    count: '3 explorers',
    sub: 'Open up the storage container, a solar module and a wind turbine to see how energy is made and stored.',
    show: 'Show equipment explorers',
    hide: 'Hide',
    enter: 'Explore',
    items: {
      container: {
        name: 'BESS container',
        desc: 'Enclosure → racks → module → cell, with charge/discharge ion flow',
      },
      pv: {
        name: 'Solar module',
        desc: 'Laminate layers → cell junction, with photovoltaic generation',
      },
      wind: {
        name: 'Wind turbine',
        desc: 'Nacelle → gearbox → generator, with drivetrain animation',
      },
    },
  },
  exploreInside: 'Explore inside',
  exploreEquipment: 'Explore inside',
  brandSub: 'Source · Grid · Load · Storage',
  site: 'Hybrid Energy Park',
  simBadge: 'Simulation',
  langSwitch: '中',
  langSwitchLabel: '切换到中文',
  scenarios: {
    sunny: { name: 'Sunny day', hint: 'Solar soak · evening discharge' },
    cloudy: { name: 'Cloudy, low wind', hint: 'Valley charging · secure supply' },
    fault: { name: 'Storage fault', hint: 'BESS-04 trips at 17:30' },
  },
  kpi: {
    renewable: 'Renewables',
    load: 'Site load',
    storage: 'Storage SOC',
    grid: 'Grid exchange',
    pv: 'Solar',
    wind: 'Wind',
    factory: 'Industry',
    homes: 'Homes',
    balanced: 'Balanced',
    shortfall: 'Shortfall',
  },
  flow: {
    charging: 'Charging',
    discharging: 'Discharging',
    idle: 'Idle',
    offline: 'Offline',
    import: 'Import',
    export: 'Export',
    none: 'No exchange',
    running: 'Running',
    stopped: 'Idle',
    supplied: 'Supplied',
  },
  tariff: { valley: 'Off-peak', flat: 'Mid', peak: 'Peak' },
  tariffLong: { valley: 'Off-peak tariff', flat: 'Mid-peak tariff', peak: 'Peak tariff' },
  strategy: {
    'hard-shave': 'Peak shaving',
    absorb: 'Soaking up solar',
    'export-surplus': 'Exporting surplus',
    'valley-charge': 'Off-peak charging',
    'flat-charge': 'Top-up charging',
    'peak-discharge': 'Peak discharge',
    'hold-reserve': 'Holding reserve',
    standby: 'Standby',
  },
  strategyReason: {
    'hard-shave': (l) => `Load exceeds the 15 MW grid limit; storage holds import at ${l} MW`,
    absorb: () => 'Wind and solar exceed demand; the surplus is stored',
    'export-surplus': () => 'Storage is full; surplus is exported within the limit',
    'valley-charge': () => 'Cheapest tariff: charging from the grid ahead of the peak',
    'flat-charge': () => 'Topping up before the peak so discharge can last all evening',
    'peak-discharge': (l) => `Peak tariff: storage discharges to hold grid import at ${l} MW`,
    'hold-reserve': () => 'Flexible energy used up; holding the rest for peak shaving',
    standby: () => 'Renewables and grid cover the load; storage on standby',
  },
  replanned: 'Re-planned after fault',
  kinds: {
    grid: 'Utility grid',
    transformer: 'Substation',
    bus: 'Collector',
    pv: 'Solar',
    wind: 'Wind',
    bess: 'Storage',
    factory: 'Industry',
    residential: 'Residential',
  },
  groups: { gen: 'Generation', grid: 'Grid', storage: 'Storage', load: 'Loads' },
  detail: {
    overview: 'Storage plant overview',
    clusterName: 'BESS plant · 4 × 2.5 MW / 5 MWh',
    soc: 'State of charge',
    power: 'Power now',
    online: 'Online capability',
    installed: 'Installed',
    temp: 'Cell temperature',
    soh: 'State of health',
    available: 'Available discharge',
    voltage: 'Nominal voltage',
    connectionVoltage: 'Nominal grid connection',
    voltageNote: 'Nominal AC levels; operating voltage is not simulated.',
    storageVoltageNote:
      '35 kV is the bus connection after step-up, not the battery DC or PCS terminal voltage.',
    voltageSidesNote:
      'The slash separates the two sides of the equipment, not changes in operating voltage.',
    rating: 'Rating',
    output: 'Output',
    dcPotential: 'DC potential',
    clipping: 'Inverter clipping',
    loadNow: 'Demand now',
    share: 'Share of site load',
    importP: 'Import',
    exportP: 'Export',
    limit: 'Two-way limit',
    lines: 'Connected lines',
    strategy: 'Strategy',
    level: 'Peak import target',
    target: 'Charge target',
    units: 'Storage units',
    capacityFactor: 'Output ratio',
    backToCluster: 'Back to storage overview',
    reserve: 'Shaving reserve',
    throughput: 'Throughput',
    stored: 'Stored energy',
    lineFrom: '→',
  },
  timeline: {
    title: 'Day replay',
    play: 'Play',
    pause: 'Pause',
    restart: 'Back to 00:00',
    speed: 'Speed',
    chart: 'Trends',
    renewable: 'Renewables',
    load: 'Load',
    grid: 'Import',
    battery: 'Storage',
    soc: 'SOC',
    baseline: 'Sunny baseline',
    importCap: 'Import cap',
    bookmarks: {
      night: '00:30 Night',
      noon: '12:00 Noon',
      fault: '17:30 Fault',
      peak: '19:00 Peak',
    },
    tariffNote: 'Example time-of-use tariff',
  },
  tour: {
    start: 'Guided tour',
    stop: 'End tour',
    next: 'Next',
    back: 'Back',
    finish: 'Start exploring',
    skip: 'Exit tour',
    hint: 'Playback is paused. You can exit at any time.',
    steps: {
      overview: {
        title: 'Meet the energy site',
        body: 'Solar, wind, storage and consumers share a collection bus. Moving particles show power direction. This is a simulation, with no remote control of real equipment.',
      },
      generation: {
        title: 'Renewable generation',
        body: 'Solar is rated at 20 MWp / 16 MWac, alongside three 4 MW wind turbines. Weather and time determine output. Select equipment to inspect its power, rating and connected lines.',
      },
      storage: {
        title: 'Battery energy storage',
        body: 'Four units provide 10 MW / 20 MWh of bidirectional storage. SOC shows stored energy. Dispatch prioritizes peak shaving, then renewable surplus absorption and tariff-based operation.',
      },
      grid: {
        title: 'Grid and substation',
        body: 'The site connects to the external grid through a 110/35 kV transformer. Import and export are each capped at 15 MW. Internal feeders distribute power; arrows and labels distinguish buying from selling.',
      },
      loads: {
        title: 'Industry, homes and charging',
        body: 'Industrial demand peaks in the daytime, while homes and charging increase evening demand. Their staggered profiles show how storage balances generation and consumption.',
      },
      scenarios: {
        title: 'Choose a full-day scenario',
        body: 'Sunny, cloudy with low wind, and storage fault are complete daily scenarios. In the fault case, BESS-04 trips at 17:30, leaving 7.5 MW online. Compare the resulting curves and alarms.',
      },
      metrics: {
        title: 'Read the key metrics',
        body: 'These cards show renewable output, total demand, storage SOC, grid exchange and accumulated bill savings. All values refer to the same minute selected on the timeline.',
      },
      timeline: {
        title: 'Explore the timeline',
        body: 'Drag the slider or tap the chart to seek. Bookmarks jump to midday or evening peak; Play animates the day. Bands mark tariff periods. Toggle curves in the legend; dashed fault-day curves show the sunny reference.',
      },
      details: {
        title: 'Inspect equipment details',
        body: 'Select a model, label or device row to see its own measurements here. Storage shows SOC, temperature and available discharge power; solar shows DC and AC ratings and output.',
      },
      devices: {
        title: 'Find equipment by category',
        body: 'Generation, grid, storage and loads group all site devices. Select a row to focus its model, open its details and highlight connected lines.',
      },
      savings: {
        title: 'Understand the bill difference',
        body: 'Open the savings card for full-day or up-to-now bill breakdowns. If the baseline leaves demand unserved, only a bill difference is shown. Fault-day notes explain inventory changes and frozen offline energy.',
      },
      alarms: {
        title: 'Locate active alarms',
        body: 'The bell lists alarms at the selected minute. Select an alarm to locate its device. The fault scenario shows a temperature warning before the 17:30 trip.',
      },
      camera: {
        title: 'Set your view and explore',
        body: 'Use plus and minus to zoom, the rotation control to orbit, and Home to restore the overview. After the tour, choose a scenario and compare midday with the evening peak on the timeline.',
      },
    },
  },
  camera: { zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset view', rotate: 'Auto-rotate' },
  savings: {
    title: 'Bill savings',
    sub: 'vs. no storage',
    stored: (v) => `plus ${v} MWh stored for later`,
    infeasible: 'Baseline cannot meet demand',
    explainTitle: 'How savings are calculated',
    scopeNow: 'Up to now',
    scopeDay: 'Full day',
    whereFrom: 'Where the savings come from',
    lessBuy: (b) => `Buy less at ${b}`,
    moreBuy: (b) => `Buy more at ${b} (charging)`,
    lessSell: 'Sell less surplus (kept for the evening)',
    moreSell: 'Sell more surplus',
    net: 'Net savings',
    billDifference: 'Bill difference (not comparable)',
    differenceFrom: 'Bill difference breakdown',
    faultEnergy: (delta, offline) =>
      `Stored energy change over this window: ${delta} MWh; offline frozen energy at its end: ${offline} MWh. The fault day is not periodic. Bills do not value inventory changes; frozen energy is currently unavailable.`,
    gapNote: (v) =>
      `The no-storage case leaves ${v} MWh unserved. These bills cover different amounts of supplied energy; their difference is not a like-for-like saving.`,
    howTo: 'Method',
    notes: [
      'Both cases share the same weather, load and tariff; the only difference is the storage plant.',
      'Storage buys or stores energy when it is cheap (or surplus solar) and releases it at peak prices.',
      'Sunny and cloudy days are periodic: stored energy at 24:00 equals 00:00. The fault day starts from the sunny state and may end with different stored energy.',
      'Example tariff values; demand charges, depreciation and O&M are excluded.',
    ],
    explain: [
      'Savings = net energy bill of a no-storage case with the same weather, load and tariff − net bill of this case, accumulated up to now.',
      'Charging costs money before discharging saves it, so the figure can dip below zero around midday; the card also shows energy stored for later.',
      'Only sunny and cloudy days have equal starting and ending energy. Read fault-day bills alongside inventory changes and offline frozen energy.',
      'Example tariff: off-peak $0.049, mid $0.094, peak $0.150 / kWh; export $0.039 / kWh (the model prices in CNY; shown in USD at a fixed example rate of ¥7.2 = $1). Demand charges, depreciation and O&M are excluded.',
    ],
    baseline: 'No storage',
    current: 'This case',
  },
  alarms: {
    title: 'Alarms',
    none: 'No alarms at this moment',
    locate: 'Locate',
    'bess-temp-high': {
      title: 'BESS-04 temperature high',
      impact: 'Cell temperature keeps rising; over-temperature protection may trip',
    },
    'bess-overheat-trip': {
      title: 'BESS-04 tripped on over-temperature',
      impact:
        'Online power drops to 7.5 MW; its stored energy is locked and the other three units re-plan',
    },
  },
  labels: { windFarm: 'Wind farm', bessPlant: 'BESS plant' },
  legend: {
    renewable: 'Renewables',
    grid: 'Grid / feeders',
    charge: 'Charging',
    discharge: 'Discharging',
  },
  close: 'Close',
  loading: 'Pre-computing 1,440 minutes…',
  loadFailed: 'Could not load the simulation',
  reload: 'Reload',
  noWebgl: '3D view unavailable here; metrics and charts still work.',
  sceneLoading: 'Loading 3D scene…',
  modelNote: 'Simulation · active-power balance · example parameters',
  about: 'About the model',
  aboutBody: [
    'Site-level active-power simulation: each scenario is computed once for 1,440 minutes; scrubbing the timeline only reads cached results.',
    'Capacity: solar 20 MWp / 16 MWac; wind 3 × 4 MW; storage 4 × 2.5 MW / 5 MWh (SOC 10–90%, 95% charge and discharge efficiency); grid import and export each capped at 15 MW.',
    'Strategy: ① shave load above the grid limit first ② store renewable surplus ③ charge from the grid (off-peak, or top-up at mid-peak) only as much as needed after expected surplus ④ at peak, flatten import to one planned level using energy above the shaving reserve.',
    'Weather and load are known for the day (perfect forecast); equipment faults are not, and trigger a re-plan. No power flow, reactive power or ageing; temperature and SOH are illustrative.',
  ],
}

const DICTS: Record<Lang, Dict> = { zh, en }
const I18nContext = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({
  lang: 'en',
  t: en,
  setLang: () => {},
})

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('bess-twin-language')
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    /* storage unavailable */
  }
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, updateLang] = useState<Lang>(initialLang)
  const setLang = (value: Lang) => {
    updateLang(value)
    try {
      // The old key also persisted automatic locale detection; only explicit choices are saved now.
      localStorage.setItem('bess-twin-language', value)
    } catch {
      /* storage unavailable */
    }
  }
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])
  return (
    <I18nContext.Provider value={{ lang, t: DICTS[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  return { ...ctx, l: (text: Localized) => text[ctx.lang] }
}
