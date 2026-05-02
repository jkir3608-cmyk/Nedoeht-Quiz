import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface PopupData {
  id: string;
  target: "all" | "host" | { gameId: number; playerId: number };
  mediaType: "image" | "video";
  mediaSrc: string;
  size: "small" | "medium" | "fullscreen";
  duration: number; // seconds, 0 = permanent
  createdAt: number;
}

interface MediaPopupOverlayProps {
  popups: PopupData[];
  onAutoDismiss?: (id: string) => void;
}

const SIZE_CLASS: Record<PopupData["size"], string> = {
  small: "max-w-xs",
  medium: "max-w-xl",
  fullscreen: "w-full h-full max-w-none rounded-none",
};

function SinglePopup({ popup, onAutoDismiss }: { popup: PopupData; onAutoDismiss?: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [countdown, setCountdown] = useState(popup.duration);

  useEffect(() => {
    if (popup.duration <= 0) return;
    setCountdown(popup.duration);
    const countInterval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    timerRef.current = setTimeout(() => {
      onAutoDismiss?.(popup.id);
    }, popup.duration * 1000);
    return () => {
      clearInterval(countInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [popup.id, popup.duration, onAutoDismiss]);

  const isFullscreen = popup.size === "fullscreen";

  return (
    <motion.div
      key={popup.id}
      initial={{ opacity: 0, scale: isFullscreen ? 1 : 0.85, y: isFullscreen ? 0 : 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: isFullscreen ? 1 : 0.9, y: isFullscreen ? 0 : -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={`relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/90 backdrop-blur-md ${SIZE_CLASS[popup.size]} ${isFullscreen ? "w-full h-full" : "w-full"}`}
    >
      {popup.mediaType === "image" ? (
        <img
          src={popup.mediaSrc}
          alt="Admin popup"
          className={`block ${isFullscreen ? "w-full h-full object-contain" : "w-full max-h-[75vh] object-contain"}`}
          draggable={false}
        />
      ) : (
        <video
          src={popup.mediaSrc}
          autoPlay
          loop
          playsInline
          controls
          className={`block ${isFullscreen ? "w-full h-full object-contain" : "w-full max-h-[75vh]"}`}
        />
      )}

      {popup.duration > 0 && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 text-white/80 text-xs font-mono px-2.5 py-1 rounded-full backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {countdown}s
        </div>
      )}
    </motion.div>
  );
}

export function MediaPopupOverlay({ popups, onAutoDismiss }: MediaPopupOverlayProps) {
  if (popups.length === 0) return null;

  const latest = popups[popups.length - 1];
  const isFullscreen = latest.size === "fullscreen";

  return (
    <AnimatePresence>
      <motion.div
        key="overlay-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[9999] flex items-center justify-center ${isFullscreen ? "p-0" : "p-6 sm:p-10"} bg-black/75 backdrop-blur-sm`}
      >
        <SinglePopup popup={latest} onAutoDismiss={onAutoDismiss} />
      </motion.div>
    </AnimatePresence>
  );
}
