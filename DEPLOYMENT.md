# 🚀 iBUY Deployment Guide

## Pre-Deployment Checklist

### ✅ Security

- [ ] All 17 security tests pass (`npm run test:run`)
- [ ] `NEXTAUTH_SECRET` is a strong, random value (min 32 chars)
- [ ] `DATABASE_URL` points to production database
- [ ] Paystack keys are **LIVE** keys (not test)
- [ ] Super Admin bootstrap script has been run ONCE
- [ ] No hardcoded credentials in code
- [ ] `.env` file is in `.gitignore`

### ✅ Database

- [ ] Production PostgreSQL database is provisioned
- [ ] `npx prisma db push` has been run on production
- [ ] Initial categories and seed data loaded
- [ ] At least one SUPER_ADMIN exists

### ✅ Application

- [ ] `npm run build` completes without errors
- [ ] All pages load correctly
- [ ] Payment flow tested with live Paystack keys
- [ ] Email verification configured (optional)

## Deploy to Vercel

### Step 1: Connect Repository

```bash
# Push your code to GitHub
git add .
git commit -m "Ready for production deployment"
git push origin main
```
