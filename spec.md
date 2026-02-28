# PortfolioFlow

## Current State
- App has login via Internet Identity
- Assets can be added per tab (stocks, crypto, commodities)
- Dark mode exists but is not applied by default on first load
- User name can be set in Settings but saves unreliably
- No onboarding flow enforcing name entry on first login
- Actor initialization calls `_initializeAccessControlWithSecret` which causes auth errors when adding assets

## Requested Changes (Diff)

### Add
- Onboarding screen: after first login, if no name is registered, show a modal/overlay forcing the user to enter a name before accessing the app
- Apply dark theme immediately on initial page load (before React hydration) via inline script in index.html

### Modify
- Fix asset-add error: the `reinitializeActor` function in `useQueries.ts` calls `_initializeAccessControlWithSecret("")` on actor retry which is not a valid method on the backend interface — remove this retry hack and instead ensure actor is properly initialized once
- Fix dark mode default: ensure `dark` class is set on `<html>` on first load even before React mounts, so there is no flash of light mode
- Fix name save: ensure `setUserName` in AppContext awaits actor readiness before calling `actor.setUserName()`, and shows proper error if it fails
- SettingsPage name save: disable save button while saving, show clear success/error feedback

### Remove
- The `reinitializeActor` retry hack from `useQueries.ts` (it calls a non-existent method and causes errors)

## Implementation Plan
1. Fix `useQueries.ts`: remove the `reinitializeActor` function and the retry-on-auth-error pattern — just throw the error directly so users get a clear message
2. Fix `useActor.ts`: ensure `_initializeAccessControlWithSecret` call is wrapped in try/catch so actor creation doesn't fail silently
3. Fix dark mode: add inline `<script>` to `index.html` that reads localStorage and applies dark class before React loads
4. Fix name save: in `AppContext.tsx`, make `setUserName` more robust — wait for actor, handle errors, and update local state only on success
5. Add onboarding: in `App.tsx` (AuthGate), after authentication check if actor is ready and user has no name; show `OnboardingModal` component forcing name input
6. Create `OnboardingModal.tsx` component with a name input form that calls `setUserName` and only dismisses on success
