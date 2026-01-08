# Vercel Deployment Setup

## Environment Variables Configuration

To deploy this application on Vercel, you need to set up the following environment variable:

### Required Environment Variables

1. **AIRLABS_API_KEY** - Your AirLabs API key for flight tracking

### How to Add Environment Variables on Vercel

1. Go to your project on Vercel Dashboard
2. Click on **Settings** tab
3. Click on **Environment Variables** in the left sidebar
4. Add the following variable:
   - **Name**: `AIRLABS_API_KEY`
   - **Value**: `403337d8-6986-4833-ac26-9c3abc3410b4`
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**
6. Redeploy your application for changes to take effect

### Security Note

✅ **API Key is now secure!**
- The API key is stored in Vercel's environment variables
- It's NOT exposed in the frontend code
- The backend API (`/api/flights`) handles AirLabs requests
- Users cannot see or steal your API key

### Local Development

For local development, the `.env.local` file is already set up with the API key.

```bash
npm run dev
```

The app will use the API key from `.env.local` when running locally.

### Weather API

The Open-Meteo weather API doesn't require an API key and runs directly from the frontend. No setup needed!
