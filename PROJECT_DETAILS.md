# MEYDAN ACADEMY - Project Details

## 📌 Project Overview

**Meydan Academy** is a Discord-like web chat application built entirely with free Firebase services and deployable to GitHub Pages. It features real-time messaging, role-based access control, and a comprehensive admin panel.

## 🛠️ Technologies Used

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Icons** - Icon library (Font Awesome, Material Design)

### Backend & Services
- **Firebase Authentication** - Email/Password auth
- **Firestore Database** - Real-time NoSQL database
- **Firebase Storage** - File storage (optional)

### State Management
- **React Context API** - Global state management
  - `AuthContext` - Authentication state
  - `DataContext` - Real-time data listeners

### Utilities
- **clsx** - Conditional class names
- **tailwind-merge** - Merge Tailwind classes
- **date-fns** - Date formatting

### Deployment
- **GitHub Pages** - Static site hosting
- **gh-pages** - Deployment tool

## 📁 Complete File Structure

```
dss/
├── public/
│   └── vite.svg
├── src/
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── admin/
│   │   │   └── AdminPanel.jsx          # Admin dashboard with tabs
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx           # Email/password login
│   │   │   ├── RegisterPage.jsx        # User registration
│   │   │   └── ResetPasswordPage.jsx   # Password reset
│   │   ├── chat/
│   │   │   ├── MessageInput.jsx        # Message input with mute check
│   │   │   └── MessageList.jsx         # Real-time message display
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx             # Server & channel navigation
│   │   │   └── UserList.jsx            # Online users with roles
│   │   └── shared/
│   │       ├── Button.jsx              # Reusable button component
│   │       ├── Input.jsx               # Reusable input component
│   │       └── Modal.jsx               # Reusable modal component
│   ├── context/
│   │   ├── AuthContext.jsx             # Auth state & methods
│   │   └── DataContext.jsx             # Real-time data listeners
│   ├── pages/
│   │   ├── MainApp.jsx                 # Main chat interface
│   │   └── SettingsModal.jsx           # User settings & logout
│   ├── services/
│   │   └── firebase.js                 # Firebase configuration
│   ├── utils/
│   │   └── helpers.js                  # Utility functions
│   ├── App.jsx                         # Root component with routing
│   ├── main.jsx                        # Entry point
│   └── index.css                       # Global styles + Tailwind
├── .env.example                        # Environment variables template
├── .gitignore                          # Git ignore rules
├── firestore.rules                     # Firestore security rules
├── index.html                          # HTML template
├── package.json                        # Dependencies & scripts
├── postcss.config.js                   # PostCSS configuration
├── README.md                           # Project README
├── SETUP_GUIDE.md                      # Detailed setup instructions
├── tailwind.config.js                  # Tailwind configuration
└── vite.config.js                      # Vite configuration
```

## 🔥 Firestore Database Schema

### Collections

#### 1. `servers`
```javascript
{
  id: "default-server",
  name: "MEYDAN ACADEMY",
  iconUrl: "",
  createdAt: Timestamp
}
```

#### 2. `channels`
```javascript
{
  id: "auto-generated",
  name: "genel-sohbet",
  serverId: "default-server",
  type: "text",
  description: "Genel sohbet kanalı",
  createdAt: Timestamp
}
```

#### 3. `users`
```javascript
{
  id: "user-uid",
  displayName: "User Name",
  email: "user@example.com",
  photoUrl: "",
  role: "member" | "moderator" | "admin",
  createdAt: Timestamp,
  isBanned: false,
  isMuted: false
}
```

#### 4. `channels/{channelId}/messages` (Subcollection)
```javascript
{
  id: "auto-generated",
  text: "Message content",
  userId: "user-uid",
  timestamp: ServerTimestamp
}
```

#### 5. `roles` (Optional - for future expansion)
```javascript
{
  id: "role-id",
  name: "Custom Role",
  color: "#ff0000",
  permissions: {
    canDeleteMessage: true,
    canMuteUsers: false,
    // ... more permissions
  }
}
```

## 🔒 Firestore Security Rules

The complete security rules are in `firestore.rules`. Key features:

- **Authentication Required**: All operations require `request.auth != null`
- **Role-Based Access**:
  - Admins: Full access to all collections
  - Moderators: Can delete messages, update user mute status
  - Members: Can create messages (if not muted), read all data
- **User Creation**: Users can only create their own user document
- **Mute Check**: Muted users cannot create messages

## 🎨 UI Design & Theme

### Color Palette (Dark Theme)

```javascript
colors: {
  dark: {
    bg: '#1e1f22',        // Main background
    sidebar: '#2b2d31',   // Sidebar background
    hover: '#35373c',     // Hover states
    input: '#383a40',     // Input backgrounds
    text: '#dbdee1',      // Primary text
    muted: '#949ba4',     // Secondary text
  },
  brand: {
    primary: '#5865f2',   // Primary brand color
    hover: '#4752c4',     // Primary hover
  },
  admin: '#f23f42',       // Admin role color
  moderator: '#faa81a',   // Moderator role color
  member: '#80848e',      // Member role color
}
```

### Key UI Features

- **Fully Responsive**: Works on mobile, tablet, and desktop
- **Dark Theme**: Easy on the eyes for long chat sessions
- **Role Badges**: Visual indicators for user roles
- **Real-time Updates**: Messages appear instantly
- **Custom Scrollbar**: Styled to match dark theme
- **Smooth Transitions**: Hover effects and animations

## 🔐 Authentication System

### Features
- Email/Password registration and login
- Password reset via email
- Automatic user profile creation
- Role assignment (default: "member")
- Auth state persistence

### User Flow
1. User registers with email/password
2. User document created in Firestore with "member" role
3. User can login and access chat
4. Admin can promote users to "moderator" or "admin"

## 💬 Chat Features

### Real-time Messaging
- Messages update in real-time using Firestore listeners
- Auto-scroll to latest message
- Message history (last 100 messages)
- Timestamp display with relative time

### User Experience
- Type and send messages
- See who sent each message
- View user roles next to names
- Muted users cannot send messages

## 🛡️ Admin Panel Features

### User Management
- View all registered users
- Change user roles (admin, moderator, member)
- Mute/unmute users
- Ban/unban users
- View user details (email, role, status)

### Channel Management
- Create new text channels
- Delete existing channels
- View channel list
- (Future: Edit channel descriptions)

### Server Information
- View server name
- See total user count
- See total channel count
- (Future: Edit server settings)

## 📦 Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "firebase": "^11.1.0",
    "react-router-dom": "^7.1.1",
    "react-icons": "^5.4.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.3",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "gh-pages": "^6.2.0"
  }
}
```

## 🚀 Deployment Instructions

### Local Development
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
```

### Deploy to GitHub Pages
```bash
npm run deploy
```

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed deployment instructions.

## 🔑 Environment Variables

Required environment variables (in `.env`):

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 📊 Firebase Free Tier Optimization

### Strategies Used
1. **Limit Message History**: Only load last 100 messages per channel
2. **Efficient Listeners**: Use targeted queries instead of full collection scans
3. **Denormalization**: Store minimal user info to reduce reads
4. **Client-side Caching**: Use React Context to cache user/channel data
5. **No Cloud Functions**: All logic handled client-side

### Expected Usage (for ~50 active users)
- **Reads**: ~5,000-10,000/day
- **Writes**: ~1,000-2,000/day
- **Storage**: < 100 MB

Well within free tier limits!

## 🎯 Role Permissions

### Admin
- ✅ All moderator permissions
- ✅ Create/delete channels
- ✅ Change user roles
- ✅ Access admin panel
- ✅ Ban/unban users
- ✅ Edit server settings

### Moderator
- ✅ All member permissions
- ✅ Delete any message
- ✅ Mute/unmute users
- ✅ View user reports

### Member
- ✅ Send messages (if not muted)
- ✅ Edit own messages
- ✅ View all channels
- ✅ View user list

## 🐛 Known Limitations

1. **No File Uploads**: To stay on free tier, file uploads are not implemented
2. **No Voice/Video**: Text chat only
3. **Single Server**: Only one server (MEYDAN ACADEMY)
4. **No DMs**: No direct messaging between users
5. **No Notifications**: No push notifications
6. **No Search**: No message search functionality

These can be added in future versions if needed.

## 🔮 Future Enhancements

### Possible Additions
- [ ] Message editing/deletion for users
- [ ] User avatars with upload
- [ ] Emoji reactions
- [ ] Message search
- [ ] User profiles
- [ ] Direct messages
- [ ] Voice channels (requires paid tier)
- [ ] File sharing (requires paid tier)
- [ ] Custom roles with permissions
- [ ] User status (online/offline)
- [ ] Typing indicators

## 📝 Code Quality

### Best Practices Used
- **Component Modularity**: Each component has a single responsibility
- **Reusable Components**: Button, Input, Modal used throughout
- **Context for State**: Avoids prop drilling
- **Error Handling**: Try-catch blocks for Firebase operations
- **Security First**: Firestore rules enforce all permissions
- **Responsive Design**: Mobile-first approach
- **Clean Code**: Consistent naming and formatting

## 🎓 Learning Resources

To understand this codebase:
1. **React**: [react.dev](https://react.dev)
2. **Firebase**: [firebase.google.com/docs](https://firebase.google.com/docs)
3. **Tailwind CSS**: [tailwindcss.com](https://tailwindcss.com)
4. **Firestore Security Rules**: [firebase.google.com/docs/firestore/security/get-started](https://firebase.google.com/docs/firestore/security/get-started)

## 📞 Support & Maintenance

### Monitoring
- Check Firebase Console regularly for:
  - Authentication errors
  - Firestore usage
  - Security rule violations

### Backup
- Export Firestore data monthly
- Keep Firebase config backed up securely

### Updates
- Update dependencies quarterly
- Monitor Firebase SDK updates
- Test thoroughly before deploying

## ✅ Project Checklist

- [x] Firebase Authentication (Email/Password)
- [x] Firestore Database with security rules
- [x] Real-time chat functionality
- [x] Role-based access control
- [x] Admin panel (user, channel, server management)
- [x] Dark theme UI
- [x] Fully responsive design
- [x] GitHub Pages deployment ready
- [x] Complete documentation
- [x] Environment variables setup
- [x] Free tier optimized

## 🎉 Conclusion

This project is a **complete, production-ready** Discord-like chat application that:
- Uses only **free Firebase services**
- Deploys to **GitHub Pages** at no cost
- Includes **comprehensive admin tools**
- Has **role-based permissions**
- Features a **modern, dark-themed UI**
- Is **fully documented** for easy setup

Perfect for communities, study groups, or small teams! 🚀

---

**Built with ❤️ using React, Firebase, and Tailwind CSS**
