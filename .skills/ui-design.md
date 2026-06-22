---
name: ui-design
description: Design system rules and guidelines for UI development. Use this to ensure consistent aesthetics, Tailwind usage, and responsive layouts.
---

# /ui-design - UI/UX Design Guidelines

## Philosophy
Every pixel has a purpose. Avoid generic templates and overused defaults. 
Ensure the design has a "Wow Factor", feels premium, and prioritizes user psychology (Fitts's Law, Hick's Law, etc.).

## Core Principles

### 1. Spacing & Layout (8-Point Grid)
Use Tailwind spacing utilities based on multiples of 8:
- Tight: `gap-1` (4px), `p-2` (8px)
- Medium: `gap-4` (16px), `p-6` (24px)
- Large: `gap-8` (32px), `py-12` (48px)
Always ensure consistent padding within cards and adequate whitespace around elements.

### 2. Colors & Contrast (60-30-10 Rule)
- **60% Primary/Background**: Neutral, calm base (e.g., `bg-slate-50`, `bg-white`)
- **30% Secondary**: Supporting areas (e.g., `bg-slate-100`, `text-slate-600`)
- **10% Accent**: Call-to-actions, highlights (e.g., `bg-blue-600`, `text-blue-500`)
Avoid aggressive colors unless necessary for destructive actions (`red-600`).

### 3. Typography Hierarchy
Ensure strong contrast between headings and body text.
- Use `font-semibold` or `font-bold` for headings.
- Use `text-sm` or `text-xs` for meta-information.
- Line height: use `leading-relaxed` for reading paragraphs, `leading-tight` for headings.

### 4. Interactive Elements & Affordance
- **Buttons**: Must have hover states (`hover:bg-blue-700`) and active states.
- **Inputs**: Consistent borders (`border-slate-200`), focus rings (`focus:ring-2 focus:ring-blue-500`).
- **Transitions**: Apply `transition-all duration-200` to interactive elements to make them feel smooth and responsive.

### 5. What to AVOID (Anti-patterns)
- ❌ Hardcoded colors outside of Tailwind config/classes.
- ❌ Inconsistent border radiuses (mixing `rounded-sm` with `rounded-3xl` randomly).
- ❌ Dark text on dark backgrounds or light text on light backgrounds (Accessibility failure).
- ❌ "Bento box" grids when a simple list or table is more appropriate.
