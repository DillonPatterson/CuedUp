# CuedUp

CuedUp is a compact Next.js starter for building modern TypeScript applications with a clean project structure, lightweight validation, and practical integration boundaries.

It is intended for teams and solo developers who want a polished foundation for internal tools, dashboard-style products, or frontend experiments without starting from a blank project.

## Overview

This repository packages a small but useful set of defaults:

- App Router with a clear page and route layout
- Type-safe development with shared runtime validation
- Tailwind CSS for fast iteration on layout and styling
- modular UI components that are easy to extend
- helper layers for storage and background workflows

The codebase favors explicit boundaries and readable files over large abstractions. It is designed to be easy to navigate, easy to adapt, and straightforward to evolve as requirements become clearer.

## Features

- Next.js App Router project structure
- TypeScript-first development experience
- Zod schemas for runtime validation and inferred types
- Tailwind CSS styling setup
- API route scaffolding for server-side entry points
- Supabase helper modules for browser and server usage
- Inngest setup placeholders for asynchronous jobs
- deterministic local development utilities for repeatable testing

## Tech Stack

- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zod](https://zod.dev/)
- [Supabase](https://supabase.com/)
- [Inngest](https://www.inngest.com/)

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer

### Installation

```bash
npm install
```

### Local development

Create a local environment file from the example:

```bash
cp .env.local.example .env.local
```

Start the development server:

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

## Project Structure

```text
app/                  App Router pages, layouts, styles, and route handlers
components/           Reusable UI pieces and feature-oriented presentation layers
inngest/              Background function setup and related helpers
lib/                  Shared utilities, schemas, and integration boundaries
supabase/             SQL migrations and seed scaffolding
types/                Shared TypeScript exports
scripts/              Small development utilities
```

## Available Scripts

- `npm run dev` starts the local development server
- `npm run build` creates a production build
- `npm run start` serves the production build locally
- `npm run lint` runs ESLint across the project
- `npm run state:replay` runs a local deterministic development utility

## Development Notes

- Validation and TypeScript types are kept close together to reduce drift between runtime and compile-time contracts.
- Integration code is separated from presentation code to keep feature work easier to review.
- The repository includes placeholders for external services, but most of the scaffold remains usable for local-first development.
- The project is intentionally structured for iterative feature work rather than heavy upfront architecture.

## Extending the Starter

When adding new features, prefer:

- small, focused modules
- clear schema updates
- minimal coupling between UI and service layers
- incremental changes that preserve readability

This keeps the project approachable as it grows and makes future refactors safer.

## Deployment

The current setup works well for local development and early hosted environments. Before deploying broadly, review environment configuration, service credentials, and any platform-specific production settings required by your target infrastructure.

## License

Add the license that matches your intended usage before distributing or publishing the project.
