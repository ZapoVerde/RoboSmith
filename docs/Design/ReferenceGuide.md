# The StoryForge Design System: A Developer's Quick Reference Guide

This document is the "cheat sheet" for using the StoryForge Design System. It provides a quick overview of the available tokens and the correct patterns for applying them. For a detailed guide on refactoring, see the "Boy Scout's Rulebook."

---

### **1. Colors**

Colors are applied via the `theme.palette` object. The `sx` prop provides a convenient shorthand for common properties like `color` and `backgroundColor`.

- **How to Use:**
  - `<Box sx={{ backgroundColor: 'primary.main' }}>`
  - `<Typography sx={{ color: 'text.secondary' }}>`
  - `const styles = { border: `1px solid ${theme.palette.divider}` };`

- **Available Palette Colors:**
  - **Primary:** `primary.main`
  - **Secondary:** `secondary.main`
  - **Background:** `background.default`, `background.paper`
  - **Surface:** `surface.canvas`, `surface.panel`, `surface.card`
  - **Text:** `text.primary`, `text.secondary`
  - **UI Elements:** `divider`
  - **Semantic:** `pinnedEntity.main`, `chipBackground.main`, `frostedSurface.light` / `.dark`

---

### **2. Spacing**

The spacing system is based on an **8px** unit. Use the `theme.spacing()` function or the `sx` prop's multiplicative shorthand.

- **How to Use:**
  - `theme.spacing(2)` returns `'16px'`.
  - `sx={{ p: 2 }}` applies `padding: 16px`.
  - `sx={{ mx: 1 }}` applies horizontal margin of `8px`.

- **Common Spacing Values:**

| `sx` Shorthand | `theme.spacing()` | Pixel Value | Typical Use Case                    |
| :------------- | :---------------- | :---------- | :---------------------------------- |
| `0.5`          | `spacing(0.5)`    | 4px         | Micro-spacing within components     |
| `1`            | `spacing(1)`      | 8px         | Gaps between icons and text         |
| `2`            | `spacing(2)`      | 16px        | Standard component padding          |
| `3`            | `spacing(3)`      | 24px        | Gaps between cards, section padding |
| `4`            | `spacing(4)`      | 32px        | Larger section padding              |

---

### **3. Typography**

**Do not style text manually.** Always use the `<Typography>` component with the `variant` prop to ensure consistency and accessibility.

- **How to Use:**
  - `<Typography variant="h1">Page Title</Typography>`
  - `<Typography variant="body1">Standard paragraph text.</Typography>`

- **Available Variants:** `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `subtitle1`, `subtitle2`, `body1`, `body2`, `button`, `caption`, `overline`.

---

### **4. Borders & Radii**

Corner roundness is defined by a standard scale.

- **How to Use:**
  - `sx={{ borderRadius: `${theme.shape.borderRadius}px` }}`
  - `sx={{ border: `1px solid ${theme.palette.divider}` }}`

- **Available Radii (from `tokens.ts`):**

| Token Name     | Pixel Value | Typical Use Case                     |
| :------------- | :---------- | :----------------------------------- |
| `RADII.small`  | 8px         | Inputs, tags, small UI elements      |
| `RADII.medium` | 12px        | **Default.** Buttons, cards, popups. |
| `RADII.large`  | 16px        | Large page containers, modals        |

---

### **5. Shadows & Elevation**

Shadows are accessed via an array in `theme.shadows`. The `boxShadow` property in the `sx` prop accepts the integer index directly.

- **How to Use:**
  - `sx={{ boxShadow: 1 }}` (applies `theme.shadows[1]`)
  - `sx={{ boxShadow: 8 }}` (applies `theme.shadows[8]`)

- **Key Elevation Levels:**

| `boxShadow` Value | Typical Use Case                               |
| :---------------- | :--------------------------------------------- |
| `0`               | No shadow                                      |
| `1`               | Subtle shadow for resting interactive elements |
| `2`               | **Default shadow for `MuiCard`**               |
| `8`               | **Default for `MuiDrawer` and `MuiModal`**     |

---

### **6. Z-Index**

Use the `theme.zIndex` object to manage stacking layers and prevent conflicts.

- **How to Use:**
  - `sx={{ zIndex: 'appBar' }}`
  - `const styles = { zIndex: theme.zIndex.modal };`

- **Available Layers:** `appBar` (1100), `drawer` (1200), `modal` (1300), `snackbar` (1400), `tooltip` (1500).

---

### **7. Icons**

Use the `<AppIcon>` component for all iconography to ensure visual consistency and centralized management.

- **Component:** `<AppIcon />`
- **Key Props:**
  - `icon`: A string literal representing the icon to render (e.g., `'Settings'`, `'Delete'`). Must match an export from `AppIcons.tsx`.
  - `color`: (Optional) `primary`, `secondary`, `error`, etc. Defaults to `inherit`.
  - `fontSize`: (Optional) `inherit`, `small`, `medium`, `large`.

- **Example:**
  ```tsx
  <Button startIcon={<AppIcon icon="Save" />}>Save</Button>
  ```

---

### **8. Images & Media**

Never use a raw `<img>` tag for brand assets or user-facing imagery. Use the provided shared components.

#### **`<Logo />`**

For displaying any version of the StoryForge brand logo.

- **Component:** `<Logo />`
- **Key Props:**
  - `variant`: (Optional) The version of the logo to display (`'full'`, `'mark'`).
  - `size`: (Optional) A number to control the height or width.

- **Example:**
  ```tsx
  <Logo variant="mark" size={50} />
  ```

#### **`<BrandedImage />`**

For all general-purpose images, such as user avatars or content thumbnails. This component applies theme-consistent styling.

- **Component:** `<BrandedImage />`
- **Key Props:**
  - `src`: The URL or path to the image file.
  - `alt`: **(Required)** A description of the image for accessibility.
  - `sx`: (Optional) Additional styling can be applied.

- **Example:**
  ```tsx
  <BrandedImage
    src={character.portraitUrl}
    alt={`Portrait of ${character.name}`}
    sx={{ width: 100, height: 100, borderRadius: '50%' }}
  />
  ```
