# CreatorFlow MVP plan

## Product goal

Create a demo SaaS for individual creators that lets them sign up, manage content ideas and drafts, choose a platform, schedule demo posts, and view a clearly labelled analytics summary.

## MVP user flow

1. Sign up
2. Log in
3. Complete basic profile
4. Create a content draft
5. Choose a platform and status
6. Set a planned date/time
7. View the item on the calendar
8. Review dashboard summary and analytics demo

## Required screens

- Landing page with Sign up / Log in
- Authentication with validation and secure session handling
- Dashboard with counts for total content, drafts, scheduled posts, and published-demo posts
- Content screen for create / read / update / delete
- Calendar / schedule screen for scheduled posts
- Profile / settings screen with basic profile editing and logout
- Analytics demo screen with a visible Demo data label

## Core data model

### users
- id
- name
- email
- password_hash
- created_at

### content_posts
- id
- user_id
- title
- body
- platform
- status
- scheduled_at
- created_at
- updated_at

## Required statuses

- Idea
- Draft
- Ready
- Scheduled
- Published (demo)
- Cancelled

## Dashboard count rules

- Total content: all content records owned by the logged-in user
- Drafts: records with Draft status
- Scheduled: records with Scheduled status
- Published demo: records with Published (demo) status

## Security and validation requirements

- Hash passwords with bcrypt
- Use secure server-side sessions
- Scope every content query to the authenticated user
- Reject empty title fields
- Reject invalid scheduled dates when status is Scheduled
- Keep user data isolated per account

## Weekly deliverable plan

### Week 1
- Confirm scope and stack
- Set up frontend and backend
- Build landing page, auth UI, dashboard skeleton, and navigation

### Week 2
- Create SQLite schema
- Implement registration, login, logout, and protected routes
- Connect frontend to backend and validate errors

### Week 3
- Build CRUD for content
- Add platform/status fields and scheduled date/time
- Show scheduled items on a calendar or schedule list
- Update counts from database

### Week 4
- Add demo analytics chart and label
- Polish empty/loading/error states
- Run final QA against data-isolation rules
- Write README and setup instructions

## Definition of done

- Users can register, log in, and log out
- Passwords are hashed and not stored in plaintext
- Two accounts cannot access each other’s content
- Content create, edit, and delete actions persist
- Scheduled posts show on the calendar
- Dashboard counts update correctly
- Demo analytics are labelled Demo data
- README and .env.example are included

## Out of scope for MVP

- Real social publishing
- Real OAuth/social account connections
- AI caption generation
- Billing, subscriptions, or team accounts
- Enterprise features or mobile app
