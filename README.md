# NaijaCorper  Frontend

**The social network for the NYSC journey.**

NaijaCorper connects prospective, serving and former corps members so they can share, discover, connect, trade, learn and find opportunities throughout the NYSC journey. This repository contains the **frontend** of the product, built with React and Vite.

> This is the frontend layer. It talks to the NaijaCorper backend API (`https://api.naijacorper.com/api/v1`). Opportunities, Events, PPA reviews, State guides and the Assistant still use sample data because the backend has no endpoints for them yet.

---

## ✨ Features

The frontend is organised around six core areas, plus supporting screens.

### Core areas
- **Home**  Personalized social feed with For you / Following / National / State tabs, post composer, likes, comments, reposts, quote posts, polls and saves.
- **Explore**  Discover useful places nearby (accommodation, food, transport, hospitals, ATMs, printing and more) with community recommendations, ratings and tips.
- **Community**  State/national conversations, trending topics and interest-based groups.
- **Marketplace**  Buy, sell and rent within the corps community, with categories, a create-listing form and message-seller flow.
- **Opportunities** Jobs, internships, scholarships and training, with detail view and apply.
- **AI Assistant** An NYSC and service-year helper for common questions (camp, relocation, CDS, documents).

### Supporting screens
- **Onboarding** Journey-based flow (preparing / serving / completed) → stage, state, service info, interests, follow suggestions and an optional first post.
- **Profiles**  Bio, skills, professional info, followers/following, Posts / Replies / Media / About tabs and edit profile.
- **Post detail**  Full post view with replies.
- **Messaging**  One-to-one conversations with a chat view.
- **Notifications**  Likes, comments, follows, messages, opportunities and events.
- **Events**, **PPA reviews**, **State guides**, and **Search** (people, posts, places, opportunities).
- **Content moderation** Report, mute and block accounts; delete your own posts.

---

## 🛠️ Tech Stack

- **React 19**
- **Vite** (build tool + dev server)
- **React Router** for navigation
- **lucide-react** for icons
- **axios** (ready for API integration)
- Plain CSS with a shared design-token system

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- npm (comes with Node.js)

### Installation

Clone the repository and switch to the frontend branch:

```bash
git clone https://github.com/naijacorper1-ops/Naijacorper.git
cd Naijacorper
git checkout frontend
```

Install dependencies:

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Then open the URL shown in the terminal (usually **http://localhost:5173**).

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

---

## 📁 Project Structure

```
src/
├── assets/                 # Images and static assets
├── components/
│   ├── assistant/          # AI assistant modal
│   ├── layout/             # Navbar, sidebar and page layout
│   ├── post/               # Post card and composer
│   └── ui/                 # Modal, toast, avatar, follow button, report dialog, list states
├── context/                # Signed-in user, toasts, composer, unread badges
├── data/                   # Sample data for screens without backend endpoints
├── lib/                    # API client (api.js), paging hook, formatting helpers
├── features/
│   ├── home/               # Social feed
│   ├── explore/            # Explore + place detail
│   ├── community/          # Community and groups
│   ├── marketplace/        # Marketplace
│   ├── opportunities/      # Jobs and opportunities
│   ├── events/             # Events
│   ├── ppa/                # PPA reviews
│   ├── guides/             # State guides
│   ├── profile/            # User profiles
│   ├── post/               # Post detail + comments
│   ├── messages/           # Messaging
│   ├── notifications/      # Notifications
│   ├── search/             # Search results
│   └── onboarding/         # Onboarding flow
├── App.jsx                 # Routes
├── App.css                 # Component styles
├── index.css               # Base styles and design tokens
└── main.jsx                # App entry point
```

---

## 📝 Notes

- **Backend connection:** `npm run dev` forwards `/api/v1` to the live API through the Vite proxy (`vite.config.js`), and Vercel does the same in production (`vercel.json`). The base path comes from `VITE_API_BASE_URL` in `.env.local`.
- **Authentication:** Sign up → email code (`/verify-email`) → onboarding. Sessions use a 15-minute access token plus a refresh cookie; `src/lib/api.js` refreshes the token automatically.
- **Messages** refresh every few seconds. The backend also offers a Socket.IO channel (`/messaging`) for instant delivery; adding `socket.io-client` would be the next step.

---

## 📌 Roadmap

Following the product roadmap:

- **MVP** — Identity, social feed, community, explore, marketplace, messaging, onboarding ✅ (frontend built)
- **Phase 2** — PPA reviews, state guides, events, professional profiles, better discovery ✅ (frontend built)
- **Phase 3** — AI Assistant, advanced recruitment, premium features

---

*Built as part of the NaijaCorper project.*
