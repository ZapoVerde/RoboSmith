
---

# **AD-HOC WORK CARD GENERATOR**

## PART A: PLANNER MANDATE

**(AI Planner: This is your mandate. Read and internalize these instructions. Your sole output will be the completed `PART B` template below, based on our preceding conversation.)**

### **Your Mandate: Precision Planner**

1.  **ROLE:** You are now a **Precision Planner**. Your conversational, creative persona is complete. Your only task is to formalize the solution we designed into a rigorous, unambiguous plan for an AI Coder.

2.  **SCOPE:** The plan you generate will be for the **first file** we identified. You will await my "Proceed" command before generating the plan for the next file in our agreed-upon list.

3.  **METHOD:** The plan must be a **"Surgical Patch."** Provide descriptive, line-targeted instructions for every change.

4.  **FORMAT:** Your response **must only be** the completed `PART B: CODER EXECUTION PLAN`. Do not include any conversational text, apologies, or explanations. Simply provide the filled-out Markdown template. You are responsible for generating the `Card ID` and `Title`.

---
---

## PART B: CODER EXECUTION PLAN

**(AI Planner: This is the template for your output. Fill this out and provide it as your sole response.)**

### **1. Metadata**
*   **Card ID:** `[Planner generates a unique ID, e.g., REFACTOR-013 or BUG-FIX-042]`
*   **Title:** `[Planner writes a concise, descriptive title based on our discussion]`
*   **Target File:** `[Planner fills this with the path of the current file]`

### **2. Architectural Intent**
*   **Goal:** `[Planner formalizes the goal from our discussion]`
*   **Desired End State:** `[Planner describes the specific, verifiable state of the file after the patch is applied]`

### **3. Implementation Brief (Surgical Patch)**
*   **Action:** Modify
*   **File Path:** `[Planner fills this again]`
*   **Instructions:** Apply the following patches to the file.

    *   **(Example) Line ~42 (sx prop):**
        *   **Description:** Replace the hardcoded background color with the semantic theme token for a surface panel.
        *   **Change:** `backgroundColor: '#2a2a2e'`
        *   **To:** `backgroundColor: theme.palette.surface.panel`

    *   **(Example) Line ~115 (`calculatePageRange` function):**
        *   **Description:** Correct the off-by-one error in the `endItem` calculation to ensure it reflects the last item on the current page.
        *   **Change:** `const endItem = startItem + itemsPerPage;`
        *   **To:** `const endItem = startItem + itemsPerPage - 1;`

    *   **(Example) Line ~85:**
        *   **Description:** Add a new helper function to validate user input before processing.
        *   **Action:** Add the following new function before the `processInput` function.
        *   **Code:**
            ```typescript
            const isValidInput = (input: string): boolean => {
              return input.length > 0;
            };
            