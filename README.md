# Frotera

## User Flags (`isSuperAdmin` vs `isSystemUser`)

- `isSuperAdmin`: grants elevated global admin access (guards and administrative features).
- `isSystemUser`: marks an account as an internal/system account, primarily for classification and filtering in member/team visibility scenarios.
- They are independent flags: a user can have one, both, or none.
- In team member create/edit flows, only actors who are already super admins can set or update these two flags.

## First Time Setup

### 1. Install dependencies
```bash
pnpm install
```

### 2. Start Docker services
```bash
docker-compose up -d
```

### 3. Setup database
```bash
cd apps/api
pnpm db:push
```

#### Connect to database
To connect to the database:
```bash
psql -h localhost -U postgres -d rsfrotas
```

Type `\d` to check the tables creation.

### 3.1. Access MinIO Dashboard

The MinIO Console (dashboard) is available at:
```
http://localhost:9001
```

**Login Credentials:**
- **Username**: `minioadmin`
- **Password**: `minioadmin123`

The MinIO S3 API is available at:
```
http://localhost:9000
```

**Note:** The `local` bucket is automatically created when you start the Docker services.

### 4. Configure Stripe
- Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) and create a new sandbox account
- Get your Stripe keys (Publishable key and Secret key)
- Put the **public key** in your web app `.env` file
- Put the **private key** in your API `.env` file

### 5. Seed database
```bash
cd apps/api
pnpm db:seed --with-stripe
```

### 6. Start web app
```bash
cd apps/web
pnpm dev
```

### 7. Setup Stripe webhooks
- Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
- In the `apps/api` folder, run:
```bash
pnpm stripe:listen
```
- Copy the webhook signing secret and add it to your API `.env` file

### 8. Start API server
```bash
cd apps/api
pnpm dev
```

### 9. Access AdminJS Panel

The AdminJS admin panel is available at:
```
http://localhost:3001/admin
```

**Login Credentials:**
- **Email**: `admin@${APP_DOMAIN}` (e.g., `admin@rsfrotas.radisa.com.br` if `APP_DOMAIN=rsfrotas.radisa.com.br`)
- **Password**: The password set in `ADMIN_PASSWORD` environment variable (defaults to `admin123` if not set)

**Note:** Make sure you have:
1. Set `APP_DOMAIN` in your `apps/api/.env` file (see `.env.example`)
2. Run the database seed to create the admin user:
   ```bash
   cd apps/api
   pnpm db:seed
   ```

The admin panel allows you to manage all database models including Users, Organizations, AI Agents, Contacts, Messages, Sessions, and more.

### 10. Start WhatsApp service
```bash
cd apps/whatsapp
go mod download
go run main.go
```