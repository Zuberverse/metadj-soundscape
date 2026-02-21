/**
 * Soundscape Theme Presets
 * MetaDJ brand-aligned visual themes for audio-reactive generation
 *
 * SCOPE API NOTES (what's actually sent vs design intent):
 * - basePrompt + styleModifiers: SENT (combined with intensity/temporal descriptors)
 * - negativePrompt: NOT SENT (Scope API doesn't support negative prompts)
 * - ranges.noiseScale: USED (mapped from audio energy)
 * - ranges.denoisingSteps: USED (fixed 4-step schedule for quality)
 * - ranges.transitionSpeed: NOT DIRECTLY USED (transitions use fixed step counts)
 * - mappings.energy → noiseScale: ACTIVE
 * - mappings.brightness → promptWeight: NOT ACTIVE (promptWeight not a Scope param)
 * - mappings.beats: ALL ACTIONS NOW = NOISE BOOST ONLY (no prompt changes on beats)
 * - promptVariations: ONLY triggered by energy_spike (beat trigger bypassed)
 *
 * These design values are preserved for future expansion or reference.
 */

import type {
  Theme,
  CustomThemeInput,
  ReactivityPreset,
  BeatResponse,
} from "./types";

// ============================================================================
// Preset Themes (MetaDJ Brand-Aligned)
// ============================================================================

/**
 * Cosmic Voyage - The signature MetaDJ journey through digital space
 */
export const COSMIC_VOYAGE: Theme = {
  id: "astral",
  name: "Astral",
  description: "Endless high-speed journey through a neon-lit digital cosmos",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "deep space void, vibrant neon purple and cyan nebulas, " +
    "floating geometric structures with intense glowing edges, ethereal light particles, " +
    "deep space atmosphere, stars and galaxies rushing past, " +
    "high-contrast magenta energy accents, epic journey forward",
  styleModifiers: ["cinematic lighting", "high contrast", "vibrant colors", "volumetric fog", "high definition", "ultra detailed"],

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 }, // Tuned for higher fidelity and smoother motion
    transitionSpeed: { min: 8, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "exponential",
        sensitivity: 1.4, // Increased sensitivity
        invert: false,
      },
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 1.0,
        invert: true,
      },
    ],
    brightness: [
      {
        parameter: "promptWeight",
        curve: "linear",
        sensitivity: 0.8,
        invert: false,
      },
    ],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise", // Smooth energy boost, preserves continuity
      intensity: 0.5,
      cooldownMs: 200,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      // Keep purple/cyan palette for seamless transitions
      "nebula explosion, purple energy burst, cosmic shockwave, stars accelerating, neon light surge, magenta plasma wave",
      "wormhole opening, cyan light vortex, reality bending, space folding, purple dimension shift, electric cosmos",
    ],
    blendDuration: 8, // Smoother blend window
  },
};

/**
 * Neon Foundry - The AI Foundry creative sanctuary
 */
export const NEON_FOUNDRY: Theme = {
  id: "forge",
  name: "Forge",
  description: "Endless descent into the AI Foundry",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "futuristic workshop interior, massive glowing machinery passing by, " +
    "vibrant holographic displays, high-contrast illumination, " +
    "gothic architecture meets technology, creative forge, " +
    "blinding plasma sparks flying past, AI foundry exploration, luminous metallic depth",
  styleModifiers: ["industrial aesthetic", "luminous industrial atmosphere", "vibrant neon accents", "high contrast", "high definition"],

  ranges: {
    denoisingSteps: { min: [800, 500], max: [1000, 800, 600, 400] },
    noiseScale: { min: 0.48, max: 0.68 }, // Tuned for higher fidelity and smoother motion
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "linear",
        sensitivity: 1.2, // Increased sensitivity
        invert: false,
      },
    ],
    brightness: [],
    texture: [
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 1.2,
        invert: false,
      },
    ],
    beats: {
      enabled: true,
      action: "pulse_noise", // Smooth energy boost, preserves continuity
      intensity: 0.6,
      cooldownMs: 200,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "purple sparks eruption, neon surge, foundry power burst, cyan machinery flash",
      "hologram overload, magenta glitch, digital pulse, gothic energy wave",
    ],
    blendDuration: 8, // Smoother blend window
  },
};

/**
 * Digital Forest - Nature meets technology
 */
export const DIGITAL_FOREST: Theme = {
  id: "forest",
  name: "Forest",
  description: "High-speed weave through a bioluminescent cyber-forest",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "luminous enchanted forest at blue hour, deeply vibrant bioluminescent plants rushing past, " +
    "luminous particles streaming by, intense magical botanical glow, " +
    "mystical atmosphere, tech-organic fusion, " +
    "layered forest depth with high-contrast glowing flora",
  styleModifiers: ["lush bioluminescent atmosphere", "vibrant bioluminescence", "high contrast", "soft glow", "high definition"],

  ranges: {
    denoisingSteps: { min: [750, 450], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 }, // Tuned for higher fidelity and smoother motion
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "logarithmic",
        sensitivity: 0.9,
        invert: false,
      },
    ],
    brightness: [
      {
        parameter: "promptWeight",
        curve: "linear",
        sensitivity: 1.1,
        invert: false,
      },
    ],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise", // Changed from prompt_cycle - beats only affect noise now
      intensity: 0.4,
      cooldownMs: 300,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "cyan fireflies swarm, bioluminescent burst, magenta particle dance",
      "purple aurora surge, light ribbons flow, magical forest pulse",
    ],
    blendDuration: 8, // Smoother blend window
  },
};

/**
 * Synthwave Highway - 80s retro-futurism in motion
 */
export const SYNTHWAVE_HIGHWAY: Theme = {
  id: "synthwave",
  name: "Synthwave",
  description: "Infinite flight towards a glowing synthwave sunset",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "digital synthwave landscape, radiant cybernetic grid stretching endlessly ahead, " +
    "massive prominent glowing sun in the center, vibrant electric pinks, cyan, and pastel teal accents, stylized wireframe palm trees rushing past, " +
    "slick 80s retro-tech aesthetic, subtle miami vice vibes, intense lighting contrast, motion blur, starry night sky",
  styleModifiers: ["digital synthwave", "sunset glow backdrop", "vibrant neon and cyan", "high contrast", "scan lines"],

  ranges: {
    denoisingSteps: { min: [700, 400], max: [950, 700, 450] },
    noiseScale: { min: 0.48, max: 0.68 }, // Tuned for higher fidelity and smoother motion
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "exponential",
        sensitivity: 1.5, // Increased for more responsiveness
        invert: false,
      },
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 1.0,
        invert: true,
      },
    ],
    brightness: [],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise", // Smooth energy boost, preserves continuity
      intensity: 0.6,
      cooldownMs: 200,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "magenta neon burst, purple grid explosion, synthwave lightning, retro surge",
      "cyan speed lines, motion blur, highway accelerating, vaporwave rush",
    ],
    blendDuration: 8, // Smoother blend window
  },
};

/**
 * Crystal Sanctuary - The gothic castle interior
 */
export const CRYSTAL_SANCTUARY: Theme = {
  id: "sanctuary",
  name: "Sanctuary",
  description: "Floating endlessly through a gothic crystal fortress",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "gothic crystal castle interior, blinding neon stained glass windows, " +
    "glowing crystal chandeliers passing overhead, intense magical candlelight and floating orbs, " +
    "stone arches sweeping past, mystical atmosphere, vibrant moonlight beams across crystal walls, " +
    "sanctuary exploration, ethereal mist swirling, high contrast lighting",
  styleModifiers: [
    "luminous gothic atmosphere",
    "dramatic lighting",
    "vibrant crystals",
    "gothic architecture",
    "high definition"
  ],

  ranges: {
    denoisingSteps: { min: [800, 500], max: [1000, 800, 600, 400] },
    noiseScale: { min: 0.48, max: 0.68 }, // Tuned for higher fidelity and smoother motion
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "logarithmic",
        sensitivity: 1.0,
        invert: false,
      },
    ],
    brightness: [
      {
        parameter: "promptWeight",
        curve: "linear",
        sensitivity: 0.6,
        invert: false,
      },
    ],
    texture: [
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 0.8,
        invert: false,
      },
    ],
    beats: {
      enabled: true,
      action: "pulse_noise", // Changed from transition_trigger - beats only affect noise now
      intensity: 0.4,
      cooldownMs: 400,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "purple crystal surge, cyan stained glass glow, magenta energy awakening",
      "magical light burst, sanctuary illumination, gothic power pulse",
    ],
    blendDuration: 8, // Smoother blend window
  },
};

/**
 * Ocean Depths - Underwater bioluminescent exploration
 */
export const OCEAN_DEPTHS: Theme = {
  id: "ocean",
  name: "Ocean",
  description: "Deep dive flythrough in bioluminescent waters",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "deep ocean blue abyss, intensely vibrant bioluminescent creatures drifting past, " +
    "glowing iridescent jellyfish, iridescent coral formations with neon accents, " +
    "ethereal glowing light filtering through teal water, sea plants swaying, " +
    "deep-sea glow with vivid neon accents",
  styleModifiers: ["luminous underwater atmosphere", "vibrant bioluminescence", "high contrast", "volumetric light", "high definition"],

  ranges: {
    denoisingSteps: { min: [750, 450], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "logarithmic",
        sensitivity: 1.1,
        invert: false,
      },
    ],
    brightness: [
      {
        parameter: "promptWeight",
        curve: "linear",
        sensitivity: 0.9,
        invert: false,
      },
    ],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.45,
      cooldownMs: 250,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "jellyfish swarm pulse, cyan bioluminescent burst, purple depth surge",
      "ocean current rush, magenta creature bloom, underwater light dance",
    ],
    blendDuration: 8,
  },
};

/**
 * Cyber City - Neon-lit futuristic cityscape flight
 */
export const CYBER_CITY: Theme = {
  id: "cyber",
  name: "Cyber",
  description: "Freefall flight through a cyberpunk cityscape",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "towering cyberpunk skyscrapers by night, intensely vibrant neon signage, " +
    "massive overhead transport ships, rain-slicked streets below reflecting bright neon, " +
    "high-contrast glowing light panels, futuristic city exploration, luminous haze, " +
    "glass and chrome architecture",
  styleModifiers: ["neon-drenched atmosphere", "cyberpunk aesthetic", "vibrant neon reflections", "high contrast", "rain atmosphere"],

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "exponential",
        sensitivity: 1.4,
        invert: false,
      },
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 1.0,
        invert: true,
      },
    ],
    brightness: [],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.55,
      cooldownMs: 200,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "neon explosion, purple hologram burst, cyan light cascade, city pulse",
      "electric surge, magenta sign flare, cyberpunk overload, glass reflections",
    ],
    blendDuration: 8,
  },
};

/**
 * Aurora Dreams - Flowing through ethereal northern lights
 */
export const AURORA_DREAMS: Theme = {
  id: "aurora",
  name: "Aurora",
  description: "Flowing continuously through ethereal light ribbons",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "midnight sky with vivid vibrant aurora borealis, intensely glowing curtains of neon light, " +
    "abstract light ribbons dancing, dense star field beyond, " +
    "ethereal mist swirling across a vast twilight sky, " +
    "dreamlike atmosphere, high-contrast celestial light show",
  styleModifiers: ["luminous celestial atmosphere", "ethereal", "vibrant colors", "high contrast", "flowing motion"],

  ranges: {
    denoisingSteps: { min: [800, 500], max: [1000, 800, 600, 400] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "logarithmic",
        sensitivity: 0.85,
        invert: false,
      },
    ],
    brightness: [
      {
        parameter: "promptWeight",
        curve: "linear",
        sensitivity: 1.0,
        invert: false,
      },
    ],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.35,
      cooldownMs: 350,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "aurora surge, purple light wave, cyan ribbon dance, celestial bloom",
      "light curtain pulse, magenta energy flow, ethereal burst, star shimmer",
    ],
    blendDuration: 8,
  },
};

/**
 * 8-Bit Adventure - Retro pixel art gaming worlds
 */
export const EIGHT_BIT_ADVENTURE: Theme = {
  id: "arcade",
  name: "Arcade",
  description: "High-velocity rush through a retro 8-bit voxel world",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "vibrant retro pixel art world, colorful 8-bit aesthetic, blocky voxel terrain, " +
    "cyan magenta and yellow pixel particles across a bright arcade backdrop, " +
    "intensely glowing power-ups floating, rainbow digital grid patterns, " +
    "game-like atmosphere, playful high-energy adventure",
  styleModifiers: ["bright pixel art", "retro gaming", "saturated colors", "vibrant glowing edges", "clean contrast"],

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "exponential",
        sensitivity: 1.3,
        invert: false,
      },
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 1.0,
        invert: true,
      },
    ],
    brightness: [
      {
        parameter: "promptWeight",
        curve: "linear",
        sensitivity: 0.9,
        invert: false,
      },
    ],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.55,
      cooldownMs: 180,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "pixel explosion, 8-bit particles burst, retro power-up collected, glowing coins scatter, cyan energy wave",
      "level warp zone, pixel portal opening, digital blocks transforming, magenta lightning, game world shift",
    ],
    blendDuration: 8,
  },
};

/**
 * Volcanic Forge - Molten fire and ember landscapes
 */
export const VOLCANIC_FORGE: Theme = {
  id: "volcano",
  name: "Volcano",
  description: "Endless dive through magma and molten embers",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "glowing volcanic landscape, intensely glowing rivers of molten lava flowing far below, " +
    "vibrant embers and sparks rising, magma pools with blinding mineral glow, " +
    "massive obsidian rock formations creating high contrast, heat shimmer, " +
    "dramatic fire plumes across a blazing forge of creation",
  styleModifiers: ["fiery luminous atmosphere", "dramatic lighting", "vibrant fiery colors", "high contrast", "volcanic atmosphere"],

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "exponential",
        sensitivity: 1.5,
        invert: false,
      },
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 1.0,
        invert: true,
      },
    ],
    brightness: [],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.6,
      cooldownMs: 180,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "lava eruption burst, magma fountain, ember storm, cyan mineral flash, volcanic power surge",
      "fire tornado forming, molten wave, obsidian shattering, magenta plasma burst, forge ignition",
    ],
    blendDuration: 8,
  },
};

/**
 * Quantum Realm - Abstract particle physics visualizations
 */
export const QUANTUM_REALM: Theme = {
  id: "quantum",
  name: "Quantum",
  description: "Infinite zoom through quantum particle dimensions",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "deep indigo quantum particle field, structured subatomic geometry, " +
    "intensely vibrant probability waves, electron orbitals blindingly glowing across the field, " +
    "string theory visualizations mixed with high-contrast energy bursts, " +
    "astrophysical scientific beauty, glowing microscopic cosmos",
  styleModifiers: ["luminous scientific atmosphere", "vibrant subatomic glow", "high contrast", "scientific aesthetic", "dimensional depth"],

  ranges: {
    denoisingSteps: { min: [750, 450], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "logarithmic",
        sensitivity: 1.2,
        invert: false,
      },
    ],
    brightness: [
      {
        parameter: "promptWeight",
        curve: "linear",
        sensitivity: 0.9,
        invert: false,
      },
    ],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.5,
      cooldownMs: 200,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "particle collision burst, quantum entanglement flash, cyan wave function collapse, probability surge",
      "string vibration cascade, magenta dimension fold, subatomic dance, quantum tunnel opening",
    ],
    blendDuration: 8,
  },
};

/**
 * Neon Tokyo - Japanese cyberpunk nightlife
 */
export const NEON_TOKYO: Theme = {
  id: "tokyo",
  name: "Tokyo",
  description: "Relentless night street race through cyberpunk Japan",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "neon Tokyo streets at night, Japanese signage glowing in the distance, " +
    "subtle cherry blossoms mixed with holographic ads, vivid neon light, " +
    "rain-slicked pavement reflections, scattered izakaya lanterns, " +
    "dynamic anime aesthetic atmosphere, cyberpunk meets tradition",
  styleModifiers: ["neon urban atmosphere", "Japanese aesthetic", "rain atmosphere", "high definition", "urban night"],

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "exponential",
        sensitivity: 1.4,
        invert: false,
      },
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 1.0,
        invert: true,
      },
    ],
    brightness: [],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.55,
      cooldownMs: 180,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "neon sign explosion, kanji characters flashing, cyan rain burst, tokyo night pulse",
      "hologram advertisement surge, cherry blossom storm, magenta light cascade, street racing flash",
    ],
    blendDuration: 8,
  },
};

// ============================================================================
// All Preset Themes
// ============================================================================

/**
 * Circuit Board - Macro photography of a digital motherboard
 */
export const CIRCUIT_BOARD: Theme = {
  id: "circuit",
  name: "Circuit",
  description: "Infinite macro flight over a glowing microchip and data streams",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "macro photography of a futuristic circuit board, emerald and obsidian PCB, " +
    "golden data streams flowing through copper traces, microchips passing by, " +
    "amber glowing components, digital motherboard landscape, " +
    "high contrast lighting, technological interior",
  styleModifiers: ["macro photography", "depth of field", "luminous tech aesthetic", "high definition", "ultra detailed"],

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "exponential",
        sensitivity: 1.4,
        invert: false,
      },
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 1.0,
        invert: true,
      },
    ],
    brightness: [],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.55,
      cooldownMs: 200,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "golden data surge, copper trace overload, circuit board spark, component glowing",
      "amber power burst, microchip activation, digital motherboard pulse, high-tech energy",
    ],
    blendDuration: 8,
  },
};

/**
 * Amethyst Caves - Deep underground crystal caverns
 */
export const AMETHYST_CAVES: Theme = {
  id: "amethyst",
  name: "Amethyst",
  description: "Deep underground flight through glowing crystal caverns",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "vast underground cavern, massive purple amethyst crystals, " +
    "faint bio-luminescence, floating rock formations glowing subtly, " +
    "mysterious underground expanse with crystalline light shafts, " +
    "subtle violet reflections, cinematic cavern exploration",
  styleModifiers: ["luminous crystal atmosphere", "cinematic lighting", "depth-rich contrast", "high definition", "subtle glow"],

  ranges: {
    denoisingSteps: { min: [750, 450], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "logarithmic",
        sensitivity: 1.1,
        invert: false,
      },
    ],
    brightness: [
      {
        parameter: "promptWeight",
        curve: "linear",
        sensitivity: 0.9,
        invert: false,
      },
    ],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.45,
      cooldownMs: 250,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "amethyst crystal resonance, purple glow intensifying, cavern echo, bio-luminescent pulse",
      "subtle violet energy wave, crystal formation shimmering, cavern light movement",
    ],
    blendDuration: 8,
  },
};

/**
 * Digital Matrix - Minimalist retro wireframe grid
 */
export const DIGITAL_MATRIX: Theme = {
  id: "matrix",
  name: "Matrix",
  description: "Minimalist infinite wireframe grid in deep void space",

  basePrompt:
    "infinite forward motion, endless high-speed flythrough, camera rushing forward, deep parallax perspective, passing through " +
    "deep emerald void space, infinite minimalist wireframe grid in bright green, " +
    "faint cascading data symbols, floating geometric outlines, " +
    "retro computer graphics aesthetic, high-contrast vector glow, " +
    "digital cyberspace structure, pure geometry",
  styleModifiers: ["minimalist", "wireframe", "high-contrast backdrop", "high definition", "retro digital"],

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 6, max: 18 },
  },

  mappings: {
    energy: [
      {
        parameter: "noiseScale",
        curve: "exponential",
        sensitivity: 1.3,
        invert: false,
      },
      {
        parameter: "denoisingSteps",
        curve: "stepped",
        sensitivity: 1.0,
        invert: true,
      },
    ],
    brightness: [],
    texture: [],
    beats: {
      enabled: true,
      action: "pulse_noise",
      intensity: 0.5,
      cooldownMs: 200,
    },
  },

  promptVariations: {
    trigger: "energy_spike",
    prompts: [
      "wireframe grid acceleration, cascading data storm, geometric outline flash, digital space warping",
      "vector graphics surge, minimalist geometry multiplying, green data surge, void expansion",
    ],
    blendDuration: 8,
  },
};

export const PRESET_THEMES: Theme[] = [
  COSMIC_VOYAGE,
  NEON_FOUNDRY,
  DIGITAL_FOREST,
  SYNTHWAVE_HIGHWAY,
  CRYSTAL_SANCTUARY,
  OCEAN_DEPTHS,
  CYBER_CITY,
  AURORA_DREAMS,
  EIGHT_BIT_ADVENTURE,
  VOLCANIC_FORGE,
  QUANTUM_REALM,
  NEON_TOKYO,
  CIRCUIT_BOARD,
  AMETHYST_CAVES,
  DIGITAL_MATRIX,
];

export const THEMES_BY_ID: Record<string, Theme> = {
  astral: COSMIC_VOYAGE,
  forge: NEON_FOUNDRY,
  forest: DIGITAL_FOREST,
  synthwave: SYNTHWAVE_HIGHWAY,
  sanctuary: CRYSTAL_SANCTUARY,
  ocean: OCEAN_DEPTHS,
  cyber: CYBER_CITY,
  aurora: AURORA_DREAMS,
  arcade: EIGHT_BIT_ADVENTURE,
  volcano: VOLCANIC_FORGE,
  quantum: QUANTUM_REALM,
  tokyo: NEON_TOKYO,
  circuit: CIRCUIT_BOARD,
  amethyst: AMETHYST_CAVES,
  matrix: DIGITAL_MATRIX,
};

// ============================================================================
// Custom Theme Factory
// ============================================================================

const REACTIVITY_PRESETS: Record<
  ReactivityPreset,
  { noiseSensitivity: number; stepsSensitivity: number }
> = {
  subtle: { noiseSensitivity: 0.5, stepsSensitivity: 0.3 },
  balanced: { noiseSensitivity: 1.0, stepsSensitivity: 0.7 },
  intense: { noiseSensitivity: 1.5, stepsSensitivity: 1.2 },
  chaotic: { noiseSensitivity: 2.0, stepsSensitivity: 1.5 },
};

// NOTE: All beat responses now result in noise boosts only (no prompt changes or cache resets)
// The action field is preserved for type compatibility but all are treated as pulse_noise
const BEAT_RESPONSE_MAP: Record<
  BeatResponse,
  { enabled: boolean; action: Theme["mappings"]["beats"]["action"]; intensity: number }
> = {
  none: { enabled: false, action: "pulse_noise", intensity: 0 },
  pulse: { enabled: true, action: "pulse_noise", intensity: 0.3 },
  shift: { enabled: true, action: "pulse_noise", intensity: 0.4 }, // Changed from prompt_cycle
  burst: { enabled: true, action: "pulse_noise", intensity: 0.5 }, // Changed from cache_reset (no hard cuts)
};

/**
 * Create a custom theme from simplified input
 */
export function createCustomTheme(input: CustomThemeInput): Theme {
  const preset = REACTIVITY_PRESETS[input.reactivity || "balanced"];
  const beatConfig = BEAT_RESPONSE_MAP[input.beatResponse || "pulse"];

  return {
    id: `custom-${Date.now()}`,
    name: "Custom Theme",
    description: input.prompt.slice(0, 50) + "...",

    basePrompt: input.prompt,
    styleModifiers: input.style || ["high quality", "detailed"],

    ranges: {
      denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
      noiseScale: { min: 0.48, max: 0.68 }, // Tuned for higher fidelity and smoother motion
      transitionSpeed: { min: 6, max: 18 },
    },

    mappings: {
      energy: [
        {
          parameter: "noiseScale",
          curve: "exponential",
          sensitivity: preset.noiseSensitivity,
          invert: false,
        },
        {
          parameter: "denoisingSteps",
          curve: "stepped",
          sensitivity: preset.stepsSensitivity,
          invert: true,
        },
      ],
      brightness: [
        {
          parameter: "promptWeight",
          curve: "linear",
          sensitivity: 0.8,
          invert: false,
        },
      ],
      texture: [],
      beats: {
        enabled: beatConfig.enabled,
        action: beatConfig.action,
        intensity: beatConfig.intensity,
        cooldownMs: beatConfig.action === "cache_reset" ? 500 : 200,
      },
    },
  };
}

// ============================================================================
// Style Modifier Suggestions
// ============================================================================

export const SUGGESTED_STYLE_MODIFIERS = [
  "cinematic",
  "dreamy",
  "luminous",
  "vibrant",
  "minimal",
  "abstract",
  "geometric",
  "organic",
  "glitch",
  "neon",
  "ethereal",
  "dramatic",
  "soft",
  "intense",
  "mystical",
];
