# Hilton Head Timeshares App — Phase 1 Build

## Stack
- Convex (backend/DB/auth/file storage)
- Vite + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Mapbox GL JS (interactive maps)
- Vercel (hosting)
- Resend (transactional email)
- @convex-dev/auth (authentication)

## Staging
- URL: hht.leadworksstaging.com
- Vercel project on team_3VSHYmWfrmZxN88r1NCVFUih
- GitHub: ScottRegan29928/hht-app

## Phase 1 Tasks

### 1. Project Scaffolding
- [x] Create project directory
- [ ] Initialize package.json with all dependencies
- [ ] Vite config, TypeScript config, Tailwind config
- [ ] shadcn/ui setup
- [ ] Convex schema design
- [ ] Basic routing setup

### 2. Data Model (Convex Schema)
- [ ] communities table (name, slug, description, amenities, mapCenter, siteMapUrl, floorPlanUrl)
- [ ] properties table (address, community, bedrooms, bathrooms, photos, features, amenities, mapCoords)
- [ ] weeks table (propertyId, weekNumber, price, notes, status)
- [ ] inquiries table (type: purchase/rental, propertyId, name, email, phone, message, status)

### 3. WordPress Data Migration
- [ ] Scrape all property pages via WP REST API
- [ ] Extract: address, community, beds/baths, features, photos, weeks
- [ ] Create seed script for Convex

### 4. Core Pages
- [ ] Home page — hero, map, community cards
- [ ] Community page — overview, amenities, map, listings grid
- [ ] Property detail page — photo gallery, features, weeks table, inquiry CTAs
- [ ] Search/filter page — by community, week number, bedrooms, price

### 5. Interactive Map (Mapbox)
- [ ] Full-island map on homepage with community cluster pins
- [ ] Community-level zoomed maps
- [ ] Click pin → property popup → link to detail page

### 6. Inquiry Forms
- [ ] "Make an Offer" form → email to Lighthouse Realty
- [ ] "Book a Rental" form → email to The Club Group (asutton@cglhhi.com)
- [ ] Store inquiries in Convex

### 7. Infrastructure
- [ ] GitHub repo creation
- [ ] Vercel project setup
- [ ] Domain configuration (hht.leadworksstaging.com)
- [ ] Mapbox public key setup

## Inquiry Email Routing
- Purchase → @lighthouserealtyhhi.com (TBD exact address)
- Rental → asutton@cglhhi.com
