# RoboSmith

> An AI-powered orchestrator that automates software development by managing specialized AI agents within the VS Code editor.

## Core Philosophy

RoboSmith is designed to be a "best-in-class" implementation of a proven, human-supervised AI development workflow. It operates on the principle of **"No unnecessary context, but all the necessary context,"** aiming to eliminate friction and automate tedious tasks while keeping the human user in a strategic, supervisory role.

The system is a deterministic orchestrator, not a speculative agent. It follows a user-defined `workflows.json` manifest to execute complex tasks with precision and reliability.

## Key Features

- **Manifest-Driven Engine:** Define your entire development workflow—from coding and validation to troubleshooting—in a single, version-controllable `workflows.json` file.
- **Git Worktree Isolation:** Each task runs in its own dedicated Git worktree, providing a completely isolated sandbox for safe, parallel development without cross-contamination.
- **Programmable Context Partitioner:** A high-performance engine (`roberto-mcp`) surgically slices your codebase to provide the AI with the minimal, purpose-built context it needs, dramatically saving on token costs.
- **Resilient API Pool Manager:** Manage multiple API keys, spread the load across different models or free tiers, and automatically failover from rate-limited or depleted keys.
- **Multi-Session Workbench:** A native VS Code sidebar UI that allows for the parallel execution and management of multiple development tasks, each in its own tab.

## Project Status

**Alpha:** This project is in the early stages of development. The core architecture is being laid out, and foundational services are under construction.

## Getting Started

This project is configured to be developed within a Nix-based environment like Google's Project IDX.

1.  **Environment Setup:** The `.idx/dev.nix` file at the root of the project declaratively defines all required dependencies (Node.js, pnpm, linters, etc.). The environment will be automatically configured when the workspace is created.
2.  **Install Dependencies:** Upon first creation, the `pnpm install` command will be run automatically to install the necessary Node.js packages.

**AGPL-3.0** — Free forever.  
Copyright © 2025 Jeremy Strong
