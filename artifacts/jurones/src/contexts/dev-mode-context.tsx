import React, { createContext, useContext, useState } from "react";

interface DevModeContextValue {
  isDevMode: boolean;
  enableDevMode: () => void;
  disableDevMode: () => void;
}

const DevModeContext = createContext<DevModeContextValue>({
  isDevMode: false,
  enableDevMode: () => {},
  disableDevMode: () => {},
});

export function DevModeProvider({ children }: { children: React.ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(false);

  return (
    <DevModeContext.Provider
      value={{
        isDevMode,
        enableDevMode: () => setIsDevMode(true),
        disableDevMode: () => setIsDevMode(false),
      }}
    >
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  return useContext(DevModeContext);
}
