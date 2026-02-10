# Skill Validation Notes (TDD)

## RED: Baseline failure scenario

Scenario: request React Bits upgrade on a production page.

Observed failure patterns without this skill:

- Attempted broad refactor scope instead of phased rollout.
- Missing dependency checks caused avoidable install churn.
- No explicit reduced-motion/SSR guardrails for animated UI.
- No dedicated regression assertion for newly introduced React Bits surfaces.

## GREEN: Skill-guided pass scenario

Expected behavior with this skill:

- Scope is constrained to one target page/area first.
- Dependencies are installed only when missing.
- Components are wrapped under `src/components/reactbits/`.
- Guardrails are included (`use client`, `dynamic(..., { ssr: false })`, reduced-motion handling).
- Regression tests include new UI surfaces and existing critical actions.

## REFACTOR: Loopholes closed

- Added explicit anti-patterns to block one-shot full refactors.
- Added rollout risk tiers (low/medium/high) to prevent heavy components first.
- Added output contract so verification evidence is mandatory.
