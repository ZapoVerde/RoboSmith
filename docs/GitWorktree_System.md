# Git Worktree Management in RoboSmith Extension

## Overview

RoboSmith leverages Git worktrees as a foundational architectural component to provide isolated, parallel development sandboxes for AI-assisted code generation and validation workflows. By assigning **one dedicated worktree per extension tab**, RoboSmith enables users to run multiple independent AI chains (e.g., feature toggles, refactors, or prototypes) without risking cross-contamination or state corruption. This approach aligns with the extension's core philosophy of safety, determinism, and hobbyist-friendly automation: Each tab acts as a self-contained "universe" where the AI forges code, tests, and documentation in isolation.

Worktrees are Git's native mechanism for checking out multiple branches or commits into separate working directories from a single repository. In RoboSmith, this manifests as:

- A shared `.git` core repository (for history and objects).
- Per-tab directories under `.worktrees/` (e.g., `.worktrees/tab-feature-toggle-uuid`), each representing an isolated checkout.

This setup ensures **zero file overlap by default**, enforced through proactive checks and graceful queuing. It supports the extension's pushbutton app-building ethos—spin up a tab for a clear spec, let the chain hum, validate, and promote—while mitigating Git's inherent fragility in programmatic contexts. To simplify enforcement and reduce complexity, RoboSmith uses a binary flagging system: **Green (clear)** or **Amber (overlap detected)**. No red flags are permitted; any potential high-risk overlap (e.g., change plan conflicts) is treated as amber and triggers a wait queue. This ensures only pure, low-friction ambers (contextual references) proceed immediately, while amber-red scenarios (change plan overlaps) wait for resolution.

For queue orchestration, RoboSmith defaults to a **First-In-First-Out (FIFO)** resolution model: The tab that initiated its chain earliest advances first. This preserves assumptions made by early starters (e.g., a conflicting file's baseline state remains unchanged during their execution), promoting determinism and reducing mid-process invalidations. Users can optionally override with numeric priorities (1 = highest) for flexibility; if none set, FIFO rules. This balances simplicity with control, ensuring later tabs adapt to committed realities without disrupting pioneers.

The Roberto-MCP (R-MCP) slicer serves as the core "conflict detector," mapping the "change plan" directly to its **seed files** input. This creates a brutally simple distinction: Seed files = modification targets (high-risk if overlapping); hopped files = contextual references (low-risk).

**To avoid UI overload, signals are decoupled into independent systems** (detailed in Section 1.1 below), ensuring each concern (health, overlaps, queues) has its own glanceable element without shared semantics.

## How It Operates

### 1. Initialization and Tab Creation

- **Trigger**: When a user opens a new tab in the RoboSmith sidebar (e.g., via "New Chain" command palette entry), the extension invokes the `GitWorktreeManager` service.
- **Process**:
  1. Generate a unique UUID for the tab (e.g., `tab-turn-history-toggle-abc123`).
  2. Prompt for optional priority (1-10 scale; default: none/FIFO).
  3. Timestamp the chain initiation (stored in tab metadata via VS Code's globalState).
  4. Execute `git worktree add .worktrees/{uuid} {base-branch}` (default: `main` or `dev`), creating a fresh checkout.
  5. Snapshot the baseline file list via `git ls-tree -r --name-only HEAD` for overlap auditing.
  6. Open the worktree directory in a VS Code workspace folder linked to the tab (via `vscode.workspace.openTextDocument` for seamless editing/preview).
- **UI Feedback**: **The tab header renders a horizontal row of independent elements for modularity (no single overloaded stoplight):**
  - **Health System**: 🟢/🟡/🔴 stoplight for worktree integrity (e.g., 🟢 healthy, 🔴 locked/orphan).
  - **Overlap Label**: Text badge with "Clear", "Context Overlap", or "Clash" (e.g., "Clear" for no seed hits, "Clash" for amber-red).
  - **Queue Label**: ⏳/▶️/✅ icons for FIFO flow (⏳ queued, ▶️ advancing, ✅ resolved).
  - **Orchestration Tag** (text): "FIFO #2" or "P:1" for quick sorting.
    **Tooltips provide depth (e.g., "Clash: src/TurnHistory.tsx seed conflict").**
- **Context Integration**: The Roberto-MCP (R-MCP) context grabber initializes an index for this tree, slicing ASTs and symbols for sub-100k token feeds into the AI chain.

#### **1.1. Independent UI Systems (New Subsection)**

**To resolve signal overload, RoboSmith uses decoupled systems—each owns its data/logic, rendering as distinct elements in the tab header or webview sidebar. This ensures scannability without ambiguity (e.g., "Clash" label ≠ health issue).**

| System            | Element                                            | Data Source                                                        | States & Triggers                                                                            | Rationale                                                                  |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Health**        | 🟢/🟡/🔴 stoplight                                 | `GitWorktreeManager` pings (`git status --porcelain`, lock checks) | 🟢: Clean/no errors; 🟡: Warnings (e.g., uncommitted); 🔴: Fatal (e.g., corrupt/locked).     | Pure integrity—ignores overlaps/queues for focused "sandbox safe?" signal. |
| **Overlap**       | Text label ("Clear" / "Context Overlap" / "Clash") | R-MCP seed intersection (array filter on `ChangePlan` lists)       | "Clear": No seed hits; "Context Overlap": Amber-amber hop; "Clash": Amber-red seed conflict. | Label-based for precision—flags proactive risks without icon mixing.       |
| **Queue**         | ⏳/▶️/✅ icons                                     | FIFO timestamps + poll (`git log`)                                 | ⏳: Stalled (clash); ▶️: Leader advancing; ✅: Resolved/commit detected.                     | Icon-only for flow—decouples wait dynamics from static checks/labels.      |
| **Orchestration** | Text (e.g., "FIFO #2")                             | Tab metadata (timestamps/priorities)                               | Dynamic label: Updates on sort; hidden if solo tab.                                          | Non-visual tag for hierarchy—avoids element fatigue.                       |

**Rendering**: Use VS Code `ThemeIcon` for icons + `StatusBarItem` for labels/stoplight row. In multi-tab views, collapse to a summary panel. **Extensibility**: Easy to add (e.g., future "Test Coverage" label) without retrofitting.

### 2. No-Overlap Enforcement and Flagging

To prevent "blast radius" issues (e.g., one tab's refactor mutating a file needed by another), RoboSmith enforces strict isolation via the slicer as the "conflict detector":

- **Proactive Scan**: On chain initiation (e.g., "Start Blueprint" button), the `GitWorktreeManager` performs the following against _every other active tab_:
  1. **Compile New Tab Change Plan**: Scrape the `Blueprint` artifact to build `NewTab_ChangePlan`—a list of all files to create or modify (this becomes the slicer's **seed files** input).
  2. **Retrieve Other Tab Change Plan**: Pull `OtherTab_ChangePlan` from the in-memory manifest (pre-compiled seed list for that tab).
  3. **Critical Check (Amber-Red Detector)**: Perform a simple array intersection:
     ```typescript
     const intersection = NewTab_ChangePlan.filter((file) => OtherTab_ChangePlan.includes(file));
     if (intersection.length > 0) {
       // Amber-Red: Direct modification conflict—trigger wait queue.
       return 'AMBER_RED_CONFLICT';
     }
     ```
     This is fast, cheap, and 100% reliable—no AST diffs or intent analysis needed.
  4. **Context Slicing**: For the new tab's chain, the `ContextSlicerService` runs R-MCP with `NewTab_ChangePlan` as **seed** and `hops=2` (configurable default). Hopped files (dependencies traversed beyond seeds) are contextual references—**amber-amber by definition** (read-only, low-risk).
- **Flagging Tiers** (Visualized in the **Overlap Label** and Tab's Webview Sidebar):
  | Flag | Description | Trigger Example | UI Cue |
  |------|-------------|-----------------|--------|
  | **🟢 Green (Clear)** | No seed intersections; proceed freely. | `NewTab_ChangePlan` has no overlaps with other plans (e.g., new `src/features/toggle.tsx`). | "Clear"; "Ready to Forge" badge. |
  | **🟡 Amber (Overlap Detected)** | Seed intersection (amber-red: high-risk modification) or implicit hopped context (amber-amber: low-risk reference). | - Amber-Red: `src/components/TurnHistory.tsx` in both plans.<br>- Amber-Amber: Slicer hops pull `src/stores/game.ts` for AST context (not in seed). | "Clash" (seed) or "Context Overlap" (hop); tooltip: "Overlap with Tab 'Auth'—[seed/change plan | hop/context]. Wait if clash." |

- **Resolution Paths**:
  - **Green**: Chain proceeds unimpeded. **Overlap Label: "Clear".**
  - **Amber-Amber (Hopped Context)**: Chain proceeds with a soft warning—stable by guarantee (no active seed conflicts). No shadow copy needed; the amber-red check ensures no mid-run mutations. **Overlap Label: "Context Overlap".**
  - **Amber-Red/Red-Red (Seed Intersection/Clash)**: Trigger auto-resolution based on clash position (wave/turn metadata). **Watch for Unexpected Expansions**: Mid-wave sentinel re-slices hops=3 on deltas; if ripple adds files/deps (+ to seed box), re-intersect full plans. If amber-red/red-red clash: Apply scenarios below. Soft log to output channel: "Expansion/Clash auto-resolved: [details, e.g., Tab A led, +2 files merged]. No debt." (Config: `clash.autoResolve: true`—toggle human flag for edges like +5 files.)

| Scenario                                                           | Description (Incl. Expansion Handling)                                                                     | Auto-Flow & Leader Pick (Least Rework by Waves)                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Both Past Clash** (e.g., Tabs A/B both Wave 4+ on expanded seed) | Expansion retroactively clashes completed waves (e.g., ripple +types.ts hits prior deltas).                | 1. Score rework: Tab with more waves done = leader (e.g., Tab A: 4 waves > Tab B: 2 waves).<br>2. Advance leader to finish/commit.<br>3. Rewind lagger to pre-clash wave (prune deltas, reload baseline slices; adapt expansion if minor).<br>4. Inject "[leader_merge.json: Updated slices]" to lagger on unlock. Log: "Both-past clash: A led (4 waves), B rewound to Wave 2 (+1 expansion file)." |
| **One Past, One Pre** (e.g., Tab A Wave 5 done, Tab B Wave 1)      | Expansion clashes one completed (past) vs. pending (pre) wave (e.g., ripple in lagger hits leader's deps). | Deterministic: Advance past tab (leader by default) to finish.<br>On commit: Re-intersect (clean), inject merge refs + expansion adaptations to pre-tab.<br>Unlock: Resume pre-tab with auto-adapt ("Merged updates + ripple injected"). Log: "One-sided clash: Past tab led, pre-tab adapted (+1 expansion file)."                                                                                  |
| **Neither Reached** (e.g., Both pre-Wave 3)                        | Expansion clashes pending waves (e.g., ripple +auth.ts in both plans).                                     | Deterministic FIFO: Earliest tab leads to clash, queues other.<br>On leader commit: Unlock lagger with refs + expansion merge. Log: "Pre-clash race: FIFO leader resolved (+2 expansion files)."                                                                                                                                                                                                     |

**Emergency Stop**: Only on rework tie + expansion >threshold (e.g., +5 files, config: `clash.emergencyThreshold: 5`)—then optional human flag ("Tiebreaker? [Pick Leader | Manual]"). Otherwise, auto-boom. Ties broken by FIFO.

---

### 3. Commit-Wait Queuing for Conflicts

For detected overlaps (amber flags, with amber-reds always queuing and amber-ambers never queuing), RoboSmith implements a non-blocking "commit checkpoint" to resolve without halting the user's vision. FIFO (earliest start time) governs advancement by default, preserving early assumptions:

- **Trigger**: Overlap scan flags an amber-red during chain init (seed intersection only; amber-amber proceeds). **Queue Label flips to ⏳.**
- **Process**:
  1. Identify conflicting tabs and sort by resolution order: FIFO (earliest initiation timestamp) advances first. If priorities set, they override (higher priority = lower number, e.g., 1 > 5; ties fall to FIFO).
  2. Advance the leader (FIFO/priority highest): Enable its chain, stall others. **Leader's Queue Label: ▶️.**
  3. Poll stalled tabs every 30-60 seconds via `git log --oneline -1 {conflicting-branch}` (or post-commit hook if enabled).
  4. On commit in a stalled tab: Re-scan seed intersections, re-sort (FIFO/priority), and advance the next eligible (e.g., refresh R-MCP slices with updated baseline—later tabs adapt to committed changes, avoiding invalid assumptions). **Advancing Label: ▶️ → ✅.**
  5. Timeout: After ~45 minutes (configurable), escalate to a manual prompt: "Stalled—force proceed (acknowledge debt) or prune conflicting tab?" **Health System may shift to 🟡 if prolonged.**
- **Expected Duration**: 10-30 minutes typical (AI chain velocity + validation iterations); aligns with hobbyist "grab coffee" pacing, not hour-long blocks.
- **UI Feedback**:
  - **Queue Label spinner** in stalled tabs: "Queued behind Tab 'Auth Refactor' (FIFO #1) (~15 min ETA)."
  - "Queue Dashboard" optional panel: Lists stalled tabs sorted by FIFO/priority, conflicting files (with intent: "Seed/Change Plan"), and one-click "Peek" to switch/screenshot the blocker. Highlights current leader: "Advancing: Tab Y (FIFO #2)".
  - Notifications: Subtle status bar toast on advancement: "FIFO resolved—your turn advancing." **Queue Label updates in real-time.**

### 4. Execution and Iteration Within the Worktree

- **AI Chain Runtime**: With isolation locked, the chain (Blueprint → Workcard → Code Gen → Validation) operates fully within the tab's tree:
  - Code/docs/tests generated via contracts, injected precisely (scrape-update-feed loop).
  - Manual mode bypasses for pair-programming: Descriptive plans/sniff tests stay non-code (e.g., "Approve this toggle approach?").
  - Risk-based reviews: Low-stakes (2-3 files) auto-iterate on lint/type errors; tricky refactors route to a second chat with the Validation Contract. **Health System may flicker 🟡 during lint runs.**
- **Health Monitoring**: Continuous pings via `GitWorktreeManager` (e.g., `git status --porcelain`); amber flags (e.g., uncommitted changes blocking prune) surface as inline warnings **in the Health System**.

### 5. Promotion and Cleanup

- **Promotion (Merge/Ship)**: On validation approval, trigger `Promote Tab`:
  1. Final seed intersection audit across trees. **Overlap Label: Final "Clear" check.**
  2. Squash commits (`git merge --squash`), push PR/branch.
  3. User-only commit gate: No auto-commits—your "only the user commits" rule preserved.
- **Cleanup**:
  - Auto: On tab close, prompt "Prune worktree?" → `git worktree remove {path}` + dir rm. **Health System: 🔴 if prune fails.**
  - Manual: `roboSmith.cleanupWorktrees` command scans `.worktrees/`, orphans vs. active sessions, and bulk-prunes with confirmations.
  - Zombie Sweep: Cron-like (every 2h) for stalled/uncommitted trees >24h old. **Triggers Health System 🟡 across affected tabs.**

## Tradeoffs

| Aspect          | Benefits                                                                                                                           | Drawbacks                                                                                 | Mitigation                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Isolation**   | True parallelism; slicer seeds ensure stable contexts.                                                                             | Increased Git ops (add/remove per tab).                                                   | Transactional execa wraps; sparse-checkout for lean trees.                 |
| **Performance** | Fast inits (~O(1)); array intersections are O(n).                                                                                  | Disk/RAM bloat on 10+ tabs (e.g., 1GB+ for large repos); **minor label render overhead.** | Cleanup hooks; VM resource tuning (Proxmox ballooning); lazy updates.      |
| **Workflow**    | Visual sandboxes match "one feature per tab"; FIFO preserves early assumptions for determinism; **labels/icons reduce scan time.** | Wait queues add ~10-30 min friction on seed overlaps.                                     | Polling efficiency; dashboard for multi-tab oversight; priority overrides. |
| **Complexity**  | Simplified flags/seeds feel secure/simple—no intent analysis or shadow copies; **independent systems prevent overload.**           | Edge cases (e.g., submodules unsupported).                                                | Fallbacks (shallow clones); config whitelists for globals.                 |

## Mitigations and Best Practices

- **Error Handling**: All Git commands via `execa` in try/catch; transform failures to user-friendly messages (e.g., "Worktree locked—retry in 1 min"). **Route to Health System 🔴.**
- **Configurability**: `settings.json` toggles: `worktrees.autoWait: true`, `slicerHops: 2`, `overlapThreshold: 1` (files before amber), `queueMode: 'fifo'` (default; or 'priority'), **`ui.showOrchestration: true`** (toggle tags).
- **Testing**: Unit tests mock `simple-git` for seed intersections; E2E via VS Code's integration suite on sample repos; **UI smoke tests for system independence.**
- **Scalability Note**: Optimized for 3-10 tabs (hobby sprints); for larger, consider session-based pooling **with collapsible summaries**.

This system transforms Git worktrees from a "pro-only" tool into an accessible safety net, empowering non-coders to direct complex builds with confidence. For implementation details, see `src/services/GitWorktreeManager.ts`.
