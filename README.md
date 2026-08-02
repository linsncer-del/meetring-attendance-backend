# KMTAMS Backend API

**KeNHA Meeting & Training Attendance Management System** — REST API

Built with **Hono** · **TypeScript** · **Supabase** · **Nodemailer** · **Puppeteer**

---

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your Supabase URL, keys, and SMTP credentials
```

### 3. Run in development

```bash
pnpm dev
```

Server starts at **http://localhost:3000**

---

## API Endpoints

### Auth — `/api/auth`
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/login` | Public | Sign in with email + password |
| POST | `/logout` | Authenticated | Sign out |
| POST | `/change-password` | Authenticated | Change password (forced on first login) |
| GET | `/me` | Authenticated | Get current user profile |

### Departments — `/api/departments`
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | Authenticated | List all departments |
| GET | `/:id` | Authenticated | Get department by ID |
| POST | `/` | ICT Admin | Create department |
| PATCH | `/:id` | ICT Admin | Update department |
| DELETE | `/:id` | ICT Admin | Delete department |

### Users — `/api/users`
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | ICT Admin | List all users (paginated) |
| GET | `/:id` | Authenticated | Get user profile |
| POST | `/` | ICT Admin | Create user (sends welcome email) |
| PATCH | `/:id` | ICT Admin | Update user |
| PATCH | `/:id/disable` | ICT Admin | Disable account |
| PATCH | `/:id/enable` | ICT Admin | Enable account |
| POST | `/:id/reset-password` | ICT Admin | Reset password (sends email) |

### Meetings — `/api/meetings`
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | Authenticated | List meetings (role-filtered) |
| GET | `/:id` | Authenticated | Get meeting details |
| GET | `/:id/live` | Authenticated | Live attendance dashboard data |
| POST | `/` | Organizer+ | Create meeting (auto-generates PIN + QR) |
| PATCH | `/:id` | Organizer+ | Update meeting |
| POST | `/:id/open-attendance` | Organizer+ | Open attendance window |
| POST | `/:id/close-attendance` | Organizer+ | Close attendance window |

### Attendance — `/api/attendance`
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/meeting-info/:meetingId` | **Public** | Get meeting info for attendance form |
| POST | `/submit` | **Public** (rate-limited) | Submit attendance (staff or visitor) |
| GET | `/:meetingId` | Authenticated | Get all attendees for a meeting |

### Reports — `/api/reports`
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/generate/:meetingId` | Organizer+ | Generate PDF report |
| GET | `/` | Authenticated | List reports (role-filtered) |
| GET | `/:id` | Authenticated | Get report details |
| GET | `/:id/download` | Authenticated | Get signed PDF download URL |
| POST | `/:id/submit-to-hr` | Organizer+ | Submit report to HR (notifies HR) |
| PATCH | `/:id/archive` | HR Officer+ | Archive report |

### Notifications — `/api/notifications`
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | Authenticated | List own notifications |
| GET | `/unread-count` | Authenticated | Count unread notifications |
| PATCH | `/read-all` | Authenticated | Mark all as read |
| PATCH | `/:id/read` | Authenticated | Mark one as read |

### Audit — `/api/audit`
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | ICT Admin only | Paginated audit log |

---

## Roles

| Role | Description |
|------|-------------|
| `ict_admin` | Full system access |
| `hr_officer` | View all meetings/reports, receive submitted reports |
| `meeting_creator` | Create meetings, manage own meetings, generate reports |

---

## Project Structure

```
src/
├── index.ts              # App entry — all routes mounted here
├── types/index.ts        # Shared TypeScript types
├── config/
│   ├── supabase.ts       # Supabase admin + anon clients
│   └── mailer.ts         # Nodemailer transporter + email templates
├── utils/
│   ├── response.ts       # Standardised JSON response helpers
│   ├── qrcode.ts         # QR code generator
│   ├── pin.ts            # Meeting PIN generator
│   ├── pdfReport.ts      # HTML → PDF (puppeteer + @sparticuz/chromium)
│   └── validators.ts     # Zod schemas for all request bodies
├── middleware/
│   ├── auth.middleware.ts    # JWT validation
│   ├── role.middleware.ts    # RBAC guard
│   ├── audit.middleware.ts   # Audit log writer
│   └── rateLimit.middleware.ts # Rate limiting
├── Auth/                 # Login, logout, change-password
├── departments/          # Department CRUD
├── users/                # User management
├── meetings/             # Meeting lifecycle
├── attendance/           # Public submission + reads
├── reports/              # Report generation + HR submission
├── notifications/        # In-app notifications
└── audit/                # Audit log reads
```

---

## Supabase Storage

Create a public bucket named **`kmtams-assets`** in your Supabase project.

Folder structure inside the bucket:
- `qrcodes/<meeting_id>.png` — QR code images
- `reports/<meeting_id>.pdf` — Generated attendance reports

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables.
