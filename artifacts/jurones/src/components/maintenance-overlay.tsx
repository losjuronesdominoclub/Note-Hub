import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LockKeyhole } from "lucide-react";

const STORAGE_KEY = "jurones_maintenance_unlocked";
const SECRET_CODE = "110880";

export default function MaintenanceOverlay() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showInput]);

  const handleOverlayClick = () => {
    setShowInput(true);
    setCode("");
    setError(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === SECRET_CODE) {
      localStorage.setItem(STORAGE_KEY, "1");
      setDismissed(true);
    } else {
      setError(true);
      setCode("");
      setTimeout(() => setError(false), 1200);
    }
  };

  const handleKeyChange = (val: string) => {
    setError(false);
    setCode(val.replace(/\D/g, "").slice(0, 6));
  };

  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center select-none"
      style={{ cursor: "default" }}
    >
      {/* Logo / icon area */}
      <div className="flex flex-col items-center gap-6 px-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-white/5 blur-3xl scale-150" />
          <div className="relative p-5 rounded-full bg-white/5 border border-white/10">
            <LockKeyhole className="w-10 h-10 text-white/60" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white uppercase">
            App no disponible
          </h1>
          <p className="text-white/30 text-xs uppercase tracking-[0.25em] font-medium">
            Los Jurones Domino Club
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!showInput ? (
            <motion.button
              key="tap"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={handleOverlayClick}
              className="mt-4 text-white/15 text-[11px] uppercase tracking-widest font-semibold hover:text-white/30 transition-colors"
            >
              · · ·
            </motion.button>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="flex flex-col items-center gap-3 mt-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="• • • • • •"
                className={`w-40 text-center text-xl font-black tracking-[0.4em] bg-transparent border-b-2 pb-1 outline-none text-white placeholder:text-white/20 transition-colors ${
                  error ? "border-red-500 text-red-400" : "border-white/20 focus:border-white/50"
                }`}
              />
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-xs font-semibold uppercase tracking-widest"
                >
                  Código incorrecto
                </motion.p>
              )}
              <button
                type="submit"
                disabled={code.length < 1}
                className="mt-1 text-white/40 text-[11px] uppercase tracking-widest font-semibold hover:text-white/60 transition-colors disabled:opacity-20"
              >
                Ingresar
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
