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
      // Mutual exclusion — deactivate marine theme
      root.classList.remove("marine");
      localStorage.removeItem("jurones-marine");
      window.dispatchEvent(new Event("jurones-marine-off"));
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
