---

# Component & Tool Index

This document is the canonical "card catalog" of all shared, reusable UI components and utility tools available in the project. Its purpose is to provide a high-signal, low-noise reference for all developers (human and AI) to prevent the reinvention of common logic.

The standard for each entry is built on one core principle: **The code is the contract.** We do not repeat information that is already precisely defined in the code itself. Instead, we point to it and provide the essential context.

Each entry contains:

- **`@file`**: The canonical path to the source file.
- **`@purpose`**: A single, concise sentence describing the component's architectural role and _when_ it should be used.
- **`@props` / `@api`**: The component's props `interface` or the tool's public API, copied directly from the source code. This is the most precise and unambiguous signature possible.

---

## **Visual Components**

### **`<AlertDialog />`**

- **`@file`**: `packages/client/src/shared/components/dialogs/AlertDialog.tsx`
- **`@purpose`**: Use this globally accessible alert dialog to display a simple message to the user with an "OK" button; its state is managed entirely by `useDialogStore`.
- **`@props`**:
  ```typescript
  // This component receives no props directly.
  // Its content and visibility are controlled by:
  // useDialogStore.getState().showAlert({ title: '...', message: '...' });
  interface AlertDialogProps {}
  ```

### **`<AppIcon />`**

- **`@file`**: `packages/client/src/shared/components/icons/AppIcon.tsx`
- **`@purpose`**: Use this as the single, authoritative component for rendering all application icons by providing a string-based `icon` name, which ensures consistency and abstracts the underlying icon library.
- **`@props`**:

  ```typescript
  import type { SvgIconProps } from '@mui/material/SvgIcon';
  import type { AppIconName } from './AppIcons';

  export interface AppIconProps extends SvgIconProps {
    icon: AppIconName;
  }
  ```

### **`<BrandedImage />`**

- **`@file`**: `packages/client/src/shared/components/media/BrandedImage.tsx`
- **`@purpose`**: Use this as a theme-aware replacement for the native `<img>` tag to automatically apply consistent, theme-derived styling (like `borderRadius`) to all general-purpose images.
- **`@props`**:
  ```typescript
  // This is a styled component that wraps the native <img> element.
  // It accepts all standard HTML <img> attributes (e.g., src, alt, sx).
  interface BrandedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    sx?: object;
  }
  ```

### **`<CollapsibleSection />`**

- **`@file`**: `packages/client/src/shared/components/CollapsibleSection.tsx`
- **`@purpose`**: Use this to group related content within a screen, allowing the user to show/hide it to reduce visual clutter; it manages its own expansion state.
- **`@props`**:
  ```typescript
  interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    initiallyExpanded?: boolean;
    /** If provided, a copy button will be displayed and this text will be copied to the clipboard. */
    copyText?: string;
  }
  ```

### **`<ConfirmDialog />`**

- **`@file`**: `packages/client/src/shared/components/dialogs/ConfirmDialog.tsx`
- **`@purpose`**: Use this globally accessible confirmation dialog to prompt the user with a choice that requires "Confirm" and "Cancel" actions; its state is managed entirely by `useDialogStore`.
- **`@props`**:
  ```typescript
  // This component receives no props directly.
  // Its content and visibility are controlled by:
  // useDialogStore.getState().showConfirm({ title: '...', message: '...', onConfirm: () => {} });
  interface ConfirmDialogProps {}
  ```

### **`<DialogManager />`**

- **`@file`**: `packages/client/src/shared/components/dialogs/DialogManager.tsx`
- **`@purpose`**: Use this component once in the root layout to render all global dialogs (`AlertDialog`, `ConfirmDialog`, `InputDialog`), keeping the main layout component clean.
- **`@props`**:
  ```typescript
  interface DialogManagerProps {}
  ```

### **`<InfoDialog />`**

- **`@file`**: `packages/client/src/shared/components/InfoDialog.tsx`
- **`@purpose`**: Use this to show detailed, multi-line help content in a full dialog window, triggered by clicking a small info icon.
- **`@props`**:
  ```typescript
  interface InfoDialogProps {
    title: string;
    content: string | React.ReactNode;
    iconSize?: 'small' | 'medium' | 'large';
    tooltipText?: string;
  }
  ```

### **`<InfoTooltip />`**

- **`@file`**: `packages/client/src/shared/components/InfoTooltip.tsx`
- **`@purpose`**: Use this to show short, concise help text in a tooltip when a user hovers over a small info icon.
- **`@props`**:
  ```typescript
  interface InfoTooltipProps {
    title: React.ReactNode;
  }
  ```

### **`<InputDialog />`**

- **`@file`**: `packages/client/src/shared/components/dialogs/InputDialog.tsx`
- **`@purpose`**: Use this globally accessible dialog to prompt the user for a single line of text input; its state is managed entirely by `useDialogStore`.
- **`@props`**:
  ```typescript
  // This component receives no props directly.
  // Its content and visibility are controlled by:
  // useDialogStore.getState().showPrompt({ title: '...', message: '...', onConfirm: (value) => {} });
  interface InputDialogProps {}
  ```

### **`<Logo />`**

- **`@file`**: `packages/client/src/shared/components/media/Logo.tsx`
- **`@purpose`**: Use this as the single, authoritative component to render the application's brand logo, with support for different variants (`full`, `mark`) and sizes.
- **`@props`**:

  ```typescript
  import type { BoxProps } from '@mui/material/Box';

  export interface LogoProps extends Omit<BoxProps, 'src' | 'alt' | 'component'> {
    variant?: 'full' | 'mark';
    size?: number;
  }
  ```

### **`<MainLayout />`**

- **`@file`**: `packages/client/src/shared/components/layout/MainLayout.tsx`
- **`@purpose`**: Use this component as the root-level application frame, which renders the main content area and the responsive side navigation drawer.
- **`@props`**:
  ```typescript
  interface MainLayoutProps {
    children: React.ReactNode;
  }
  ```

### **`<RewriteCounter />`**

- **`@file`**: `packages/client/src/shared/components/diagnostics/RewriteCounter.tsx`
- **`@purpose`**: Use this diagnostic tool to display an overlay on a component that shows how many times it has re-rendered, which is enabled globally via `useSettingsStore`.
- **`@props`**:
  ```typescript
  interface RewriteCounterProps {
    count: number;
  }
  ```

### **`<ShellAiSettingsEditor />`**

- **`@file`**: `packages/client/src/shared/components/ai/ShellAiSettingsEditor.tsx`
- **`@purpose`**: Use this to provide a standardized, collapsible UI for editing a complete `AiSettings` object, including selecting a connection and adjusting model parameters like temperature and max tokens.
- **`@props`**:

  ```typescript
  import type { AiSettings } from '@aianvil/client/shared/types/AiSettings';

  interface ShellAiSettingsEditorProps {
    label: string;
    settings: AiSettings;
    onSettingsChange: (updatedSettings: AiSettings) => void;
  }
  ```

---

## **Tools (Hooks & Utilities)**

### **`crypto`**

- **`@file`**: `packages/shared/src/lib/security/crypto/aes.ts` and `kdf.ts`
- **`@purpose`**: Use these low-level, pure functions to perform AES-GCM encryption/decryption and to derive secure keys from user secrets via PBKDF2.
- **`@api`**:
  ```typescript
  async function encrypt(data: string, key: CryptoKey): Promise<Uint8Array>;
  async function decrypt(encryptedData: Uint8Array, key: CryptoKey): Promise<string>;
  async function deriveKey(secret: string, salt: string): Promise<CryptoKey>;
  ```

### **`debug`**

- **`@file`**: `packages/client/src/shared/utils/debug.ts`
- **`@purpose`**: Use the `logger` object as the single, centralized, and level-aware utility for all application logging; direct use of `console.log` is forbidden.
- **`@api`**:
  ```typescript
  const logger = {
    debug: (message: string, context?: Record<string, unknown>) => void;
    info: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
  };
  ```

### **`diceRoller`**

- **`@file`**: `packages/client/src/shared/utils/diceRoller.ts`
- **`@purpose`**: Use the `DiceRoller.roll()` method to parse standard dice notation (e.g., "2d6+3"), calculate results, and return a structured `DiceRollResult` object.
- **`@api`**:

  ```typescript
  interface DiceRollResult {
    rolls: number[];
    sum: number;
    modifier: number;
    formula: string;
  }

  const DiceRoller = {
    roll: (formula: string) => DiceRollResult;
    format: (result: DiceRollResult) => string;
  };
  ```

### **`formatDate`**

- **`@file`**: `packages/client/src/shared/utils/formatDate.ts`
- **`@purpose`**: Use these utilities to safely format ISO date strings for display and to convert Firestore `Timestamp`-like objects into ISO strings.
- **`@api`**:
  ```typescript
  function formatIsoDateForDisplay(isoString: string): string;
  function toIsoStringIfTimestamp<T>(value: T): string | T;
  ```

### **`gzip`**

- **`@file`**: `packages/client/src/lib/utils/gzip.ts`
- **`@purpose`**: Use these promise-based wrappers around the `pako` library for all Gzip compression (`gzip`) and decompression (`gunzip`) operations.
- **`@api`**:
  ```typescript
  async function gzip(data: string): Promise<Uint8Array>;
  async function gunzip(blob: Uint8Array): Promise<string>;
  ```

### **`jsonUtils`**

- **`@file`**: `packages/client/src/shared/utils/jsonUtils.ts`
- **`@purpose`**: Use these pure, type-safe functions for common JSON object manipulations like deep flattening, safe nested property access, and parsing primitive values from strings.
- **`@api`**:
  ```typescript
  function flattenJsonObject(
    obj: Record<string, unknown>,
    prefix = '',
    shallow = false
  ): Record<string, unknown>;
  function parseJsonPrimitive(text: string): string | number | boolean | null;
  function getNestedValue(obj: Record<string, unknown>, pathParts: string[]): unknown;
  ```

### **`sanitize`**

- **`@file`**: `packages/client/src/shared/utils/sanitize.ts`
- **`@purpose`**: Use these security utilities to redact sensitive information like API keys from strings, URLs, and logs before they are displayed or stored.
- **`@api`**:
  ```typescript
  function sanitizeUrl(url: string): string;
  function sanitizeString(input: string | null | undefined, alsoRedact?: string[]): string | null;
  ```

### **`tokenCounter`**

- **`@file`**: `packages/client/src/shared/utils/tokenCounter.ts`
- **`@purpose`**: Use `calculateCboxTokens` to get a real-time, heuristic-based estimate of the token count for a `BoxItem` to provide UI feedback to authors.
- **`@api`**:
  ```typescript
  import type { BoxItem } from '@aianvil/shared';
  function calculateCboxTokens(box: BoxItem): number;
  ```

### **`useAssetActions`**

- **`@file`**: `packages/client/src/shared/hooks/useAssetActions.ts`
- **`@purpose`**: Use this hook to get a set of stable, reusable functions for performing actions on public assets, such as flagging content for moderation (`flagAsset`).
- **`@api`**:
  ```typescript
  function useAssetActions(): {
    flagAsset: (assetId: string, assetType: 'shell' | 'chip') => Promise<void>;
  };
  ```

### **`useDialog`**

- **`@file`**: `packages/client/src/shared/hooks/useDialog.ts`
- **`@purpose`**: Use this simple hook to manage the local open/closed state of a single, component-specific dialog or modal.
- **`@api`**:
  ```typescript
  function useDialog(initialState?: boolean): {
    isOpen: boolean;
    open: () => void;
    close: () => void;
  };
  ```

### **`useLongPress`**

- **`@file`**: `packages/client/src/shared/hooks/useLongPress.ts`
- **`@purpose`**: Use this hook to differentiate between a standard click and a long press on any UI element; it returns a spreadable object of event handlers.
- **`@api`**:
  ```typescript
  function useLongPress<T extends HTMLElement>(
    onLongPress: (event: React.MouseEvent<T> | React.TouchEvent<T>) => void,
    onClick?: (event: React.MouseEvent<T> | React.TouchEvent<T>) => void,
    options?: { delay?: number }
  ): {
    onMouseDown: (event: React.MouseEvent<T>) => void;
    // ... other event handlers
  };
  ```

### **`useRewriteCounter`**

- **`@file`**: `packages/client/src/shared/hooks/useRewriteCounter.ts`
- **`@purpose`**: Use this diagnostic hook to track the number of times a React component re-renders; it is enabled globally via `useSettingsStore`.
- **`@api`**:
  ```typescript
  function useRewriteCounter(): {
    count: number;
    isEnabled: boolean;
  };
  ```

### **`uuid`**

- **`@file`**: `packages/shared/src/utils/uuid.ts`
- **`@purpose`**: Use this cross-platform utility to generate a new, unique UUID v4 string.
- **`@api`**:
  ```typescript
  function generateUuid(): string;
  ```
