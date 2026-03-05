# Jabin CRM - Lead Generation & Management Platform

A professional CRM solution designed to streamline the lead lifecycle—from enrichment and AI-powered personalization to automated email campaigns and conversion tracking.

## 🚀 Features

### 📋 Advanced Lead Management
- **Visual Pipeline**: Track leads through customizable stages (New → Contacted → Qualified → Converted).
- **Deep Enrichment**: Automatically enhance lead data with company bios, industry details, and social profiles.
- **Activity Timeline**: Full audit trail of every interaction, status change, and email event.
- **Smart Filtering**: Powerful search and categorization by industry, source, tags, and status.
- **Bulk Operations**: Efficiently manage large datasets with export capabilities.

### ✉️ AI-Powered Campaigns
- **Dynamic Personalization**: Use variables like `{{companyName}}` and `{{industry}}` for high-conversion outreach.
- **Email Templates**: Create and manage reusable templates for consistent messaging.
- **Real-time Tracking**: Monitor open rates, click-throughs, and replies as they happen.
- **AI Personalization**: Leverages Google Gemini to craft tailored value propositions based on lead data.

### 📊 Reports & Analytics
- **Dashboard Stats**: Real-time overview of total leads, active hospitals/clinics, and growth metrics.
- **Campaign Performance**: Detailed breakdowns of delivery success and engagement rates.
- **Weekly Growth Tracking**: Monitor your pipeline's expansion over time.

### 🔐 Admin & Security
- **User Management**: Role-based access control (Admin/User) and usage monitoring.
- **Secure API Integration**: Encrypted storage for Gemini and Google Places API keys.
- **Subscription Management**: Integrated plan tiers (Trial, Pro, Business) with usage limits.

## 🛠 Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS & Radix UI (shadcn/ui)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js (Google OAuth & Credentials)
- **State**: TanStack Query (React Query)
- **AI**: Google Gemini API
- **Email**: SMTP / Resend integration

## 📋 Prerequisites

- **Node.js**: 20.x or higher
- **Database**: PostgreSQL instance
- **AI**: Gemini API Key (from Google AI Studio)

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone <repository-url>
cd jabin-crm
npm install
```

### 2. Environment Setup
Create a `.env` file in the root:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/jabin_crm"

# Auth
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# AI & Enrichment
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email (SMTP)
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="user@example.com"
SMTP_PASSWORD="password"
SMTP_FROM="info@jabin.org"
```

### 3. Initialize Database
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 4. Run Development Server
```bash
npm run dev
```
Visit `http://localhost:3000` to start managing your leads.

---
Made with ❤️ for efficient lead generation.
