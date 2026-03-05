# Travelpod

A video-first travel platform with six account types: Traveler, Travel Agency, Hotel or Resort, Destination, Airline, and Association.

## Tech Stack

- **Frontend**: React 18 (Vite)
- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL (Prisma ORM)
- **Video Storage**: Cloudinary
- **Auth**: JWT + bcrypt + Google OAuth
- **Real-time**: Socket.io

## Getting Started

```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev
```

The client runs on `http://localhost:5173` and the server on `http://localhost:5000`.

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```
