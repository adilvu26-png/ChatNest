# Chatly (React + Vite + Firebase)
1. `npm install`
2. Firebase console: create a project, enable Authentication (Email/Password) and Firestore.
3. Copy `.env.example` to `.env` and paste your web-app config values.
4. Enable Storage, then publish `firestore.rules` (Firestore > Rules) and `storage.rules` (Storage > Rules).
5. `npm run dev`. Register two accounts in two browsers and find each other by email.
Test: ticks (sent, delivered, blue read), typing, reply, edit, delete for me/everyone, online/last seen, unread badge.
