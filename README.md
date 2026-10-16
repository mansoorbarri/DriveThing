# DriveThing

Simple file storage for your family. No complicated folders, just your files.

DriveThing gives a family one shared place for the documents that matter: passports, school reports, bills, medical letters, photos. One person (the family owner) uploads and organises everything, then decides who sees what. Everyone else signs in and finds the files meant for them, without needing to learn a file manager.

## What you can do

- **Start a family.** Create a family group and invite others with a code. They join with that code and see only what's been shared with them.
- **Upload anything.** Drag in files or whole folders (the folder structure is kept). Up to 50 files at a time and 64MB per file. Photos are compressed before upload to save space.
- **Keep things organised.** Create folders inside folders, rename and move things, and use the breadcrumb trail to find your way back. Everything is sorted alphabetically.
- **Decide who sees what.** Give a file or folder to one family member, share it with a few people, or share it with the whole family.
- **Preview without downloading.** Open images, PDFs and spreadsheets right in the app. Download anything else with one click.
- **Work in bulk.** Select several items (shift-click selects a range), then download, move, assign or delete them all at once.
- **Search.** Find files by name or tag.
- **See changes straight away.** When the owner uploads or shares something, everyone sees it immediately without refreshing.
- **Install it like an app.** DriveThing can be added to your phone's or computer's home screen and opens like a normal app.

### Who can do what

| Role       | Can do                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| **Owner**  | Upload, organise, rename, move and delete; assign and share files; invite and remove members |
| **Member** | View and download files and folders assigned to them or shared with the family             |

---

## Tech stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router), React 19, TypeScript
- **Backend and database:** [Convex](https://convex.dev/) (real-time sync)
- **Authentication:** [Clerk](https://clerk.com/)
- **File storage:** [UploadThing](https://uploadthing.com/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Other:** `react-dropzone` for uploads, `browser-image-compression` for photos, `xlsx` for spreadsheet previews, a service worker and web manifest for PWA support
- **Package manager:** [Bun](https://bun.sh/)

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js)
- Accounts with:
  - [Clerk](https://dashboard.clerk.com) for authentication
  - [Convex](https://dashboard.convex.dev) for the backend
  - [UploadThing](https://uploadthing.com/dashboard) for file storage

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/mansoorbarri/DriveThing.git
   cd DriveThing
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Create `.env.local` from the example:

   ```bash
   cp .env.example .env.local
   ```

4. Fill in the environment variables:

   ```env
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

   # Convex Backend
   NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

   # UploadThing File Storage
   UPLOADTHING_TOKEN=your-uploadthing-token
   ```

5. Run the Convex backend and the Next.js app in two terminals:

   ```bash
   bunx convex dev
   bun run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command                | Description                         |
| ---------------------- | ----------------------------------- |
| `bun run dev`          | Start the dev server (Turbopack)    |
| `bun run build`        | Build for production                |
| `bun run start`        | Start the production server         |
| `bun run lint`         | Run ESLint                          |
| `bun run typecheck`    | Run TypeScript type checking        |
| `bun run check`        | Run lint and typecheck              |
| `bun run format:check` | Check formatting                    |
| `bun run format:write` | Auto-fix formatting                 |

## Project structure

```
DriveThing/
├── src/
│   ├── app/
│   │   ├── dashboard/          # Main dashboard (protected)
│   │   ├── offline/            # Offline fallback page for the PWA
│   │   ├── sign-in/, sign-up/  # Clerk auth pages
│   │   └── api/uploadthing/    # Upload, rename and delete endpoints
│   ├── components/             # Cards, modals, uploader, preview, bulk actions
│   │   └── ui/                 # Reusable UI primitives
│   ├── lib/                    # UploadThing config and utilities
│   └── middleware.ts           # Clerk middleware
├── convex/
│   ├── schema.ts               # Database schema
│   ├── files.ts                # File queries and mutations (incl. search, bulk ops)
│   ├── folders.ts              # Folder queries and mutations
│   ├── families.ts             # Family creation, joining, invites, members
│   └── users.ts                # User sync with Clerk
└── public/                     # Icons, manifest.json, service worker (sw.js)
```

## How it works

- **Uploads:** files go straight to UploadThing; Convex stores the metadata (name, type, size, URL, file key) along with the family, folder, owner and sharing settings.
- **Permissions:** every Convex mutation checks the caller's role, so members can't change anything even if they call the API directly.
- **Real-time:** the UI reads through Convex `useQuery` hooks, so changes appear for every family member as soon as they happen.

### Data model

| Table      | Purpose                                                  |
| ---------- | -------------------------------------------------------- |
| `families` | Family groups and their invite codes                     |
| `users`    | Clerk users, their family and role (`owner` / `member`)  |
| `folders`  | Nested folders with assignment and sharing settings      |
| `files`    | File metadata, tags, assignment and sharing settings     |
| `invites`  | Pending family invitations                               |
| `tags`     | Custom tags per family                                   |

## CI

GitHub Actions runs `bun run lint` and `bun run typecheck` on pushes and pull requests to `main`.
