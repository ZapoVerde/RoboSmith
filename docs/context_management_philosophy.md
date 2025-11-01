# Context Management in RoboForge Extension

## Overview

Context management in RoboForge is a simple system that gives the AI the right information at each step of building code. It keeps things short and focused so the AI can work quickly without getting overwhelmed. There are three main types of context:

- **Permanent Context**: Basic project details that stay the same for the whole process, like the project's goals or main rules. This is always included to remind the AI what the big picture is.
- **Secondary Context**: Rules or guidelines specific to a group of steps (called a node), like "how to write clean code" during a code-writing phase. This is shared across several steps but changes when you switch phases.
- **Primary Context**: The ongoing conversation notes and updates from the last step, kept in the chat box. This is short and changes with every back-and-forth (called a turn).

The system hands information between steps (turns) and groups of steps (nodes) using simple summaries and references to saved files (like "[file.ts]" instead of copying the full file). Workers (the AIs doing tasks) get a mix: The full target file, plus related files it connects to, plus the right rules for their job.

Everything focuses on whole files (no partial snippets), which makes changes easy to track and apply automatically. Files stay small—no more than 250 lines of code each. This keeps the AI fast and the information easy to handle.

This setup lets the AI focus on one small task at a time, like "update this one file and the two files it uses," without loading the whole project.

## How It Works

### 1. The Three Types of Context

Context loads at the start of each group of steps (node) and refreshes for every single step (turn). It combines the three types in this order: Permanent first (always), then secondary (if needed for the node), then primary (from the last step).

- **Permanent Context (Always Loaded)**: This is the foundation—things like the project's main description or overall design rules. It comes from text files in a "docs" folder. Only the key parts are included (short summaries). Example: "Remember the project is a game app: [short goal description]."
- **Secondary Context (Loaded for a Node)**: This is rules that fit the current group of steps. For example, during code writing, load "use clean variable names" rules. It's the same for all steps in that group but switches for the next group. Only added if it matches the task.

- **Primary Context (Chat Box Updates)**: This is the running notes from the conversation, like "last step fixed an error in [file.ts]." It's kept very short—just references to saved files and quick summaries. It changes after every step and carries over to the next one.

### 2. Pulling in File Details

For each step working on a file, the system pulls the full file plus a few directly connected ones (up to 2 levels away). No partial pieces—always whole files, but kept small.

- **When It Happens**: Before each step starts.
- **Steps**:
  1. Load the main file (its full text).
  2. Add connected files (things it uses or calls, like imported settings—full files, but only if needed).
  3. Quick check for surprises (one extra level deep)—if a new connection shows up, add it to the plan.
  4. Result: A small set of full files ready for the AI.

Files are handled one at a time, in order from the plan. The connected files make sure the AI sees just what's needed for that main file.

**On-Screen Note**: A side panel shows "Loaded: [main file + 2 connections]."

### 3. Passing Info Between Steps and Groups

Info moves forward as short notes or file references—no long copies. After each step, changes save to the project folder, and the chat just points to them.

- **Within a Step (Turn)**:
  1. **Create**: Send the AI: "Write the code for [main file + connected files] based on the plan." Reply: "Here's the code: [full file]." → Save the full file, replace in chat with "[file.ts: Short note]."
  2. **Check**: Send: "Look for problems in [saved file + connected files]." Reply: "Found issues x,y—fix them." (No save.)
  3. **Fix**: Send: "Fix x,y in [saved file + connected files]." Reply: "Updated: [full updated file]." → Save the full file, replace in chat with "[file.ts updated: Fixed x,y]."
  4. **OK Check**: "Looks good—done." Pass a short note forward: "[file_note: File done, 2 steps, no issues]."

- **From One Step to the Next (Within a Group)**: Use the short note from the last step ("[file_note]") as the starting point for the next. Keep only the last 1-2 notes to stay short.

- **From One Group to the Next (Node to Node)**: Collect notes from the group ("[code_group: 3 files updated, small changes total]"). Send to the next group: "Check these: [short summary]."

**Keeping It Short**: Save real changes as full files. Chat uses pointers like "[file.ts]" + quick notes. After each step, drop old details—keep just the new summary.

### 4. What Workers Get

Each AI worker (like the code writer or checker) gets a custom mix for its job:

| Worker Type               | What It Gets                                          | Example                                                                                                    |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Writer (Creates Code)** | Main file + connected files + plan note + code rules. | "Write for [toggle.ts + connected files] using [store connection]. Follow clean code rules: [short list]." |
| **Checker (Reviews)**     | Saved file + connected files + review rules.          | "Check [toggle.ts pointer] for errors. Use check rules: [short list]."                                     |
| **Fixer (Updates)**       | Saved file + connected files + last note + fix rules. | "Fix errors in [toggle.ts updated] + [connected files]. Last note: [quick summary]."                       |
| **OK Checker**            | All notes from the group + finish rules.              | "Is [3 file notes] ready? Use final check rules: [short list]."                                            |

Everything is full small files—no partial pieces.

## Tradeoffs

| Area           | Good Side                                       | Tricky Side                          | How We Fix It                               |
| -------------- | ----------------------------------------------- | ------------------------------------ | ------------------------------------------- |
| **Word Count** | One file + close connections = short steps.     | Extra check adds a bit once.         | Short summaries; use lighter AI for most.   |
| **Focus**      | AI thinks about one file + friends—no overload. | Might miss far connections.          | Quick extra check + plan overlap block.     |
| **Speed**      | Steps = quick; info passes easily.              | Rare big surprises pause a bit.      | Auto-fixes; set limits.                     |
| **Safety**     | Checks + auto-passes = smooth flow.             | Quiet notes might hide small issues. | End summary: "Steps done, surprises fixed." |

## Tips and Settings

- **If Something Goes Wrong**: File pull fails? Use just the main file + note ("Short version—check manually?"). Show warning on screen.
- **Custom Options**: In settings: `connection_levels: 2` (how many friend files), `step_limit: 3` (turns per file), `surprise_limit: 5` (when to ask for help).
- **Testing**: Practice: Fake pulls for groups of steps; test surprise (+3 files) → auto-fix notes.
- **For Bigger Projects**: Good for small groups of files; for many, follow plan order.

This setup makes context feel easy—like giving the AI a quick notebook page instead of a whole book. For the code behind it, look in `src/services/ContextManager.ts`.
