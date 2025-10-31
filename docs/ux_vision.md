### High-Level UX Vision: Look, Feel, & Flow for RoboForge

#### Core Philosophy: Director's Chair with Auto-Pilot
- **Look**: Clean, VS Code-native sidebar/webview (like a Git panel but for AI chains). Tab headers for multi-tasks (e.g., "Toggle UI Chain | Running"), with a progress bar showing nodes (icons: Blueprint 📐 → Workcard 📝 → Code Gen ⚙️ → Validate ✅). Status labels/icons (e.g., "Clear" for no issues, "Clash" for blocks) in a horizontal row—no clutter. Chat-like log below for helper decisions/outputs, with expandable refs ([file.ts] → click to peek code in editor). Dark/light theme auto-match, minimal colors (greens for go, yellows for caution).
- **Feel**: Empowering but hands-off—like directing a movie set. Planned work feels linear/auto (pushbutton start, watch it hum), adhoc shifts seamless (e.g., bug uncovers → "Sideline? [Y/N]" prompt, not jarring halts). Control via quick overrides (e.g., "Redo this step" button), with dopamine hits (notifications: "Node complete—3 files forged!"). Hobby pace: 5-10 min steps, no waiting unless clashing (then polite queues).
- **Flow Principles**: 
  - **Planned (Well-Defined)**: Linear chain—start with spec, auto-advance nodes via helper gates. Feels predictable, like a conveyor belt.
  - **Adhoc/Iterative**: Branch on bugs—helper triggers loops/sidelines, user nudges direction. Shifts smooth (e.g., "Bug found—entering adhoc mode").
  - **Hybrid**: Planned can flip adhoc mid-node (e.g., validation uncovers issue → helper keywords route to troubleshoot loop). Back to planned on resolve.

#### Flow Breakdown: Steps, Nodes, & Helper Gates
Think of the chain as a pipeline: User idea → Nodes (phases like "Plan" or "Code") → Turns (individual AI chats within nodes). Files process one-at-a-time (atomic, full-file loads + hops=2 deps), keeping focus tight.

- **Starting a Chain** (Look/Feel: Pushbutton Simplicity)
  - User: Command palette "New Chain" → Prompt: "Describe task (planned/adhoc?)" or "Load spec file."
  - System: Spins tab/worktree, compiles ChangePlan (file list). If adhoc, looser nodes (more manual gates); planned = auto-sequence.
  - Flow: Scans for clashes (full seed intersection) → Green? Proceed to first node. Clash? Queue/notify ("Waiting on Tab X—peek?").

- **Node Flow** (Group of Turns with Shared Rules)
  - **Look**: Sidebar timeline (e.g., "Node: Code Gen | File 1/5: toggle.ts | Turn 1/3").
  - **Feel**: Steady progress—node starts with secondary context load (e.g., "Loading code rules..."), then turns cycle per file.
  - **Primary Handoff**: From prior node: JSON ref/summary ("[plan.json: 5 files, UI focus]") injected as chat starter ("Build from [ref].").
  - **File Sequencing**: One file/turn group—load file + hops=2 (e.g., "toggle.ts + store.ts + types.ts"). No batches; next file auto after accept.
  - **Shift to Adhoc**: If bug/expansion, helper flags → enters iterative turns (feels like "debug mode"—more user prompts if needed).

- **Turn Flow** (Single AI Send-Receive)
  - **Look**: Chat box shows prompt → AI reply → Helper review. Refs clickable (open file in editor).
  - **Feel**: Quick exchanges—2-5 min/turn, with auto-scrape/save (code block → [file.ts ref]). Iterative if adhoc (loop on redo).
  - **Primary Context (Chat Box)**: Builds as log: "Turn 1: Generated [ref]. Review: Issues x,y. Turn 2: Fixed [delta ref]." Prune old turns (keep last 1-2 summaries).
  - **Worker Inputs**: Full target file + hops files + node rules (secondary) + project basics (permanent) + prior turn ref (primary). E.g., "Fix [toggle.ts] using [store.ts + types.ts], follow [code rules], from [last ref]."

- **Helper Bot as Gatekeeper** (Linking Turns/Nodes)
  - **Look/Feel**: Invisible most times (auto-decides), but logs visibly ("Helper: Proceed—clean!"). On issues: Pop-up/chat insert ("Redo? [Feedback: Fix x]").
  - **Logic**: After AI reply, helper reviews output (prompt: "Check [ref] vs rules—output keyword: PROCEED | REDO: [feedback] | SIDELINE: [issue] | HALT: [help needed]").
    - **PROCEED**: Auto-next turn/file/node (smooth handoff: "[ref summary]" to primary).
    - **REDO: [feedback]**: Loop turn (same file, inject feedback to primary: "Redo with: [x,y fix]").
    - **SIDELINE: [issue]**: Branch to troubleshoot node (e.g., bug → mini-node for fixes; handoff back on resolve).
    - **HALT: [help needed]**: Pause chain, user prompt ("Issue: [z]. Override? Proceed/Redo/Sideline/Manual"). Rare—only big surprises (e.g., +5-file expansion).
  - **Adhoc Shift**: On bug, helper leans REDO/SIDELINE → iterative mode (more turns, user okays gates). Back to planned: "PROCEED" unlocks linear flow.
  - **Node End**: Helper final gate ("All files OK?") → Handoff JSON ref to next node primary ("[code_node.json: 5 files done]").

**Surprise Handling (Expansions/Clashes)**: If extra deps pop up (from hops check), add to plan → re-check overlaps. If clash: Auto-resolve (pick leader by most progress, merge/unlock). Log quietly—no interrupt unless tie/big.

## Tradeoffs

| Area | Good Side | Tricky Side | How We Fix It |
|------|-----------|-------------|---------------|
| **Word Count** | One file + connections = short steps. | Extra check adds a bit once. | Short summaries; lighter AI for most. |
| **Focus** | AI thinks about one file + friends—no overload. | Might miss far connections. | Extra check + plan overlap block. |
| **Speed** | Steps = quick; info passes easily. | Rare big surprises pause a bit. | Auto-fixes; set limits. |
| **Safety** | Checks + auto-passes = smooth flow. | Quiet notes might hide small issues. | End summary: "Steps done, surprises fixed." |

## Tips and Settings
- **If Something Goes Wrong**: File pull fails? Use just the main file + note ("Short version—check manually?"). Show warning on screen.
- **Custom Options**: In settings: `connection_levels: 2` (how many friend files), `step_limit: 3` (turns per file), `surprise_limit: 5` (when to ask for help).
- **Testing**: Practice: Fake pulls for groups of steps; test surprise (+3 files) → auto-fix notes.
- **For Bigger Projects**: Good for small groups of files; for many, follow plan order.

This setup makes context feel easy—like giving the AI a quick notebook page instead of a whole book. For the code behind it, look in `src/services/ContextManager.ts`.### Refined UX: Look, Feel, & Flow for RoboForge

Let's pull this into focus—abstracting to a "director's dashboard" vibe where you steer the AI crew without micromanaging. I'll propose a cohesive look (visuals/UI), feel (control/emotion), and flow (planned vs. adhoc, with helper gates as the smart linker). This builds on your two work types (planned = structured auto-run, adhoc = flexible loops), with seamless shifts on bugs (e.g., "planned node uncovers issue → helper redirects to adhoc turns"). Helper bot as "stage manager": Reviews outputs, outputs keywords (PROCEED, REDO:[feedback], SIDELINE:[issue], HALT:[help needed]) to trigger next programmatically—user overrides if needed. No doc updates yet; just brainstorming.

#### Look: Clean, Glanceable Dashboard in VS Code
- **Core Interface**: Sidebar webview (like GitLens but for AI chains)—top: Tab strip for multi-chains ("UI Toggle | Running", "Auth Fix | Adhoc"). Middle: Progress timeline (nodes as icons: Plan 📐 → Code ⚙️ → Validate ✅, with file icons underneath for current focus). Bottom: Chat log for helper decisions/outputs (scrollable, expandable refs like "[toggle.ts] → click to open editor").
- **Visual Style**: Minimalist—dark/light auto, greens for progress, yellows for cautions (e.g., "REDO pending"). Status row per tab: Health stoplight (🟢 safe), Overlap label ("Clear" or "Clash"), Queue icon (⏳ wait). No overload—labels/icons horizontal, tooltips for depth ("Clash: File X in Tab Y").
- **Adhoc Shift Look**: On bug, timeline "branches" visually (e.g., sideline loop as a side bubble: "Troubleshoot: Issue Y"). Chat highlights keywords in bold (e.g., "Helper: REDO: Fix lint error").
- **Mobile/Remote Feel**: Via vscode.dev tunnel, looks like a web app—touch-friendly buttons for "Override Helper" or "Halt Now".

#### Feel: Empowering Director with Smart Auto-Pilot
- **Overall Vibe**: You feel like a film director—AI as actors following script (planned) or improvising under guidance (adhoc). Control is "light touch": Push start, watch auto-flow, intervene only on helper escalations (e.g., 90% PROCEED auto, 10% prompts like "REDO? [Y/N/Feedback]"). Shifts feel natural (bug → "Entering debug mode—sideline?"), not jarring. Dopamine: Notifications ("Node done—5 files forged!") + confetti on chain complete.
- **Planned Work Feel**: Predictable/satisfying—like a train on tracks. Auto-advances (helper: PROCEED → next node), minimal input (e.g., initial spec upload).
- **Adhoc/Iterative Feel**: Flexible/exploratory—like tweaking a sketch. More loops (REDO/SIDELINE triggers), with user nudges ("Add feedback: [text box]"). Bugs shift smoothly: "Issue found—helper SIDELINE: Troubleshoot loop started."
- **Control Levels**: Buttons for overrides ("Force PROCEED", "Switch to Adhoc"). Config slider: "Auto-Level" (High: Minimal prompts; Low: Gate every turn). Feels safe—halts rare, but "HALT: [details]" pings you directly (notification: "Need your call on Z").

#### Flow: Planned to Adhoc, with Helper Links
Flow as a pipeline: User idea → Nodes (phases like Plan, Code) → Turns (AI chats within nodes). Files atomic (one/turn, full + hops=2). Helper reviews every output, keywords trigger next (programmatic if/then in code). Planned = linear, adhoc = branching loops; shifts on bugs (helper flags → redirect).

- **Starting a Chain**:
  - User: Palette "New Chain" → "Type: Planned (structured) or Adhoc (flexible)?" + spec input.
  - System: Spin tab, compile ChangePlan (files). Check clashes → Green? Start first node. (Look: Timeline loads; Feel: "Chain launched—auto-pilot on.")

- **Node Flow** (Group of Turns with Shared Rules):
  - Start: Load secondary (e.g., Code node: "Coding rules loaded"). Sequence files one-by-one.
  - Per File: Run turns until helper "PROCEED" to next file/node.
  - Shift: Bug? Helper "REDO/SIDELINE" → adhoc loop (e.g., sideline = branch to troubleshoot node). "Planned mode paused—iterating on issue."

- **Turn Flow** (Single AI Chat):
  - Prompt AI (with contexts + file + hops).
  - AI replies → Scrape/save output → Helper reviews (prompt: "Assess [ref]—keyword: PROCEED | REDO:[fix notes] | SIDELINE:[bug type] | HALT:[major issue]").
  - Keyword Triggers:
    - **PROCEED**: Auto-next turn/file/node (e.g., "File done—moving on.").
    - **REDO:[feedback]**: Loop turn (same file, add feedback to primary: "Try again with: [notes]").
    - **SIDELINE:[issue]**: Branch to adhoc node (e.g., "Sideline bug X—starting troubleshoot loop.").
    - **HALT:[help needed]**: Pause + user prompt ("Halt: [details]. Proceed/Redo/Sideline/Manual?"). Rare (e.g., plan-breaking bug).
  - Adhoc Bias: In adhoc chains, helper leans REDO/SIDELINE for iteration; planned leans PROCEED.

- **Bug Shifts (Planned → Adhoc)**:
  - Trigger: Helper flags issue mid-node (e.g., validation uncovers dep bug).
  - Flow: "Shifting to adhoc—sideline loop for fix." More turns/loops until "PROCEED" back to planned (e.g., "Bug resolved—resuming node.").
  - Feel: Empowering pivot ("Take the reins? Or auto-fix?").

- **End/Transitions**: Node end: Helper final "PROCEED" → handoff JSON ref to next node. Chain complete: Summary report ("5 nodes, 12 turns, 2 shifts—view logs?").

**Config/Custom**: "Helper Strictness" (Low: More PROCEED; High: More REDO). "Adhoc Threshold" (e.g., 2 REDOs → auto-sideline).
