import React from "react";
import { Link } from "wouter";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useMarineTheme } from "@/hooks/use-marine-theme";
import { usePurpleTheme } from "@/hooks/use-purple-theme";
import { useLimeTheme } from "@/hooks/use-lime-theme";
import { Button } from "@/components/ui/button";
import FloatingMenu from "./floating-menu";
import logoPath from "@assets/logo_1779907396869.png";
import { Show } from "@clerk/react";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { marine, toggle: toggleMarine } = useMarineTheme();
  const { purple, toggle: togglePurple } = usePurpleTheme();
  const { lime, toggle: toggleLime } = useLimeTheme();

  return (
    <header className="sticky top-0 z-40 w-full glass-card border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
          <img src={logoPath} alt="Los Jurones Logo" className="h-10 w-auto" />
          <span className="font-bold text-xl tracking-tight hidden sm:inline-block">LOS JURONES</span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Marine theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMarine}
            title={marine ? "Desactivar tema Marine" : "Activar tema Marine"}
            className="rounded-full relative"
            style={marine ? {
              background: "linear-gradient(135deg, #0d2d5c 0%, #006080 100%)",
              boxShadow: "0 0 10px rgba(0,229,255,0.45)",
            } : {}}
          >
            <span
              className="h-[1.2rem] w-[1.2rem] rounded-full flex items-center justify-center transition-all"
              style={{
                background: marine
                  ? "linear-gradient(135deg, #00b4d8, #0d2d5c)"
                  : "#0d2d5c",
                border: `2px solid ${marine ? "#00e5ff" : "#1e4080"}`,
              }}
            >
              {marine && <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />}
            </span>
            <span className="sr-only">Toggle Marine</span>
          </Button>

          {/* Purple theme toggle — same size, right next to Marine */}
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePurple}
            title={purple ? "Desactivar tema Purple" : "Activar tema Purple"}
            className="rounded-full relative"
            style={purple ? {
              background: "linear-gradient(135deg, #34005e 0%, #530296 100%)",
              boxShadow: "0 0 10px rgba(248,183,40,0.5)",
            } : {}}
          >
            <span
              className="h-[1.2rem] w-[1.2rem] rounded-full flex items-center justify-center transition-all"
              style={{
                background: purple
                  ? "linear-gradient(135deg, #530296, #8b21e8)"
                  : "#530296",
                border: `2px solid ${purple ? "#F8B728" : "#7B2FBE"}`,
              }}
            >
              {purple && <span className="h-1.5 w-1.5 rounded-full bg-yellow-300 animate-pulse" />}
            </span>
            <span className="sr-only">Toggle Purple</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="rounded-full"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          <Show when="signed-out">
            <Link href="/sign-in" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
              Entrar
            </Link>
          </Show>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 md:py-10 flex flex-col">
        {children}
      </main>
      <FloatingMenu />
    </div>
  );
}
