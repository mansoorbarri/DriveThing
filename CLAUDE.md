# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A modern, family-oriented cloud file management application. Built with Next.js 15, React 19, and Convex.

## Build and Development Commands

**Never run build or dev server unless explicitly asked.**

```bash
bun lint              # ESLint
bun typecheck         # TypeScript check
bun run check         # Run lint + typecheck together
bun run format:write  # Prettier auto-format
```

Convex:
```bash
bunx convex dev       # Run after any changes in convex/ folder
```
Notify me to run deploy command when there are changes in the Convex folder.

## Design Guidelines

- Always create dark websites unless explicitly specified
- Use shadcn for components and icons
- Use Tailwind for CSS
- Use TypeScript; only use JS if there's no TS solution or it's objectively better

## Architecture Overview

This is a Next.js 15 family file management application using the App Router pattern with Convex as the backend database.

### Directory Structure

- `src/app/` - App Router pages and API routes
- `src/components/` - React components (ui/ for reusable components)
- `src/lib/` - Utilities including UploadThing configuration
- `convex/` - Convex schema and functions (files.ts, folders.ts, families.ts, users.ts)

### Key Patterns

**Real-time Data Flow:**
- Convex React hooks (useQuery, useMutation) provide real-time updates
- Changes sync instantly across all family members
- Family ID links all resources (files, folders, users)

**File Upload Flow:**
- UploadThing handles cloud storage (64MB max, 50 files per batch)
- Convex stores file metadata with family/folder associations
- Files can be assigned to specific members or shared with entire family

**Authentication & Authorization:**
- Clerk for authentication (middleware in `src/middleware.ts`)
- Two user roles: owner (full control) and member (view assigned/shared files)
- Role checking enforced in every Convex mutation

### Convex Schema

Key tables in `convex/schema.ts`:
- `families` - Family groups with invite codes
- `users` - Clerk integration, family membership, role (owner/member)
- `folders` - Hierarchical folder structure with sharing options
- `files` - File metadata with assignment and sharing
- `invites` - Pending family invitations
- `tags` - Custom tags per family

### API Routes

- `/api/uploadthing/` - File upload, delete, and rename endpoints

### External Services

| Service | Purpose |
|---------|---------|
| Convex | Backend database with real-time sync |
| Clerk | Authentication |
| UploadThing | File storage (64MB max) |

### Path Alias

Use `~/` for imports from `src/`:
```typescript
import { something } from "~/lib/utils";
```

### Environment Variables

Validated in `src/env.js` using T3 Env. Server-side vars include Clerk and UploadThing keys. Client-side vars are prefixed with `NEXT_PUBLIC_`. NEVER add `.optional()` unless told so. Add new environment variables to `.env.example`.
