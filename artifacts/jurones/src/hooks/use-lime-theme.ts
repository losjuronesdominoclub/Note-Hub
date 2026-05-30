import { useEffect, useState } from "react";

const KEY = "jurones-lime";

export function useLimeTheme() {
  const [lime, setLime] = useState(() => {
    const stored = localStorage.getItem(KEY) === "true";
    if (stored) document.documentElement.classList.add("lime");
    return stored;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (lime) {
      root.classList.add("lime");
      // Mutual exclusion — deactivate marine and purple
      root.classList.remove("marine");
      root.classList.remove("purple");
      localStorage.removeItem("jurones-marine");
      localStorage.removeItem("jurones-purple");
      window.dispatchEvent(new Event("jurones-marine-off"));
      window.dispatchEvent(new Event("jurones-purple-off"));
    } else {
      root.classList.remove("lime");
    }
    localStorage.setItem(KEY, String(lime));
  }, [lime]);

  // Listen for marine or purple activating so we deactivate ourselves
  useEffect(() => {
    const handler = () => setLime(false);
    window.addEventListener("jurones-lime-off", handler);
    return () => window.removeEventListener("jurones-lime-off", handler);
  }, []);

  return { lime, toggle: () => setLime((l) => !l) };
}
