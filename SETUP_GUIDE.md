# MEYDAN ACADEMY - Complete Setup Guide

This guide will walk you through setting up the Meydan Academy chat application from scratch.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Google account (for Firebase)
- Git (for deployment)

## Step 1: Firebase Project Setup

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `meydan-academy` (or your preferred name)
4. Disable Google Analytics (optional, to stay on free tier)
5. Click "Create project"

### 1.2 Enable Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click "Get started"
3. Click on **Sign-in method** tab
4. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle "Enable" to ON
   - Click "Save"
5. **DO NOT** enable Google sign-in (to avoid quota issues)

### 1.3 Create Firestore Database

1. Go to **Build** → **Firestore Database**
2. Click "Create database"
3. Select **Start in production mode**
4. Choose a location closest to your users
5. Click "Enable"

### 1.4 Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the **Web** icon (`</>`)
4. Register app with nickname: "Meydan Academy Web"
5. **DO NOT** check "Firebase Hosting"
6. Click "Register app"
7. Copy the `firebaseConfig` object - you'll need this later

Example config:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxxxxxxxxxx"
};
```

## Step 2: Deploy Firestore Security Rules

1. In Firebase Console, go to **Firestore Database**
2. Click on the **Rules** tab
3. Replace the existing rules with the content from `firestore.rules` file in this project
4. Click **Publish**

**Important**: The security rules enforce role-based access control. Make sure they are deployed correctly.

## Step 3: Initialize Firestore Data

You need to manually create the initial server and channel documents.

### 3.1 Create Server Document

1. In Firestore Database, click **Start collection**
2. Collection ID: `servers`
3. Document ID: `default-server`
4. Add fields:
   - `name` (string): "MEYDAN ACADEMY"
   - `iconUrl` (string): "" (leave empty)
   - `createdAt` (timestamp): Click "Add field" → Select "timestamp" → Click "Set to current time"
5. Click **Save**

### 3.2 Create Channel Document

1. Click **Start collection**
2. Collection ID: `channels`
3. Document ID: (auto-generated)
4. Add fields:
   - `name` (string): "genel-sohbet"
   - `serverId` (string): "default-server"
   - `type` (string): "text"
   - `description` (string): "Genel sohbet kanalı"
   - `createdAt` (timestamp): Set to current time
5. Click **Save**

## Step 4: Local Development Setup

### 4.1 Clone and Install

```bash
# Navigate to project directory
cd dss

# Install dependencies (already done if you followed earlier steps)
npm install
```

### 4.2 Configure Environment Variables

1. Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

2. Edit `.env` and add your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Important**: Never commit `.env` to Git. It's already in `.gitignore`.

### 4.3 Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Step 5: Create Your First Admin User

### 5.1 Register a User

1. Open the app in your browser
2. Click "Register"
3. Fill in:
   - Display Name: Your name
   - Email: your-email@example.com
   - Password: (at least 6 characters)
4. Click "Register"

### 5.2 Promote User to Admin

1. Go to Firebase Console → **Firestore Database**
2. Navigate to `users` collection
3. Find your user document (by email)
4. Click on the document
5. Find the `role` field
6. Change value from `"member"` to `"admin"`
7. Click **Update**

### 5.3 Verify Admin Access

1. Refresh the app
2. Click the settings icon (bottom left)
3. You should now see "Open Admin Panel" button
4. Click it to access the admin panel

## Step 6: Deploy to GitHub Pages

### 6.1 Install gh-pages

```bash
npm install --save-dev gh-pages
```

### 6.2 Update package.json

Add the following to your `package.json`:

```json
{
  "homepage": "https://YOUR_GITHUB_USERNAME.github.io/dss",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

### 6.3 Update vite.config.js

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/dss/', // Replace with your repo name
})
```

### 6.4 Initialize Git Repository

```bash
git init
git add .
git commit -m "Initial commit"
```

### 6.5 Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click "New repository"
3. Repository name: `dss`
4. Make it **Public**
5. **DO NOT** initialize with README
6. Click "Create repository"

### 6.6 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/dss.git
git branch -M main
git push -u origin main
```

### 6.7 Deploy

```bash
npm run deploy
```

### 6.8 Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings**
3. Scroll to **Pages** (left sidebar)
4. Under "Source", select branch: `gh-pages`
5. Click **Save**

Your app will be live at: `https://YOUR_USERNAME.github.io/dss/`

### 6.9 Update Firebase Auth Domain

1. Go to Firebase Console → **Authentication**
2. Click **Settings** tab
3. Scroll to **Authorized domains**
4. Click **Add domain**
5. Add: `YOUR_USERNAME.github.io`
6. Click **Add**

## Step 7: Testing

### 7.1 Test Authentication

- Register a new user
- Login with existing user
- Test password reset

### 7.2 Test Chat

- Send messages in #genel-sohbet
- Verify real-time updates
- Test with multiple browser tabs

### 7.3 Test Admin Panel

- Create a new channel
- Change user roles
- Mute/unmute users
- Delete channels

## Troubleshooting

### Issue: "Firebase: Error (auth/unauthorized-domain)"

**Solution**: Add your domain to Firebase authorized domains (Step 6.9)

### Issue: "Missing or insufficient permissions"

**Solution**: Verify Firestore security rules are deployed correctly (Step 2)

### Issue: Messages not appearing

**Solution**: 
1. Check browser console for errors
2. Verify Firestore rules allow read/write
3. Check if user is muted

### Issue: Admin panel not showing

**Solution**: 
1. Verify user role is "admin" in Firestore
2. Refresh the page after changing role
3. Check browser console for errors

## Project Structure

```
dss/
├── src/
│   ├── components/
│   │   ├── admin/          # Admin panel components
│   │   ├── auth/           # Login, Register, Reset pages
│   │   ├── chat/           # MessageList, MessageInput
│   │   ├── layout/         # Sidebar, UserList
│   │   └── shared/         # Button, Input, Modal
│   ├── context/            # Auth and Data contexts
│   ├── pages/              # MainApp, SettingsModal
│   ├── services/           # Firebase configuration
│   ├── utils/              # Helper functions
│   ├── App.jsx             # Main app component
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── firestore.rules         # Firestore security rules
├── .env                    # Environment variables (create this)
├── .env.example            # Example env file
└── package.json            # Dependencies
```

## Security Best Practices

1. **Never commit `.env` file** - It contains sensitive API keys
2. **Use Firestore Rules** - Always enforce security at the database level
3. **Validate on client** - Check user roles before showing admin UI
4. **Monitor usage** - Check Firebase Console regularly for quota usage
5. **Backup data** - Export Firestore data periodically

## Free Tier Limits

Firebase free tier (Spark Plan) includes:

- **Authentication**: 50,000 MAU (Monthly Active Users)
- **Firestore**: 
  - 1 GB storage
  - 50,000 reads/day
  - 20,000 writes/day
  - 20,000 deletes/day
- **Hosting**: 10 GB storage, 360 MB/day transfer

**Tip**: Monitor usage in Firebase Console → Usage and billing

## Next Steps

- Customize the theme colors in `tailwind.config.js`
- Add more channels via Admin Panel
- Invite users to register
- Set up moderators
- Add custom roles (requires code changes)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Firebase Console logs
3. Check browser console for errors

---

**Congratulations!** Your Meydan Academy chat application is now live! 🎉
