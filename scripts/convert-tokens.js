#!/usr/bin/env node

/**
 * convert-tokens.js
 * 
 * Converts design tokens in design-tokens.tokens.json into standard CSS Custom Properties (CSS variables).
 * 
 * ARCHITECTURE & BEST PRACTICES:
 * -----------------------------------------------------------------------------
 * 1. Two-Tier Color System:
 *    - Primitives (--primitive-*):
 *      Raw palette ramps (tones 0-100) and seed key colors.
 *      These are reference values only and MUST NOT be used directly on UI components.
 *    - Color Roles (--color-*):
 *      Semantic, role-based tokens (e.g., --color-primary, --color-surface, --color-outline).
 *      These are what MUST be used directly on the UI for styling buttons, surfaces, borders, text, etc.
 *      Each color role is mapped to its underlying primitive via `var(--primitive-*)`.
 * 
 * 2. Effects & Shadows:
 *    - Drop shadow objects are converted to valid CSS `box-shadow` values (--effect-* & --shadow-*).
 * 
 * 3. Typography:
 *    - Design typography tokens are converted to modular font-size, line-height, font-weight,
 *      letter-spacing variables, font shorthand variables, and utility classes.
 * 
 * 4. Single Source of Truth:
 *    - `design-tokens.tokens.json` remains the single source of truth.
 *    - Whenever design tokens are updated, running this script keeps CSS variables in sync.
 * 
 * USAGE:
 *   node scripts/convert-tokens.js
 *   node scripts/convert-tokens.js --input ./design-tokens.tokens.json --output ./src/styles/tokens.css
 */

const fs = require('fs');
const path = require('path');

// Helper: convert string to kebab-case
function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

// Helper: normalize tone keys (e.g. "primary40" -> "40", "neutralvariant95" -> "95")
function extractTone(toneKey) {
  const match = toneKey.match(/(\d+)$/);
  return match ? match[1] : toneKey;
}

/**
 * Parse tokens and generate CSS variable declarations
 * @param {object} tokens - Parsed JSON object of design-tokens.tokens.json
 * @returns {string} Generated CSS content
 */
function generateCss(tokens) {
  const primitiveMap = new Map(); // token path -> { varName, rawValue }
  const primitiveLines = [];
  const colorRoleLines = [];
  const effectLines = [];
  const typographyLines = [];
  const utilityClasses = [];

  // ===========================================================================
  // 1. PRIMITIVES
  // ===========================================================================
  if (tokens.primitives) {
    // A. Key Colors
    if (tokens.primitives['key colors']) {
      primitiveLines.push('  /* Key Colors (Seed Colors) */');
      for (const [key, token] of Object.entries(tokens.primitives['key colors'])) {
        // e.g. "primary key color" -> "primary"
        const cleanName = key.replace(/\s*key\s*color/i, '').trim();
        const varName = `--primitive-key-color-${toKebabCase(cleanName)}`;
        const tokenPath = `primitives.key colors.${key}`;
        primitiveMap.set(tokenPath, { varName, rawValue: token.value });
        primitiveLines.push(`  ${varName}: ${token.value};`);
      }
      primitiveLines.push('');
    }

    // B. Color Palettes
    if (tokens.primitives['color palettes']) {
      for (const [paletteName, tones] of Object.entries(tokens.primitives['color palettes'])) {
        const paletteKebab = toKebabCase(paletteName);
        primitiveLines.push(`  /* Palette: ${paletteName.charAt(0).toUpperCase() + paletteName.slice(1)} */`);

        // Sort tones numerically if possible
        const toneEntries = Object.entries(tones).sort((a, b) => {
          const numA = parseInt(extractTone(a[0]), 10);
          const numB = parseInt(extractTone(b[0]), 10);
          if (isNaN(numA) || isNaN(numB)) return a[0].localeCompare(b[0]);
          return numA - numB;
        });

        for (const [toneKey, token] of toneEntries) {
          const toneNumber = extractTone(toneKey);
          const varName = `--primitive-color-${paletteKebab}-${toneNumber}`;
          const tokenPath = `primitives.color palettes.${paletteName}.${toneKey}`;
          primitiveMap.set(tokenPath, { varName, rawValue: token.value });
          primitiveLines.push(`  ${varName}: ${token.value};`);
        }
        primitiveLines.push('');
      }
    }
  }

  // ===========================================================================
  // 2. COLOR ROLES (SEMANTIC)
  // ===========================================================================
  if (tokens['color roles']) {
    // Categorize roles for readable and clean CSS grouping
    const categories = {
      primary: 'Primary Accent & Actions',
      secondary: 'Secondary Accent & Actions',
      tertiary: 'Tertiary Accent',
      error: 'Error & Feedback',
      surface: 'Surfaces & Containers',
      outline: 'Outlines & Borders',
      background: 'Backgrounds',
      fixed: 'Fixed Accents',
      other: 'Other Overlays & Roles',
    };

    const categorizedRoles = {
      primary: [],
      secondary: [],
      tertiary: [],
      error: [],
      surface: [],
      outline: [],
      background: [],
      fixed: [],
      other: [],
    };

    for (const [roleName, token] of Object.entries(tokens['color roles'])) {
      const roleKebab = toKebabCase(roleName);
      const varName = `--color-${roleKebab}`;

      // Resolve value: could be an alias "{primitives.color palettes.primary.primary40}"
      let resolvedValue = token.value;
      const aliasMatch = typeof token.value === 'string' && token.value.match(/^\{([^}]+)\}$/);

      if (aliasMatch) {
        const refPath = aliasMatch[1];
        const primitive = primitiveMap.get(refPath);
        if (primitive) {
          // Standard design token practice: point semantic role directly to primitive CSS variable
          resolvedValue = `var(${primitive.varName})`;
        } else {
          // If reference not found directly, create a fallback kebab name
          const fallbackVar = `--${refPath.replace(/[\s.]+/g, '-')}`;
          resolvedValue = `var(${fallbackVar})`;
        }
      }

      const comment = token.description ? ` /* ${token.description} */` : '';
      const declaration = `  ${varName}: ${resolvedValue};${comment}`;

      // Sort into category
      if (roleName.includes('fixed')) {
        categorizedRoles.fixed.push(declaration);
      } else if (roleName.startsWith('primary') || roleName.startsWith('on primary') || roleName === 'inverse primary') {
        categorizedRoles.primary.push(declaration);
      } else if (roleName.startsWith('secondary') || roleName.startsWith('on secondary')) {
        categorizedRoles.secondary.push(declaration);
      } else if (roleName.startsWith('tertiary') || roleName.startsWith('on tertiary')) {
        categorizedRoles.tertiary.push(declaration);
      } else if (roleName.startsWith('error') || roleName.startsWith('on error')) {
        categorizedRoles.error.push(declaration);
      } else if (roleName.includes('surface') || roleName === 'scrim' || roleName === 'shadow') {
        categorizedRoles.surface.push(declaration);
      } else if (roleName.includes('outline')) {
        categorizedRoles.outline.push(declaration);
      } else if (roleName.includes('background')) {
        categorizedRoles.background.push(declaration);
      } else {
        categorizedRoles.other.push(declaration);
      }
    }

    for (const [categoryKey, lines] of Object.entries(categorizedRoles)) {
      if (lines.length > 0) {
        colorRoleLines.push(`  /* ${categories[categoryKey]} */`);
        colorRoleLines.push(...lines);
        colorRoleLines.push('');
      }
    }
  }

  // ===========================================================================
  // 3. EFFECTS / SHADOWS
  // ===========================================================================
  if (tokens.effect) {
    effectLines.push('  /* Elevation / Drop Shadows */');
    for (const [effectName, token] of Object.entries(tokens.effect)) {
      const effectKebab = toKebabCase(effectName);
      if (token.type === 'custom-shadow' && token.value) {
        const {
          offsetX = 0,
          offsetY = 0,
          radius = 0,
          spread = 0,
          color = 'transparent',
        } = token.value;
        const shadowValue = `${offsetX}px ${offsetY}px ${radius}px ${spread}px ${color}`;
        const varName = `--effect-${effectKebab}`;
        effectLines.push(`  ${varName}: ${shadowValue};`);

        // Also add clean alias e.g. --shadow-soft
        const aliasName = `--shadow-${effectKebab.replace(/-shadow$/, '')}`;
        effectLines.push(`  ${aliasName}: ${shadowValue};`);
      }
    }
    effectLines.push('');
  }

  // ===========================================================================
  // 4. TYPOGRAPHY
  // ===========================================================================
  if (tokens.typography) {
    typographyLines.push("  /* Base Font Family */");
    typographyLines.push("  --font-family-base: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;");
    typographyLines.push('');

    for (const [styleName, token] of Object.entries(tokens.typography)) {
      // Fix potential typos in token export (e.g. "headling large" -> "headline-large")
      let cleanName = styleName.replace(/headling/i, 'headline');
      const styleKebab = toKebabCase(cleanName);

      const fontSize = token.fontSize ? `${token.fontSize.value}px` : '16px';
      const lineHeight = token.lineHeight ? `${token.lineHeight.value}px` : 'normal';
      const fontWeight = token.fontWeight ? token.fontWeight.value : '400';
      const letterSpacing = token.letterSpacing ? `${token.letterSpacing.value}px` : '0px';
      const fontFamily = token.fontFamily ? `'${token.fontFamily.value}', var(--font-family-base)` : 'var(--font-family-base)';

      typographyLines.push(`  /* Typography: ${styleName} */`);
      typographyLines.push(`  --typography-${styleKebab}-font-size: ${fontSize};`);
      typographyLines.push(`  --typography-${styleKebab}-line-height: ${lineHeight};`);
      typographyLines.push(`  --typography-${styleKebab}-font-weight: ${fontWeight};`);
      typographyLines.push(`  --typography-${styleKebab}-letter-spacing: ${letterSpacing};`);
      typographyLines.push(`  --typography-${styleKebab}-font-family: ${fontFamily};`);
      typographyLines.push(`  --typography-${styleKebab}-font: ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily};`);

      // If there was a typo like "headling", also support the exact typo variable to prevent breakages
      if (styleName.includes('headling')) {
        const rawKebab = toKebabCase(styleName);
        typographyLines.push(`  --typography-${rawKebab}-font: var(--typography-${styleKebab}-font);`);
      }

      typographyLines.push('');

      // Utility Class
      utilityClasses.push(`.text-${styleKebab} {`);
      utilityClasses.push(`  font-family: var(--typography-${styleKebab}-font-family);`);
      utilityClasses.push(`  font-size: var(--typography-${styleKebab}-font-size);`);
      utilityClasses.push(`  line-height: var(--typography-${styleKebab}-line-height);`);
      utilityClasses.push(`  font-weight: var(--typography-${styleKebab}-font-weight);`);
      utilityClasses.push(`  letter-spacing: var(--typography-${styleKebab}-letter-spacing);`);
      utilityClasses.push(`}`);
    }
  }

  // ===========================================================================
  // COMPOSE FULL CSS
  // ===========================================================================
  const cssContent = `/**
 * ==============================================================================
 * DESIGN TOKENS - CSS VARIABLES
 * 
 * Auto-generated from design-tokens.tokens.json.
 * DO NOT EDIT THIS FILE DIRECTLY.
 * To make changes, update design-tokens.tokens.json and run:
 *   node scripts/convert-tokens.js
 * 
 * ARCHITECTURAL GUIDANCE:
 * ------------------------------------------------------------------------------
 * 1. PRIMITIVES (--primitive-*) [PRIVATE]:
 *    - Raw palette ramps and seed colors.
 *    - DO NOT use primitives directly in UI components.
 * 
 * 2. COLOR ROLES (--color-*) [PUBLIC / UI FACING]:
 *    - Semantic colors mapped to primitives according to intent.
 *    - ALWAYS use these color roles directly in UI implementation:
 *      e.g. background: var(--color-primary);
 *           color: var(--color-on-primary);
 *           background-color: var(--color-surface);
 *           border-color: var(--color-outline);
 * 
 * 3. EFFECTS (--effect-* & --shadow-*):
 *    - Standard elevation box-shadows.
 * 
 * 4. TYPOGRAPHY (--typography-* / .text-*):
 *    - Font scale variables and utility classes.
 * ==============================================================================
 */

:root {
  /* ============================================================================
   * 1. PRIMITIVES (DO NOT USE DIRECTLY IN UI)
   * ============================================================================ */
${primitiveLines.join('\n').trimEnd()}

  /* ============================================================================
   * 2. SEMANTIC COLOR ROLES (USE THESE DIRECTLY ON UI)
   * ============================================================================ */
${colorRoleLines.join('\n').trimEnd()}

  /* ============================================================================
   * 3. EFFECTS & SHADOWS
   * ============================================================================ */
${effectLines.join('\n').trimEnd()}

  /* ============================================================================
   * 4. TYPOGRAPHY VARIABLES
   * ============================================================================ */
${typographyLines.join('\n').trimEnd()}
}

/* ==============================================================================
 * TYPOGRAPHY UTILITY CLASSES
 * ============================================================================== */
${utilityClasses.join('\n')}
`;

  return cssContent;
}

/**
 * Main execution function
 */
function run() {
  const args = process.argv.slice(2);
  let inputPath = path.resolve(process.cwd(), 'design-tokens.tokens.json');
  let outputPath = path.resolve(process.cwd(), 'src/styles/tokens.css');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' || args[i] === '-i') {
      inputPath = path.resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--output' || args[i] === '-o') {
      outputPath = path.resolve(process.cwd(), args[++i]);
    }
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Design tokens file not found at ${inputPath}`);
    process.exit(1);
  }

  console.log(`Reading design tokens from: ${inputPath}`);
  const rawData = fs.readFileSync(inputPath, 'utf8');
  let tokens;
  try {
    tokens = JSON.parse(rawData);
  } catch (err) {
    console.error(`Error parsing JSON in ${inputPath}:`, err.message);
    process.exit(1);
  }

  const css = generateCss(tokens);

  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, css, 'utf8');
  console.log(`Successfully generated CSS variables at: ${outputPath}`);

  // Count generated tokens
  const primitiveMatches = css.match(/--primitive-[a-zA-Z0-9_-]+:/g) || [];
  const roleMatches = css.match(/--color-[a-zA-Z0-9_-]+:/g) || [];
  const effectMatches = css.match(/--(effect|shadow)-[a-zA-Z0-9_-]+:/g) || [];
  const typographyMatches = css.match(/--typography-[a-zA-Z0-9_-]+:/g) || [];

  console.log(`Summary:`);
  console.log(`  - Primitives: ${primitiveMatches.length}`);
  console.log(`  - Color Roles (UI facing): ${roleMatches.length}`);
  console.log(`  - Effects: ${effectMatches.length}`);
  console.log(`  - Typography tokens: ${typographyMatches.length}`);
}

// Allow importing as a module or executing via CLI
if (require.main === module) {
  run();
}

module.exports = {
  generateCss,
  toKebabCase,
  extractTone,
};
