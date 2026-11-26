import React from "react";
import ReactDOM from "react-dom/client";
import { ConversationProvider } from "@elevenlabs/react";
import App from "./App";
import "./styles.css";

export const AGENT_ID = "agent_0901m8b37vz8f5tveyy15xbdt8jx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConversationProvider agentId={AGENT_ID}>
      <App />
    </ConversationProvider>
  </React.StrictMode>
);
