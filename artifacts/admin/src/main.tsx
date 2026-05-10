import { createRoot } from "react-dom/client";
import App from "./App";
import { HostGuard } from "./components/HostGuard";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <HostGuard>
    <App />
  </HostGuard>,
);
