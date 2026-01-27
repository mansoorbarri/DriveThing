# DriveThing

A modern, family-oriented cloud file management application built with Next.js 15. Simplify file organization and sharing for your family - no complicated folders, just your files.

## Features

- **Family Groups** - Create or join a family with unique invite codes
- **File Management** - Upload, organize, rename, and delete files (PDFs, images, spreadsheets up to 64MB)
- **Folder Organization** - Hierarchical folder structure with breadcrumb navigation
- **File Sharing** - Assign files to specific family members or share with the entire family
- **Real-time Updates** - Changes sync instantly across all family members
- **Search** - Find files quickly by name or tags
- **Role-based Access** - Owners manage files and members; members view assigned content

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with React 19 and TypeScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/)
- **Database**: [Convex](https://convex.dev/) - Real-time backend
- **Authentication**: [Clerk](https://clerk.com/)
- **File Storage**: [UploadThing](https://uploadthing.com/)
- **Package Manager**: [Bun](https://bun.sh/)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js)
- Accounts with:
  - [Clerk](https://dashboard.clerk.com) - Authentication
  - [Convex](https://dashboard.convex.dev) - Backend database
  - [UploadThing](https://uploadthing.com/dashboard) - File storage

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/DriveThing.git
   cd DriveThing
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Create a `.env.local` file based on `.env.example`:
   ```bash
   cp .env.example .env.local
   ```

4. Configure environment variables:
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

5. Start the development server:
   ```bash
   bun run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with Turbo |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run check` | Run both lint and typecheck |
| `bun run format:check` | Check code formatting |
| `bun run format:write` | Auto-fix formatting |

## Project Structure

```
DriveThing/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── dashboard/          # Main dashboard (protected)
│   │   ├── sign-in/            # Authentication pages
│   │   ├── sign-up/
│   │   └── api/uploadthing/    # File upload endpoints
│   ├── components/             # React components
│   │   ├── ui/                 # Reusable UI components
│   │   └── modals/             # Modal dialogs
│   └── lib/                    # Utilities and configurations
├── convex/                     # Backend database functions
│   ├── schema.ts               # Database schema
│   ├── files.ts                # File operations
│   ├── folders.ts              # Folder operations
│   ├── families.ts             # Family management
│   └── users.ts                # User queries
└── public/                     # Static assets
```

## User Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Upload files, create/delete folders, assign files to members, manage family settings, invite members |
| **Member** | View files assigned to them or shared with family |

## License

[MIT](LICENSE)
