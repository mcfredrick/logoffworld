Log Off: Technical SpecificationsVersion: 1.0
Date: May 4, 2026
Scope: Detailed implementation specs for the Daily Census (MVP), Live Pulse, Daily Audio, and Analytics.

1. System Architecture Overview
The system is designed as a Serverless Ephemeral Architecture to minimize cost, maximize privacy, and ensure data vanishes daily.

Frontend: Static HTML/CSS/JS (No framework required, but React/Vue acceptable if preferred). Hosted on Netlify or GitHub Pages.
Backend Logic: Serverless Functions (Netlify Functions / Vercel Functions) for API endpoints.
Real-Time Layer: WebSocket server (Node.js on a small VPS or managed service like Supabase Realtime / Ably) for the "Live Pulse."
Data Store: Redis (Cloud-hosted, e.g., Upstash) for atomic counters. Data is ephemeral (TTL 24h).
Audio Pipeline: Python script (GitHub Actions) running nightly to generate MP3s.
Analytics: Plausible Analytics (Self-hosted or Cloud).


2. Feature Specifications
2.1. The Daily Census (Frontend)
File Structure:
/public
  /index.html
  /css/style.css
  /js/main.js
  /js/pulse.js
  /assets/
    /sounds/ (optional local fallbacks)
Core Logic (main.js):

Initialization:

Fetch daily_prompt from API (or hardcoded JSON for MVP).
Fetch rebel_phrase and connection_phrase from API (rotated daily).
Initialize WebSocket connection.


State Management:

Store has_voted_today in localStorage (key: pot_has_voted_YYYY-MM-DD).
If true, disable buttons and show "You voted today" message.


Vote Action:

User clicks button -> Send POST request to /api/vote.
Payload: { choice: 'connection' | 'rebel' }.
On success: Set localStorage, disable buttons, trigger local animation.


Polling (Fallback):

If WebSocket fails, poll /api/stats every 5 seconds to update counters.



UI Requirements:

Minimalist Design: Centered card, large typography, ample whitespace.
Mobile First: Buttons must be thumb-friendly (min 44px height).
Accessibility: ARIA labels for buttons, high contrast colors.


2.2. The Live Pulse (Real-Time)
Technology: WebSocket (Socket.io or native WS).
Server-Side Logic (server.js or Netlify Edge Function):

Connection: Accept incoming WebSocket connections.
Event Listener: Listen for vote_cast events from API.
Broadcast:

When a vote is recorded in Redis, emit socket.broadcast.emit('pulse', { type, count }).
Throttling Logic:

Maintain a last_broadcast_time timestamp.
If now - last_broadcast_time < 200ms, skip broadcast (aggregate votes).
If skipped, increment a pending_count.
On next broadcast, send { type, count: pending_count + 1 }.





Client-Side Logic (pulse.js):

Listener: socket.on('pulse', (data) => { ... }).
Animation Trigger:

Create a div element with class floating-pulse.
Set textContent to ☁️ (Connection) or 🥁 (Rebel).
Set left position randomly between 10% and 90%.
Append to body.
Remove element after 2.5s (animation duration).


Counter Update:

Animate the number transition (e.g., countUp library or CSS transition).



CSS (style.css):
@keyframes floatUp {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-150px) scale(1.2); opacity: 0; }
}

.floating-pulse {
  position: fixed;
  bottom: 20px;
  font-size: 2.5rem;
  pointer-events: none;
  z-index: 9999;
  animation: floatUp 2.5s ease-out forwards;
}

2.3. The Ghost Counter (Backend)
Technology: Redis (Upstash).
API Endpoint: POST /api/vote

Input: { choice: string }.
Validation: Check if user has already voted today (check localStorage hash or IP rate limit if needed for bot protection).
Logic:

Get today's date string YYYY-MM-DD.
Increment key vote:{date}:connection or vote:{date}:rebel.
Get total count for both keys.
TTL: Set key expiration to 24 hours from now.


Broadcast: Emit WebSocket event.
Response: { success: true, newCount: int }.

API Endpoint: GET /api/stats

Logic: Fetch current values for vote:{date}:connection and vote:{date}:rebel.
Response: { connection: int, rebel: int, total: int }.


2.4. The Daily Audio Pipeline
Technology: Python (GitHub Actions Cron Job).
Workflow:

Trigger: Runs daily at 00:00 UTC.
Step 1: Fetch Data:

Read prompts.json to get today's prompt.
Read phrases.json to get today's phrases.


Step 2: Generate Reflection:

Call LLM API (e.g., OpenRouter, Anthropic) with prompt:

"Write a 20-second soothing reflection on the topic: '{PROMPT}'. Tone: Warm, human, non-preachy. Max 40 words."




Step 3: Generate Audio:

Call TTS API (e.g., ElevenLabs) with:

Text: "Welcome to Log Off. Today's prompt is: '{PROMPT}'. [Reflection]. Join {COUNT} others who paused today. Be human."
Voice ID: Pre-selected warm voice.


Download MP3.


Step 4: Mix Soundscape:

Use ffmpeg to overlay a royalty-free ambient track (e.g., "Rain on Window") at -20dB volume.
Command: ffmpeg -i voice.mp3 -i rain.mp3 -filter_complex "[0:a][1:a]amix=inputs=2:duration=first" -vn output.mp3.


Step 5: Upload & Publish:

Upload output.mp3 to S3/R2 with filename episode-{YYYY-MM-DD}.mp3.
Update podcast.xml (RSS feed) with new <item> tag.
Commit and push podcast.xml to GitHub (triggers Netlify rebuild).




2.5. Analytics (Plausible)
Configuration:

Script: Insert Plausible script in <head>.
Domain: logoff.world.
Settings:

data-domain="logoff.world"
data-track-outbound-links="true"
data-exclude="*"  (Default: no cookies).



Custom Events:

Event Name: vote_cast
Properties: choice (value: connection or rebel).
Trigger: Fire on successful API response from /api/vote.

Dashboard Goals:

Track vote_cast events per day.
Track referral sources (Twitter, Reddit, etc.).
Track device type (Mobile vs Desktop).


3. Data Models
3.1. Redis Keys
Key PatternValueTTLDescriptionvote:{YYYY-MM-DD}:connectionInteger24hCount of Connection votes today.vote:{YYYY-MM-DD}:rebelInteger24hCount of Rebel votes today.prompt:{YYYY-MM-DD}String30dCached prompt text (optional).
3.2. LocalStorage
KeyValueDescriptionpot_has_voted_{YYYY-MM-DD}truePrevents double voting.pot_last_pulsetimestamp(Optional) Debounce logic.
3.3. JSON Files (Static)

prompts.json: Array of prompt strings.
phrases.json: Object with connection and rebel arrays.
charity.json: Current month's charity info.


4. Security & Privacy Constraints

No PII: No email, name, or IP address stored in Redis or logs.
Rate Limiting:

API: Max 10 requests/minute per IP (prevent bot spam).
WebSocket: Max 1 connection per IP.


CORS: Restrict API calls to logoff.world only.
Content Safety:

Prompt submission form must have a CAPTCHA (e.g., Cloudflare Turnstile).
All submitted prompts go to a "Pending" queue (manual review).




5. Deployment Checklist

 Domain: logoff.world registered and DNS pointed to Netlify.
 Redis: Upstash instance created and API keys configured.
 WebSocket: Server deployed (e.g., Railway, Render, or Supabase).
 TTS/Audio: ElevenLabs API key configured; FFmpeg installed in CI environment.
 Plausible: Account created and script added.
 Ko-fi: Page created with membership tier for recurring support.
 Content: prompts.json and phrases.json populated with 50+ entries.
 Testing:

 Vote increments counter.
 Pulse animation triggers on another tab.
 Data resets at midnight.
 Plausible records custom event.




6. Future Expansion Hooks

Discovery App: Add /app route to Netlify config.
Real Human Thoughts: Add /thoughts route with submission form.
Donor Badge: Add is_patron check to frontend (via Ko-fi webhook).
Multi-language: Add lang param to API to serve localized prompts.
