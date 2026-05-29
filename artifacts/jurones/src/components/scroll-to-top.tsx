import React, { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full flex items-center justify-center shadow-lg transition-colors hover:brightness-125 active:scale-95"
          style={{ background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.08)" }}
          aria-label="Volver arriba"
        >
          <ChevronUp className="h-5 w-5 text-white" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
