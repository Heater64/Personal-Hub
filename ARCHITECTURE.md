# Personal Hub — Architecture

Multi-page PWA hosted on Firebase Hosting. Each feature is an independent HTML+CSS+JS unit. No SPA router — navigation is native browser navigation + Service Worker cache.

## Folder Structure

```
/
├── index.html                 # Entry point / home page
├── login.html                 # Auth page
├── offline.html               # Offline fallback
├── manifest.json              # PWA manifest
├── sw.js                      # Service Worker (stale-while-revalidate / network-first)
├── firebase.json              # Hosting config
│
├── css/                       # Global styles
│   ├── main.css               # Entry point — imports base + components
│   ├── base/
│   │   ├── variables.css      # Design tokens (colors, spacing, radii, shadows)
│   │   ├── reset.css          # CSS reset
│   │   ├── typography.css     # Font faces + type scale
│   │   ├── utilities.css      # Utility classes
│   │   └── animations.css     # Centralized keyframes (fadeIn, modalPop, etc.)
│   └── components/            # Shared UI components
│       ├── buttons.css        # btn-primary, btn-secondary, back-btn, fab, etc.
│       ├── cards.css          # .card, .section-card, .close-modal
│       ├── forms.css          # form-group, form-input, form-select, form-textarea
│       ├── modal.css          # Modal overlay, sizes, header/body/footer
│       ├── toast.css          # Toast notifications (success/error/warning/info)
│       ├── navbar.css         # Top navigation bar
│       ├── sidebar.css        # Side navigation
│       ├── skeleton.css       # Loading skeleton
│       ├── sub-nav.css        # Tab navigation (sub-nav, sub-tab, sub-view)
│       └── day-counter.css    # Day counter widget
│
├── features/                  # Feature modules (each = HTML + CSS + JS)
│   ├── home/                  # Dashboard / hub grid
│   ├── calendario/            # Calendar + gift system
│   ├── canciones/             # Songs
│   ├── sentimientos/          # Feelings tracker
│   ├── razones/               # Reasons
│   ├── rincon/                # Personal space (gallery, memes, San Juan Pueblo)
│   ├── series/                # TV series tracker
│   ├── ia/                    # AI lab
│   ├── openwhen/              # Open when letters
│   ├── maldia/                # Bad day assistant
│   ├── thoseeyes/             # Those eyes feature
│   ├── admin/                 # Admin panel
│   └── ositos/                # Independent design system (DO NOT MODIFY)
│
├── services/                  # Backend services
│   ├── firebase/
│   │   └── firebase-config.js # Firebase initialization (DO NOT MODIFY)
│   ├── firestore/
│   │   └── firestore.service.js  # Base Firestore CRUD (getDoc, setDoc, etc.)
│   ├── config/
│   │   └── config.service.js     # Config data reads with cache (news, songs, etc.)
│   ├── progress/
│   │   └── progress.service.js   # User progress CRUD (calendar, series, etc.)
│   ├── analytics/
│   │   └── analytics.js       # Event tracking
│   └── sync/
│       └── sync.js            # Offline sync queue
│
├── shared/                    # Shared utilities & components
│   ├── utils/
│   │   ├── core.js            # showToast() legacy, escapeHtml(), etc.
│   │   ├── authGuard.js       # Auth redirect logic
│   │   ├── profile.js         # User profile utils
│   │   ├── gameSession.js     # Game session management
│   │   └── lifecycle.js       # Cleanup manager (register/destroy)
│   ├── navigation/
│   │   ├── sidebar.js         # Sidebar with NAV_ITEMS
│   │   ├── swipe-nav.js       # Swipe gesture navigation
│   │   └── sentimientos-nav.js # Sentiment pages nav bar
│   ├── dialogs/
│   │   ├── modalSystem.js     # Unified Modal (title, content, sizes, callbacks)
│   │   └── toast.js           # Toast system (success/error/warning/info)
│   └── components/
│       └── dom.js             # el() and escapeHtml() DOM helpers
│
├── assets/                    # Static assets (images, icons)
├── games/                     # Self-contained games (inline styles, standalone)
└── experiences/               # Experience modules (cassette, polaroid, etc.)
```

## CSS Architecture

`css/main.css` is the single entry point imported by all HTML pages:

```css
@import url('base/reset.css');
@import url('base/variables.css');
@import url('base/typography.css');
@import url('base/utilities.css');
@import url('base/animations.css');
@import url('components/buttons.css');
/* ... other components ... */
```

Each feature also imports its own CSS file (e.g., `rincon/rincon.css`).

**Key principle**: Feature CSS should only contain styles unique to that feature. Shared patterns (buttons, forms, cards, modals, toasts) live in `css/components/`.

## JS Service Layer

Three IIFE services for backend communication:

- **FirestoreService** (`services/firestore/`): Base CRUD — `getDoc()`, `setDoc()`, `updateDoc()`, `deleteDoc()`, `addDoc()`, `getDocs()`, `onSnapshot()`
- **ConfigService** (`services/config/`): Reads config data (news, songs, reasons, gifts, series) with in-memory cache. Save methods write through to Firestore.
- **ProgressService** (`services/progress/`): User progress CRUD (calendar, series, sidebar prefs).

All services use `FirestoreService.getDB()` internally. No direct Firestore access from feature JS.

## Shared Dialogs

- **Modal** (`shared/dialogs/modalSystem.js`): `Modal.open({ title, content, size, onClose })` / `Modal.close()` / `Modal.isOpen()`
- **Toast** (`shared/dialogs/toast.js`): `Toast.success(msg)`, `Toast.error(msg)`, etc. Legacy `showToast()` in `core.js` delegates to Toast.

## Lifecycle

`shared/utils/lifecycle.js` provides cleanup registration:
```js
Lifecycle.register(() => { /* cleanup */ });
// Auto-runs on beforeunload/pagehide
```

## Feature Structure

Each feature follows this pattern:
```
features/myfeature/
├── myfeature.html     # Page markup
├── myfeature.css      # Feature-specific styles
├── myfeature.js       # Feature logic
└── data.js            # Optional: static data
```

HTML loads: `css/main.css` + feature CSS + Firebase SDKs + `firebase-config.js` + shared utils + sidebar + feature JS.

## Navigation

- **Sidebar** (`shared/navigation/sidebar.js`): Single sidebar instance, populated from `NAV_ITEMS`. Toggle via hamburger button.
- **Swipe Nav** (`shared/navigation/swipe-nav.js`): Horizontal swipe between feature pages.
- **Back Button** (`.back-btn` in `css/components/buttons.css`): Returns to home. Hidden on desktop.

## Service Worker

`sw.js` uses two strategies:
- **Network-first** for HTML pages (4s timeout, falls back to cache → `/index.html`)
- **Stale-while-revalidate** for static assets (CSS, JS, images)

`PRECACHE_URLS` lists all critical files for offline support. Bump `CACHE_VERSION` when adding new files.

## Rules

1. **No SPA router** — each feature is a standalone page
2. **ositos-world is independent** — never modify `features/ositos/`
3. **Games are standalone** — inline styles, no shared CSS
4. **No behavior changes** in refactoring — only structure/modularity
5. **Firebase config is sacred** — never change `firebase-config.js`
6. **All new shared code** goes in `shared/` or `services/`, not duplicated per feature
