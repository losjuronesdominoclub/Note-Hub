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
    } else {
      root.classList.remove("marine");
    }
    localStorage.setItem(KEY, String(marine));
  }, [marine]);

  return { marine, toggle: () => setMarine((m) => !m) };
}
