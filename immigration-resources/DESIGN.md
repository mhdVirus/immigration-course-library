---
name: Course Resource Library
description: A French-language, multilingual library for migration-course resources.
colors:
  ink: "#102a43"
  panel: "#193c58"
  accent: "#2058d5"
  accent-dark: "#143e9d"
  accent-pale: "#e7efff"
  action-fill: "#a9c5ff"
  action-hover: "#c5d7ff"
  paper: "#f3f6f7"
  white: "#ffffff"
  line: "#cbd6dc"
  mint: "#68d3c1"
  focus: "#f1b83d"
  green: "#2a715c"
typography:
  display:
    fontFamily: "\"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "clamp(42px, 6vw, 72px)"
    fontWeight: 750
    lineHeight: 1.02
    letterSpacing: "-0.052em"
  body:
    fontFamily: "\"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "\"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "0.12em"
    lineHeight: 1.3
rounded:
  sm: "2px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    height: "42px"
  search-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "52px"
---

# Design System: Course Resource Library

## Overview

**Creative North Star: "The Civic Course Index"**

The interface treats course references as public-interest information: legible labels, clear source ownership, a calm reading field, and practical wayfinding. French is the interface language; Arabic module names and multilingual resources retain their own language and direction rather than being visually flattened into French.

The visual system is restrained and flat. A deep navy masthead and assistant panel anchor a pale neutral canvas; cobalt identifies the active reading path. Ruled rows carry the content instead of a card grid. The interface prioritizes quick scanning and explicit source attribution over decoration.

**Key Characteristics:**
- Civic navy with a single cobalt action accent.
- Compact uppercase labels and a large, tightly tracked sans-serif display.
- Flat surfaces, fine rules, and mostly square controls.
- Resource entries preserve original language and right-to-left Arabic text.

## Colors

The palette pairs a paper-like cool neutral with dark blue structural regions, cobalt navigation cues, and a pale cobalt action fill.

### Primary
- **Wayfinding Cobalt** (#2058d5): Primary links, selected emphasis, and the main action.
- **Deep Cobalt** (#143e9d): High-contrast labels and important text links.

### Secondary
- **Harbor Navy** (#102a43): Main text and masthead.
- **Atlas Blue** (#193c58): Assistant and owner-management regions.

### Neutral
- **Cool Index Paper** (#f3f6f7): Main page background.
- **White Field** (#ffffff): Inputs and reading surfaces.
- **Rule Gray** (#cbd6dc): Separators and field borders.

### Named Rules
**The Source-First Rule.** Color marks navigation and actions; it never replaces the resource title, publisher, or course module as the primary information.

## Typography

**Display Font:** Segoe UI (with Helvetica Neue, Arial, sans-serif fallbacks)

**Body Font:** Segoe UI (with Helvetica Neue, Arial, sans-serif fallbacks)
**Label/Mono Font:** No separate mono face; labels use the body family.

**Character:** A familiar system sans keeps an information-heavy library efficient and readable. The display scale provides hierarchy through size and weight rather than a second type voice.

### Hierarchy
- **Display** (750, `clamp(42px, 6vw, 72px)`, 1.02 line height, -0.052em tracking): The opening course-library statement.
- **Headline** (750, 28–36px, 1.1 line height): Section titles such as the library and assistant.
- **Title** (750, 17px, 1.35 line height): Individual resource titles.
- **Body** (400, 13–17px, 1.55 line height): Supporting copy, resource notes, and descriptions.
- **Label** (800, 11px, 1.3 line height, 0.12em tracking, uppercase): Compact section wayfinding.

### Named Rules
**The Two-Voice Rule.** Use the system sans for both display and body; establish hierarchy with scale, weight, and spacing, not decorative type contrast.

## Layout

The page uses a centered content measure capped at 1120px, with fluid side margins. Desktop places the assistant prompt beside its explanation and resource rows across title, module, detail, and source columns. Below 760px, the assistant stacks and resource rows reflow; below 520px, forms and filters become single-column. Content remains left-to-right in French while Arabic module labels and resource text declare right-to-left direction.

Spacing is built from compact 8–16px control groups and larger 24–58px section separations. Headings receive more space above than below. Thin horizontal rules separate the navigation, directory, and resource entries.

## Elevation & Depth

The interface uses no shadows. Depth comes from the contrast between the pale canvas and navy work regions, supported by fine separator rules. Focus is explicit and structural rather than simulated with a glow.

## Shapes

Controls and panels are predominantly square, with a 2px corner radius on fields and buttons. Resource entries are open rows separated by rules; avoid enclosing every entry in a rounded card. The small brand mark uses three ascending bars as a wayfinding cue.

## Components

### Buttons
- **Shape:** Nearly square, 2px corners.
- **Primary:** Pale cobalt with dark text, 9px 16px padding, and a 42px minimum height.
- **Hover / Focus:** Deepen the pale cobalt fill on hover; use the shared amber, 3px visible focus outline.
- **Secondary / Ghost:** Text-only actions in the navy region or deep cobalt on the pale canvas.

### Chips
- **Style:** Small, square-cornered topic labels with a thin blue-gray outline and dark text.
- **State:** Labels identify the Arabic course module; they do not act as the only way to filter.

### Inputs / Fields
- **Style:** White surface, one-pixel gray-blue border, 2px corners, 44–52px minimum height.
- **Focus:** 3px amber outline with a 3px offset.
- **Error / Disabled:** Errors appear as readable text in the status region; disabled primary actions retain their labels.

### Navigation
- **Style:** Compact white-on-navy masthead with a bar-mark identity and clear text links.
- **Mobile:** Maintain the masthead and allow its links to wrap without hiding owner access.

### Resource Row
- **Structure:** Title and author, Arabic module label, resource type/language/details, then an optional external source link.
- **Behavior:** Admin edit and remove actions appear only when authenticated. External links open safely in a new tab.

### Research Assistant
- **Structure:** Explanatory copy sits beside a question field on wide screens and above it on narrow screens.
- **Behavior:** Answers appear as plain text with an explicit list of retrieved course references.

## Do's and Don'ts

### Do:
- **Do** preserve the Arabic module titles exactly and set their text direction to RTL.
- **Do** identify the resource type, module, and original language before the description.
- **Do** keep AI answers paired with links to retrieved resources.
- **Do** use fine rules and tonal contrast to organize the library.

### Don't:
- **Don't** turn every reference into a card.
- **Don't** translate or rewrite resource titles without an explicit editorial decision.
- **Don't** use AI answers as legal advice or let them stand without source references.
- **Don't** expose full indexed page text or model vectors in public API responses.
