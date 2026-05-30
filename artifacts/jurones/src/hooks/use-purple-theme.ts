import { useEffect, useState } from "react";

const KEY = "jurones-purple";

export function usePurpleTheme() {
  const [purple, setPurple] = useState(() => {
    const stored = localStorage.getItem(KEY) === "true";
    if (stored) document.documentElement.classList.add("purple");
    return stored;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (purple) {
      root.classList.add("purple");
      // Mutual exclusion — deactivate marine and lime themes
      root.classList.remove("marine");
      root.classList.remove("lime");
      localStorage.removeItem("jurones-marine");
      localStorage.removeItem("jurones-lime");
      window.dispatchEvent(new Event("jurones-marine-off"));
      window.dispatchEvent(new Event("jurones-lime-off"));
    } else {
      root.classList.remove("purple");
    }
    localStorage.setItem(KEY, String(purple));
  }, [purple]);

  // Listen for marine activating so we deactivate ourselves
  useEffect(() => {
    const handler = () => setPurple(false);
    window.addEventListener("jurones-purple-off", handler);
    return () => window.removeEventListener("jurones-purple-off", handler);
  }, []);

  return { purple, toggle: () => setPurple((p) => !p) };
}
