---
name: react-bits-next-integrator
description: Use when integrating React Bits into an existing Next.js App Router project and you need dependency-aware installs, client/SSR guardrails, phased rollout, and regression-safe adoption.
---

# React Bits Next Integrator

## Overview

Integrate React Bits into a production Next.js codebase without destabilizing core flows.

Core principle: **phase first, verify always**.

- Do not rewrite the whole UI in one pass.
- Install only missing dependencies.
- Prefer TS+CSS variants before Tailwind variants.
- Add reduced-motion and lazy-loading guardrails for animation-heavy components.

## When to Use

Use this skill when all of these are true:

- The app already exists (not greenfield).
- You want React Bits visual upgrades.
- You must protect critical business paths (forms, exports, payments, etc.).
- You need an approach the team can repeat across pages.

Do not use this skill for a one-off static demo prototype.

## Inputs

- Target route(s) and priority order.
- Existing stack (`Next.js` version, Router mode, styling strategy).
- Current test command(s).
- Performance constraints (mobile, desktop shell, low-power machines).

## Output Contract

Produce:

1. A scoped integration change (one page or one section).
2. Dependency changes (missing-only installs).
3. Regression tests for touched paths.
4. Verification evidence (diagnostics and tests).

## Integration Workflow

### 1) Pick rollout scope

- Start with non-critical UI zones.
- Do not modify core business logic and visual overhaul in the same step.

### 2) Dependency-aware install

- Inspect `dependencies` + `devDependencies` first.
- Install only missing packages.
- Avoid blanket installs from unrelated components.

Example command pattern:

```bash
node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));const all={...(pkg.dependencies||{}),...(pkg.devDependencies||{})};const required=['motion'];const missing=required.filter(x=>!all[x]);if(missing.length){require('child_process').execSync('npm install '+missing.join(' '),{stdio:'inherit'});}"
```

### 3) Component intake strategy

- Prefer manual copy/adaptation for existing projects.
- Keep React Bits components under `src/components/reactbits/`.
- Export through a local `index.ts` to keep import paths stable.

### 4) Next.js guardrails

- Mark interactive components as `"use client"`.
- For medium/heavy animation components, use `dynamic(..., { ssr: false })`.
- Add reduced-motion fallback (`useReducedMotion` or CSS media query).

### 5) Regression coverage

- Add or update tests that cover user-visible outcomes.
- Verify existing critical actions still work (e.g. submit/export/generate button states).

### 6) Verification

- Run diagnostics on changed files.
- Run focused tests first, then full touched suite.
- Report pre-existing failures separately from newly introduced issues.

## Risk Tiers

- **Low risk**: text accents, lightweight motion wrappers.
- **Medium risk**: animated badges/cards with extra runtime logic.
- **High risk**: WebGL/Three.js backgrounds, cursor trails, continuous GPU effects.

Rollout order must be low -> medium -> high.

## Anti-Patterns

- Full-page refactor plus feature changes in a single PR.
- Installing all dependencies from multiple React Bits components at once.
- Shipping animation without reduced-motion fallback.
- Adding heavy client effects to server-rendered critical paths without lazy guardrails.

## Completion Checklist

- Missing-only dependencies installed.
- New components isolated under `src/components/reactbits/`.
- Reduced-motion + SSR/lazy safeguards applied where needed.
- Regression tests updated and passing.
- Diagnostics reviewed for changed files.
