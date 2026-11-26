# AI Communication Coach (OnTrac)

Voice practice app for spoken client communication. Learners talk to "Clara", an ElevenLabs voice agent that runs client role-plays and scores them 0-4 on clarity & structure, tone & empathy, choice of words, confidence & presence, and data storytelling (managers) or influence (ADs/directors). Scores appear on a live dashboard with progress over time.

- Stack: Vite + React + `@elevenlabs/react`
- Agent: `agent_0901m8b37vz8f5tveyy15xbdt8jx` (public; set in `src/main.tsx`)
- Scores arrive through the agent's `show_results` client tool
- History is stored in the browser's localStorage
- Demo data: open the site with `?demo=1`

```
npm install
npm run dev
```
