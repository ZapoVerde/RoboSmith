# Design Rulebook: A Refactoring Guide

This guide is for when you are working on an existing component and need to align its styling and asset usage with the StoryForge Design System. Your goal is to leave the code cleaner and more consistent than you found it.

---

### **Rule 1: The Golden Rule - No Hardcoded or Unmanaged Assets**

The first step is to identify any hardcoded styling values or non-standard asset implementations. These "magic numbers" and one-off imports are the primary sources of inconsistency and must be eliminated.

> #### **Forbidden Patterns:**
>
> ```tsx
> // Hardcoded styling
> <Box sx={{ padding: '16px', backgroundColor: '#A84300', borderRadius: '12px' }}>
> <Typography style={{ fontSize: '14px', color: '#555555' }}>
>
> // Direct image tag
> <img src="/logo.svg" style={{ width: '150px' }} />
>
> // Direct icon library import
> import { Settings } from '@mui/icons-material';
> const MyComponent = () => <Settings color="primary" />;
> ```

Your mission is to replace all of the above with references to the central `theme` object and the designated shared components.

---

### **Rule 2: The "Hunt and Replace" Tactic**

Inject the theme object where needed using the `useTheme` hook: `const theme = useTheme();`. Then, replace hardcoded implementations according to the following patterns.

#### **Styling with the `theme` Object**

- **For Colors:** Use the `palette`. The `sx` prop provides a convenient string shorthand.
  - `backgroundColor: '#A84300'` becomes `sx={{ backgroundColor: 'primary.main' }}`
  - `color: '#555555'` becomes `sx={{ color: 'text.secondary' }}`

- **For Spacing:** Use the theme's 8px-based spacing unit. The `sx` prop simplifies this.
  - `padding: '16px'` becomes `sx={{ p: 2 }}`
  - `margin: '8px 16px'` becomes `sx={{ m: 1, mx: 2 }}`

- **For Borders & Radii:** Use the `shape` object and `palette`.
  - `borderRadius: '12px'` becomes `sx={{ borderRadius: `${theme.shape.borderRadius}px` }}`
  - `border: '1px solid #E0E0E0'` becomes `sx={{ border: `1px solid ${theme.palette.divider}` }}`

- **For Shadows:** Use the `shadows` array. The `sx` prop accepts the integer index directly.
  - `boxShadow: '0 2px 4px rgba(0,0,0,0.14)'` becomes `sx={{ boxShadow: 2 }}`

- **For Typography:** **Do not style text manually.** Use the `<Typography>` component with the `variant` prop.
  - `<p style={{ fontSize: '1rem' }}>` becomes `<Typography variant="body1">`

#### **Asset Management with Shared Components**

- **For Icons:** Use the central `<AppIcon>` component.
  - **Forbidden:** Importing an icon directly from `@mui/icons-material` or another library.
  - **Correct:**
    1.  Ensure the icon is exported from `src/shared/components/icons/AppIcons.tsx`.
    2.  Use the `<AppIcon>` component.
    ```tsx
    import { AppIcon } from '@/shared/components/icons/AppIcons';
    const MyComponent = () => <AppIcon icon="Settings" color="primary" />;
    ```

- **For Images & Logos:** Use the designated branded components.
  - **Forbidden:** Using a raw `<img>` or `<svg>` tag for a brand asset.
  - **Correct (Logo):**
    ```tsx
    import { Logo } from '@/shared/components/media/Logo';
    const Header = () => <Logo variant="mark" size={40} />;
    ```
  - **Correct (General Images):**
    ```tsx
    import { BrandedImage } from '@/shared/components/media/BrandedImage';
    const UserProfile = ({ user }) => <BrandedImage src={user.avatarUrl} alt="User avatar" />;
    ```

---

### **Rule 3: The "Rule of Three" for Global Styles**

If you find yourself applying the **exact same `sx` prop** to the **same base MUI component** (e.g., `MuiCard`) in **three or more places**, it is time to make it the new default.

- **Action:** Move the style from the component's `sx` prop into the corresponding entry in `src/theme/overrides.ts`. This promotes the style to a global default, simplifying the code and ensuring consistency everywhere.

---

### **Rule 4: The "Rule of Three" for Reusable Components**

If you find yourself combining the **same group of components and styles** in **three or more places**, it is time to create a new, reusable component.

- **Action:** Encapsulate the pattern into its own component file in `src/shared/components/`. This follows the DRY (Don't Repeat Yourself) principle and is the foundation of a robust component library.

---

## Part II: Architectural Patterns

### Rule 5: The "Layout Sovereignty" Pattern

- **The Law:** The `MainLayout` component provides a **default, padded layout** for all screens. However, a feature screen **MUST** be able to declare itself "sovereign" over its layout, opting out of the default padding to create an edge-to-edge, immersive experience.

- **The Doctrine (The `useLayoutStore` Pattern):** This sovereignty is arbitrated by a single, central state store: `useLayoutStore`.
  1.  **The Store is the Arbiter:** The `useLayoutStore` is the single source of truth for all cross-cutting layout state, including `isPagePadded` and `isMobileDrawerOpen`.
  2.  **`MainLayout` is the Consumer:** The `MainLayout` component **MUST** subscribe to this store and conditionally apply its default padding based on the `isPagePadded` flag.
  3.  **Feature Screens are the Controllers:** An immersive screen (like `GameScreen`) that needs to control its own layout **MUST** use a `useEffect` hook to take and release control.

- **The Enforcement (The Hook Contract):** The `useEffect` hook in a sovereign screen **MUST** be structured to guarantee cleanup.

  ```tsx
  useEffect(() => {
    // On mount, take control.
    useLayoutStore.getState().setPagePadded(false);

    // On unmount, return control to the default state.
    return () => {
      useLayoutStore.getState().setPagePadded(true);
    };
  }, []); // Empty dependency array ensures this runs only once on mount/unmount.
  ```

- **The Justification:** This pattern is architecturally superior to alternatives like negative margins ("brittle, implicit dependencies") or prop-drilling ("violates the Anti-Prop-Drilling Rule"). It creates a clear, explicit, and maintainable system for managing application-wide layout variations.
