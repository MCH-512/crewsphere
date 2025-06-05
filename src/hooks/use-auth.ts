
import { useContext } from 'react';
// This file is created to prevent circular dependencies if useAuth was directly in auth-context.tsx
// and other hooks/components tried to import from auth-context.tsx.
// However, with the current setup in auth-context.tsx, it exports useAuth directly.
// This file can be kept for future structural organization or removed if useAuth from context is preferred.

// Re-exporting useAuth from AuthContext for convenience if this file is preferred for imports
export { useAuth } from '@/contexts/auth-context';
