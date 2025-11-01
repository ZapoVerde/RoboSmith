# **The Zero-Taste Accessibility Standard**

**Document-Type:** Engineering Process Standard

### **1. Authority & Philosophy**

This document is the single source of truth for ensuring the application is usable by the widest possible audience. It is a non-negotiable layer applied on top of the **Zero-Taste Layout Standard**. If a choice must be made between a visual aesthetic and an accessible implementation, **accessibility wins**.

### **2. The Hierarchy of Accessibility Rules**

---

#### **Rule 1: The Rule of Semantic Landmarks**

- **The Law:** All content **MUST** be organized into semantic HTML5 landmark elements or have the equivalent ARIA roles. Generic `<div>`s are for decoration; landmarks are for meaning.
- **The Mandate:**
  - The main content of any screen **MUST** be wrapped in a `<main>` tag.
  - The primary site navigation (if one exists) **MUST** be wrapped in a `<nav>` tag.
  - The site header **MUST** be wrapped in a `<header>` tag.
  - When using MUI components like `<Box>`, the `component` prop **MUST** be used to render the correct semantic element.
- **The Justification:** This provides the "chapter titles" for screen readers, allowing users to instantly jump to the main content or navigation, which is the single most important accessibility feature for page navigation.

- **Correct Pattern:**
  ```tsx
  // Combine the Layout Standard with the Accessibility Standard
  <MainLayout>
    <Box component="main">
      {' '}
      {/* Renders a <main> tag instead of a <div> */}
      {/* All your screen's content, grids, and stacks go here */}
    </Box>
  </MainLayout>
  ```

---

#### **Rule 2: The Rule of Universal Labeling**

- **The Law:** Every interactive element (`<button>`, `<a>`, `<input>`) **MUST** have an accessible text label. There are no exceptions.
- **The Mandate:**
  - If an element has visible text (e.g., `<Button>Save Changes</Button>`), the rule is satisfied.
  - If an element is icon-only (e.g., `<IconButton />`), it **MUST** have an `aria-label` prop that describes its function (e.g., `aria-label="Account settings"`).
  - Every form input (`<TextField />`) **MUST** have a corresponding `<label>`.
- **The Justification:** This ensures that screen reader users know the function of every single control on the page. An unlabeled button is a dead end.

---

#### **Rule 3: The Rule of Legible Contrast**

- **The Law:** All text **MUST** meet the WCAG AA minimum contrast ratio (4.5:1 for normal text, 3:1 for large text).
- **The Mandate:** Before committing code, the developer **MUST** use a browser-based color contrast checker tool to verify that all text/background color combinations in their new UI meet the standard.
- **The Justification:** This guarantees the application is usable for people with common visual impairments like low vision or color blindness.

---

#### **Rule 4: The Rule of Visible Focus**

- **The Law:** Every interactive element **MUST** have a clearly visible focus indicator when a user navigates to it via the keyboard.
- **The Mandate:** The default browser/MUI focus outline is sufficient. You are **forbidden** from writing CSS that removes this outline (e.g., `outline: none;`).
- **The Justification:** The focus ring is the only way keyboard-only users know "where they are" on the page. Removing it makes the site completely unusable for them.

By adopting this companion standard, you ensure that accessibility is not an afterthought. It becomes a parallel, systematic process that integrates perfectly with your layout system, leaving nothing to chance or "good intentions."
