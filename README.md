# Cloud Agent Prompt Engineer

A lightweight prompt-builder for Cursor Cloud Agents.

This tool helps you generate structured, high-signal prompts that are more likely to produce efficient, reliable Cloud Agent execution.

## What it does

- Generates execution-ready prompts from a guided form.
- Includes reusable templates:
  - Feature implementation
  - Bug investigation and fix
  - Refactor/perf optimization
  - PR review and hardening
- Adds constraints and tooling guidance automatically.
- Scores prompt quality (0-100) and highlights weak spots.
- Supports one-click prompt copy.

## How to use

1. Open `index.html` in a browser.
2. Pick a template closest to your task.
3. Fill in:
   - Primary objective
   - Context and references
   - Deliverables
   - Definition of done
4. Tune risk/autonomy and select constraints/tooling preferences.
5. Click **Generate optimized prompt**.
6. Review the quality analyzer and strengthen weak areas.
7. Copy the final prompt into Cursor Cloud Agent.

## Prompt quality heuristics

High-quality prompts usually include:

- A precise objective (not generic)
- Relevant repo/task context
- Specific deliverables
- Measurable acceptance criteria
- Guardrails for scope, risk, and testing
- Tooling strategy for efficient execution

## Why this improves cloud agent efficiency

- Reduces ambiguity up front, minimizing unnecessary exploration.
- Forces explicit output expectations.
- Encourages targeted tool usage and minimal diffs.
- Improves consistency across repeated task runs.