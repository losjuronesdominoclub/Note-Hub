import { useEffect, useState } from "react";

const KEY = "jurones-marine";

export function useMarineTheme() {
  const [marine, setMarine] = useState(() => {
    const stored = localStorage.getItem(KEY) === "true";
    if (stored) document.documentElement.classList.add("marine");
    return stored;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (marine) {
      root.classList.add("marine");
      // Mutual exclusion — deactivate purple and lime themes
      root.classList.remove("purple");
      root.classList.remove("lime");
      localStorage.removeItem("jurones-purple");
      localStorage.removeItem("jurones-lime");
      window.dispatchEvent(new Event("jurones-purple-off"));
      window.dispatchEvent(new Event("jurones-lime-off"));
    } else {
      root.classList.remove("marine");
    }
    localStorage.setItem(KEY, String(marine));
  }, [marine]);

  // Listen for purple activating so we deactivate ourselves
  useEffect(() => {
    const handler = () => setMarine(false);
    window.addEventListener("jurones-marine-off", handler);
    return () => window.removeEventListener("jurones-marine-off", handler);
  }, []);

  return { marine, toggle: () => setMarine((m) => !m) };
}
