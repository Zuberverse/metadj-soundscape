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
  id: "cosmic-voyage",
  name: "Cosmic Voyage",
  description: "Journey through neon-lit digital cosmos",

  basePrompt:
    "adventurous flythrough, dynamic camera movement, soaring through " +
    "cosmic digital landscape, neon purple and cyan nebula, " +
    "floating geometric structures, ethereal light particles, " +
    "deep space atmosphere, stars and galaxies rushing past, " +
    "magenta energy accents, epic journey forward",
  styleModifiers: ["cinematic lighting", "depth of field", "volumetric fog", "high definition", "ultra detailed"],
  negativePrompt: "blurry, low quality, text, watermark, human faces",

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.5, max: 0.7 }, // Higher floor for more evolution
    transitionSpeed: { min: 4, max: 16 },
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
    blendDuration: 6, // Faster transitions (was 8)
  },
};

/**
 * Neon Foundry - The AI Foundry creative sanctuary
 */
export const NEON_FOUNDRY: Theme = {
  id: "neon-foundry",
  name: "Neon Foundry",
  description: "Inside the Zuberant AI Foundry - where creation happens",

  basePrompt:
    "adventurous flythrough, sweeping camera movement, gliding through " +
    "futuristic workshop interior, glowing machinery passing by, " +
    "holographic displays in cyan, purple ambient lighting, " +
    "gothic architecture meets technology, creative forge, " +
    "magenta sparks flying past, AI foundry exploration",
  styleModifiers: ["industrial aesthetic", "dramatic shadows", "neon accents", "high definition", "sharp details"],
  negativePrompt: "outdoor, nature, daylight, cartoon",

  ranges: {
    denoisingSteps: { min: [800, 500], max: [1000, 800, 600, 400] },
    noiseScale: { min: 0.5, max: 0.7 }, // Higher floor for more evolution
    transitionSpeed: { min: 6, max: 20 },
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
    blendDuration: 6, // Faster transitions (was 8)
  },
};

/**
 * Digital Forest - Nature meets technology
 */
export const DIGITAL_FOREST: Theme = {
  id: "digital-forest",
  name: "Digital Forest",
  description: "Bioluminescent nature infused with technology",

  basePrompt:
    "adventurous flythrough, flowing camera movement, weaving through " +
    "enchanted forest at night, bioluminescent plants rushing past, " +
    "floating particles streaming by, cyan and magenta glow, " +
    "mystical atmosphere, tech-organic fusion, " +
    "purple shadows, dynamic forest exploration",
  styleModifiers: ["magical realism", "soft glow", "ethereal", "high definition", "crisp details"],
  negativePrompt: "urban, concrete, harsh lighting, realistic",

  ranges: {
    denoisingSteps: { min: [750, 450], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.65 }, // Higher floor for more evolution
    transitionSpeed: { min: 8, max: 24 },
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
    blendDuration: 6, // Faster transitions (was 8)
  },
};

/**
 * Synthwave Highway - 80s retro-futurism in motion
 */
export const SYNTHWAVE_HIGHWAY: Theme = {
  id: "synthwave-highway",
  name: "Synthwave Highway",
  description: "80s retro-futuristic endless drive",

  basePrompt:
    "high speed flythrough, racing forward, speeding down " +
    "synthwave landscape, neon grid highway stretching ahead, " +
    "sunset gradient sky in purple and magenta, palm trees rushing past, " +
    "retro sports car POV, vaporwave aesthetic, cyan accent lights, motion blur",
  styleModifiers: ["80s aesthetic", "chromatic aberration", "scan lines", "high definition", "vibrant colors"],
  negativePrompt: "modern, realistic, daytime, cloudy",

  ranges: {
    denoisingSteps: { min: [700, 400], max: [950, 700, 450] },
    noiseScale: { min: 0.5, max: 0.72 }, // Higher floor for more evolution
    transitionSpeed: { min: 4, max: 12 },
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
    blendDuration: 6, // Faster transitions (was 8)
  },
};

/**
 * Crystal Sanctuary - The gothic castle interior
 */
export const CRYSTAL_SANCTUARY: Theme = {
  id: "crystal-sanctuary",
  name: "Crystal Sanctuary",
  description: "Inside the gothic castle where transformation happens",

  basePrompt:
    "adventurous flythrough, graceful camera movement, floating through " +
    "gothic castle interior, stained glass windows in purple and cyan, " +
    "crystal chandeliers passing overhead, candlelight and magical orbs, " +
    "stone arches sweeping past, mystical atmosphere, magenta light beams, " +
    "sanctuary exploration, ethereal mist swirling",
  styleModifiers: [
    "dramatic lighting",
    "gothic architecture",
    "magical realism",
    "high definition",
    "intricate details",
  ],
  negativePrompt: "modern, outdoor, daylight, minimalist",

  ranges: {
    denoisingSteps: { min: [800, 500], max: [1000, 800, 600, 400] },
    noiseScale: { min: 0.48, max: 0.65 }, // Higher floor for more evolution
    transitionSpeed: { min: 8, max: 20 },
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
    blendDuration: 6, // Faster transitions (was 8)
  },
};

/**
 * Ocean Depths - Underwater bioluminescent exploration
 */
export const OCEAN_DEPTHS: Theme = {
  id: "ocean-depths",
  name: "Ocean Depths",
  description: "Diving through bioluminescent underwater worlds",

  basePrompt:
    "adventurous underwater flythrough, diving camera movement, gliding through " +
    "deep ocean abyss, bioluminescent creatures drifting past, " +
    "glowing jellyfish in cyan and purple, coral formations, " +
    "light rays filtering through dark water, magenta sea plants swaying, " +
    "mysterious depths exploration, bubbles rising",
  styleModifiers: ["underwater caustics", "volumetric light", "ethereal glow", "high definition", "dreamlike"],
  negativePrompt: "surface, sky, land, harsh lighting",

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
    blendDuration: 6,
  },
};

/**
 * Cyber City - Neon-lit futuristic cityscape flight
 */
export const CYBER_CITY: Theme = {
  id: "cyber-city",
  name: "Cyber City",
  description: "Flying through neon-drenched futuristic metropolis",

  basePrompt:
    "high speed flythrough, swooping camera movement, flying between " +
    "towering cyberpunk skyscrapers, neon signs in purple and cyan, " +
    "holographic advertisements streaming past, flying cars, " +
    "rain-slicked streets below, magenta accent lights, " +
    "futuristic city exploration, glass and chrome architecture",
  styleModifiers: ["cyberpunk aesthetic", "neon reflections", "rain atmosphere", "high definition", "sharp details"],
  negativePrompt: "nature, daylight, rural, vintage",

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.52, max: 0.72 },
    transitionSpeed: { min: 4, max: 14 },
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
    blendDuration: 6,
  },
};

/**
 * Aurora Dreams - Flowing through ethereal northern lights
 */
export const AURORA_DREAMS: Theme = {
  id: "aurora-dreams",
  name: "Aurora Dreams",
  description: "Drifting through abstract aurora and light formations",

  basePrompt:
    "gentle flythrough, floating camera movement, drifting through " +
    "aurora borealis, flowing curtains of purple and cyan light, " +
    "abstract light ribbons dancing, star field beyond, " +
    "ethereal mist swirling, magenta energy wisps, " +
    "dreamlike atmosphere, celestial light show",
  styleModifiers: ["ethereal", "soft glow", "abstract", "high definition", "flowing motion"],
  negativePrompt: "ground, buildings, harsh edges, realistic",

  ranges: {
    denoisingSteps: { min: [800, 500], max: [1000, 800, 600, 400] },
    noiseScale: { min: 0.45, max: 0.62 },
    transitionSpeed: { min: 8, max: 24 },
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
    blendDuration: 7,
  },
};

/**
 * 8-Bit Adventure - Retro pixel art gaming worlds
 */
export const EIGHT_BIT_ADVENTURE: Theme = {
  id: "8-bit-adventure",
  name: "8-Bit Adventure",
  description: "Exploring vibrant retro pixel art game worlds",

  basePrompt:
    "adventurous flythrough, dynamic camera movement, soaring through " +
    "retro pixel art world, vibrant 8-bit aesthetic, blocky voxel terrain, " +
    "neon pixel particles, cyan and magenta color palette, " +
    "glowing power-ups floating, digital grid patterns, " +
    "game-like atmosphere, nostalgic adventure forward",
  styleModifiers: ["pixel art", "retro gaming", "vibrant colors", "blocky shapes", "glowing edges"],
  negativePrompt: "realistic, photographic, smooth gradients, organic shapes",

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.48, max: 0.68 },
    transitionSpeed: { min: 4, max: 14 },
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
    blendDuration: 5,
  },
};

/**
 * Volcanic Forge - Molten fire and ember landscapes
 */
export const VOLCANIC_FORGE: Theme = {
  id: "volcanic-forge",
  name: "Volcanic Forge",
  description: "Flying through molten fire and ember landscapes",

  basePrompt:
    "adventurous flythrough, dynamic camera movement, soaring through " +
    "volcanic landscape, rivers of molten lava flowing below, " +
    "glowing embers and sparks rising, magma pools with cyan mineral veins, " +
    "obsidian rock formations, magenta heat shimmer, " +
    "dramatic fire plumes, forge of creation atmosphere",
  styleModifiers: ["dramatic lighting", "heat distortion", "ember particles", "molten glow", "volcanic atmosphere"],
  negativePrompt: "ice, snow, cold, blue tones, peaceful",

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.52, max: 0.72 },
    transitionSpeed: { min: 4, max: 14 },
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
    blendDuration: 5,
  },
};

/**
 * Quantum Realm - Abstract particle physics visualizations
 */
export const QUANTUM_REALM: Theme = {
  id: "quantum-realm",
  name: "Quantum Realm",
  description: "Diving into abstract particle physics dimensions",

  basePrompt:
    "adventurous flythrough, fluid camera movement, diving through " +
    "quantum particle field, subatomic structures swirling, " +
    "probability waves in cyan and purple, electron orbitals glowing, " +
    "string theory visualizations, magenta energy fluctuations, " +
    "abstract scientific beauty, microscopic cosmos",
  styleModifiers: ["abstract geometry", "particle effects", "quantum blur", "scientific aesthetic", "ethereal glow"],
  negativePrompt: "realistic, macro, large scale, buildings, nature",

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
    blendDuration: 6,
  },
};

/**
 * Neon Tokyo - Japanese cyberpunk nightlife
 */
export const NEON_TOKYO: Theme = {
  id: "neon-tokyo",
  name: "Neon Tokyo",
  description: "Racing through Japanese cyberpunk streets",

  basePrompt:
    "high speed flythrough, dynamic camera movement, racing through " +
    "neon-lit Tokyo streets at night, Japanese signage glowing, " +
    "cherry blossoms mixed with holographic ads, cyan and magenta neon, " +
    "rain-slicked pavement reflections, izakaya lanterns, " +
    "anime aesthetic atmosphere, cyberpunk meets tradition",
  styleModifiers: ["Japanese aesthetic", "neon reflections", "rain atmosphere", "anime inspired", "urban night"],
  negativePrompt: "daylight, western, rural, desert, nature only",

  ranges: {
    denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
    noiseScale: { min: 0.5, max: 0.7 },
    transitionSpeed: { min: 4, max: 14 },
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
    blendDuration: 5,
  },
};

// ============================================================================
// All Preset Themes
// ============================================================================

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
];

export const THEMES_BY_ID: Record<string, Theme> = {
  "cosmic-voyage": COSMIC_VOYAGE,
  "neon-foundry": NEON_FOUNDRY,
  "digital-forest": DIGITAL_FOREST,
  "synthwave-highway": SYNTHWAVE_HIGHWAY,
  "crystal-sanctuary": CRYSTAL_SANCTUARY,
  "ocean-depths": OCEAN_DEPTHS,
  "cyber-city": CYBER_CITY,
  "aurora-dreams": AURORA_DREAMS,
  "8-bit-adventure": EIGHT_BIT_ADVENTURE,
  "volcanic-forge": VOLCANIC_FORGE,
  "quantum-realm": QUANTUM_REALM,
  "neon-tokyo": NEON_TOKYO,
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
    negativePrompt: "blurry, low quality, distorted",

    ranges: {
      denoisingSteps: { min: [700, 400], max: [1000, 750, 500, 250] },
      noiseScale: { min: 0.5, max: 0.7 }, // Higher floor for more evolution
      transitionSpeed: { min: 4, max: 16 },
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
  "dark",
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
