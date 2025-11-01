---

# **The Zero-Taste Layout Standard**

**Document-Type:** Engineering Process Standard

### **1. Authority & Philosophy**

This document is the **single, authoritative source of truth for all layout and composition**. It replaces subjective "taste" with a rigid, hierarchical, and component-driven system. Its purpose is to produce professional, consistent, and responsive layouts through the strict application of objective rules.

### **2. Scope & Intent**

*   **2.1 Toolchain-Specific:** This standard is intentionally and explicitly written for a **React + Material-UI** tech stack. Its rules reference specific MUI components (`<Box>`, `<Stack>`, `<Container>`) to provide unambiguous, machine-executable instructions. Portability is a non-goal.
*   **2.2 Composition, Not Decoration:** This standard governs the **arrangement and composition** of components (the "where"). It does not govern the styling of individual components (the "what," e.g., colors, font sizes, border radii), which is the responsibility of the central `theme.ts` file.

### **3. The Prime Directive: Mobile-First Design**

Every layout decision **MUST** be made for a mobile viewport first. The layout **MUST** be perfect on a narrow screen. Larger screen layouts are an *adaptation* of the mobile layout, not the other way around.

### **4. The Hierarchy of Layout Rules**

These rules are hierarchical and **MUST** be applied in order.

---

#### **Rule 1: The Rule of the Responsive Canvas**

- **The Law:** Every unique screen or page view **MUST** be the direct child of a single, central layout component (`<Container />` or a custom `<MainLayout />` wrapper).
- **The Mandate:** This component's sole responsibility is to enforce responsive, application-wide outer padding.
  - On `xs` viewports (mobile), padding **MUST** be `2` theme units (16px).
  - On `md` viewports and larger (desktop), padding **MUST** be `4` theme units (32px).
- **The Justification:** This maximizes content real estate on mobile while providing a clean, centered presentation on desktop. A single, large, static padding is **forbidden**.

#### **Rule 2: The Rule of the Stack Primitive (The Default Tool)**

- **The Law:** For any group of related components that **do not change direction** based on screen size (e.g., a form that is always vertical), the `<Stack>` component **MUST** be used.
- **The Mandate:** The `spacing` prop is the sole arbiter of the space between items and **MUST** reference the theme's spacing unit. This is the default tool for all local component grouping.
- **The Justification:** `<Stack>` is the simplest, most declarative tool for creating consistent local rhythm. It is to be preferred over `<Box>` for all simple, single-axis layouts.

#### **Rule 3: The Rule of the Responsive Scaffolding (The Power Tool)**

- **The Law:** For arranging major page regions that **do change direction** based on screen size (e.g., stacking on mobile, side-by-side on desktop), the `<Box sx={{ display: 'flex' }}>` component with the responsive object syntax **MUST** be used.
- **The Mandate:** The `flexDirection` **MUST** default to `column` and change to `row` for larger breakpoints. The `gap` property **MUST** be used for spacing.
- **The Justification:** This codifies the primary mobile-first responsive pattern. It is the designated tool for building the main structure of a page.

#### **Rule 4: The Escape Hatch (The Specialist Tool)**

- **The Law:** Only when a layout's requirements cannot be met by the rules above MAY a more specialized tool be used.
- **The Mandate:** This is a conscious deviation from the standard flow and must be justified.
  - **Case 1: Complex 2D Alignment.** For aligning items on opposite ends of a container, a non-responsive `<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>` is permitted.
  - **Case 2: True Grid-Based Content.** For content that is inherently a two-dimensional grid (e.g., a photo gallery, a dashboard of equal-sized cards), **CSS Grid** is the appropriate tool. This **MUST** be implemented via the `sx` prop (e.g., `sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 2 }}`).
- **The Justification:** Acknowledges that Flexbox is not the optimal tool for all jobs. It provides a sanctioned, systematic way to use the correct tool (CSS Grid) for specific, well-understood problems, preventing the misuse of Flexbox.

---

### **Appendix A: Handling Common Complex Patterns**

This appendix provides non-normative examples for applying the standard to common, real-world scenarios.

#### **Pattern: A Responsive Dashboard Card Grid**

This is a classic use case for the **Escape Hatch (Rule 4, Case 2)**, as it's a true two-dimensional grid of content.

- **Objective:** Display a list of cards that are stacked on mobile but form a responsive, wrapping grid on larger screens.
- **Correct Implementation:**

  ```tsx
  import { Box, Card } from '@mui/material';

  function DashboardGrid({ items }) {
    return (
      // The parent Box uses 'display: grid'
      <Box
        sx={{
          display: 'grid',
          // Define the columns. This says: "Create as many 280px columns as
          // will fit. If there's extra space, grow them until they fill the
          // container." This is an intrinsically responsive pattern.
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          // Use the theme's 'gap' for consistent gutters.
          gap: 3,
        }}
      >
        {items.map((item) => (
          <Card key={item.id}>{/* Card content goes here */}</Card>
        ))}
      </Box>
    );
  }
  ```

**(End of Standard)**
