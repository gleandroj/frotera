# Cursor AI Configuration

This `.cursor` folder contains configuration files and rules for the Cursor AI assistant to provide better, more consistent code suggestions and assistance for this project.

## Files Overview

### `rules`
The main rules file that defines coding standards, architecture guidelines, and best practices for this AI Agent Platform monorepo. This file helps Cursor AI understand:

- Project structure and tech stack (Next.js frontend + NestJS backend)
- Code style and naming conventions
- Security best practices
- Performance guidelines
- Testing strategies
- Common patterns to follow
- NestJS-specific patterns and decorators

### `settings.json`
Cursor AI specific settings including:

- Model configuration (Claude 3.5 Sonnet)
- File inclusion/exclusion patterns (including NestJS test files)
- Editor preferences
- TypeScript settings
- Tailwind CSS configuration
- NestJS-specific settings

### `templates.json`
Code templates for common development tasks:

- React components with TypeScript (Frontend)
- NestJS controllers with proper decorators
- NestJS services with error handling
- NestJS modules
- DTOs with validation
- Guards, interceptors, and pipes
- Prisma models
- Custom hooks (Frontend)
- Test files (both frontend and NestJS)
- Utility functions

## Usage

These files are automatically read by Cursor AI when you're working in this repository. The AI assistant will:

1. Follow the coding standards defined in `rules`
2. Use the settings in `settings.json` for better context
3. Suggest templates from `templates.json` when appropriate
4. Apply NestJS-specific patterns for backend development

## Customization

You can modify these files to:

- Add new coding standards specific to your team
- Include additional file types in the context
- Create new code templates for common patterns
- Adjust AI model settings for different use cases
- Add NestJS-specific decorators and patterns

## Best Practices

- Keep rules concise and actionable
- Update templates when you establish new patterns
- Review and update settings as your project evolves
- Ensure all team members understand the rules
- Follow NestJS best practices for backend development

## Project-Specific Notes

This configuration is tailored for:
- **Frontend**: Next.js 14 with TypeScript and App Router
- **Backend**: NestJS API with TypeScript, decorators, and dependency injection
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with 2FA (TOTP) using NestJS guards
- **Styling**: Tailwind CSS + shadcn/ui for frontend
- **Build System**: Turbo for monorepo orchestration
- **Package Manager**: pnpm
- **Testing**: Jest for NestJS, Vitest for frontend
- **Documentation**: Swagger/OpenAPI for API documentation

The rules emphasize:
- **Security**: Secure coding practices for AI applications
- **Performance**: Optimized for production deployments
- **Maintainability**: Clean architecture with proper separation of concerns
- **NestJS Patterns**: Proper use of decorators, dependency injection, guards, interceptors, and pipes
- **Monorepo Structure**: Clear boundaries between frontend and backend applications

## Architecture Highlights

### Frontend (Next.js)
- App Router patterns
- Server and client components
- API integration with NestJS backend
- State management with React hooks
- Error boundaries and loading states

### Backend (NestJS)
- Module-based architecture
- Dependency injection
- Guards for authentication and authorization
- Interceptors for request/response transformation
- Pipes for validation
- Exception filters for error handling
- Swagger documentation
- Prisma integration for database operations

### Shared
- TypeScript strict mode
- Common utilities and types
- Shared validation schemas
- Consistent error handling patterns