import { Link, useParams } from "wouter";
import { useGetGame, useListPlayers } from "@workspace/api-client-react";
import { getGetGameQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Home, Plus, Star, Target, Zap, Medal } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect, useState } from "react";

function fireConfetti() {
  const colors = ["#a855f7", "#ec4899", "#f59e0b", "#22c55e", "#3b82f6", "#f97316"];

  // Burst from centre
  confetti({ particleCount: 120, spread: 80, origin: { x: 0.5, y: 0.5 }, colors, scalar: 1.3 });

  // Side cannons
  setTimeout(() => {
    confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors });
  }, 300);

  setTimeout(() => {
    confetti({ particleCount: 40, angle: 60, spread: 45, origin: { x: 0 }, colors });
    confetti({ particleCount: 40, angle: 120, spread: 45, origin: { x: 1 }, colors });
  }, 700);
}

const MEDAL_COLORS = [
  { bg: "from-yellow-400 to-amber-500", border: "border-yellow-400", glow: "shadow-yellow-500/50", text: "text-yellow-900", icon: "🥇" },
  { bg: "from-slate-300 to-slate-400",  border: "border-slate-300",  glow: "shadow-slate-400/40",  text: "text-slate-900",  icon: "🥈" },
  { bg: "from-amber-600 to-amber-700",  border: "border-amber-600",  glow: "shadow-amber-600/40",  text: "text-amber-100",  icon: "🥉" },
];

const PODIUM_HEIGHTS = ["h-32", "h-24", "h-16"];
const PODIUM_ORDER = [1, 0, 2]; // render order: 2nd, 1st, 3rd

export default function GameResults() {
  const params = useParams();
  const gameId = parseInt(params.gameId || "0");

  const [phase, setPhase] = useState<"suspense" | "reveal" | "done">("suspense");

  const { data: game } = useGetGame(gameId, { query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) } });
  const { data: players } = useListPlayers(gameId, { query: { enabled: !!gameId, queryKey: getListPlayersQueryKey(gameId) } });

  const sorted = [...(players ?? [])].sort((a, b) => b.coins - a.coins);
  const top3 = PODIUM_ORDER.map(i => sorted[i]).filter(Boolean);
  const rest = sorted.slice(3);

  useEffect(() => {
    if (!players || players.length === 0) return;
    const t1 = setTimeout(() => setPhase("reveal"), 1800);
    const t2 = setTimeout(() => { setPhase("done"); fireConfetti(); }, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [players]);

  const maxCoins = sorted[0]?.coins || 1;
  const accuracy = (p: typeof sorted[0]) => {
    if (!p) return 0;
    const total = (p as any).totalAnswers ?? 0;
    const correct = (p as any).correctAnswers ?? 0;
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden relative flex flex-col items-center p-6 pb-24">
      {/* Background radial glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/25 via-background to-background pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-3xl space-y-8">

        {/* ── Title ── */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center pt-4 space-y-2"
        >
          <div className="flex justify-center mb-2">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.15, 1.15, 1.15, 1.15, 1] }}
              transition={{ delay: 2.5, duration: 0.7 }}
            >
              <Trophy className="w-14 h-14 text-yellow-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.7)]" />
            </motion.div>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60">
            Game Over!
          </h1>
          {game?.quizTitle && (
            <p className="text-muted-foreground text-lg font-medium">{game.quizTitle}</p>
          )}
        </motion.div>

        {/* ── Suspense overlay ── */}
        <AnimatePresence>
          {phase === "suspense" && (
            <motion.div
              key="suspense"
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="text-6xl mb-6"
              >
                🏆
              </motion.div>
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="text-2xl font-black text-primary tracking-widest uppercase"
              >
                Calculating Results…
              </motion.p>
              <div className="flex gap-2 mt-6">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{ y: [0, -12, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Podium ── */}
        <AnimatePresence>
          {phase !== "suspense" && sorted.length > 0 && (
            <motion.div
              key="podium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center items-end gap-3 md:gap-6 px-4"
              style={{ height: 280 }}
            >
              {PODIUM_ORDER.map((rank, renderIdx) => {
                const player = sorted[rank];
                if (!player) return <div key={rank} className="flex-1 max-w-28" />;
                const medal = MEDAL_COLORS[rank];
                const isFirst = rank === 0;
                const delay = renderIdx === 1 ? 0.9 : renderIdx === 0 ? 0.5 : 0.2;

                return (
                  <motion.div
                    key={player.id}
                    initial={{ y: 120, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay, type: "spring", stiffness: 120, damping: 14 }}
                    className={`flex flex-col items-center ${isFirst ? "w-32 md:w-40 z-10" : "w-24 md:w-32"}`}
                  >
                    {/* Crown for 1st */}
                    {isFirst && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.3 }}
                        className="text-3xl mb-1"
                      >
                        👑
                      </motion.div>
                    )}

                    {/* Avatar bubble */}
                    <div className={`${isFirst ? "text-5xl w-16 h-16" : "text-4xl w-12 h-12"} rounded-full bg-card border-2 ${medal.border} flex items-center justify-center mb-2 shadow-lg ${medal.glow} shadow-xl`}>
                      {player.avatar ?? "🐱"}
                    </div>

                    {/* Name + coins */}
                    <p className={`font-black truncate w-full text-center mb-1 ${isFirst ? "text-base text-primary" : "text-sm"}`}>
                      {player.nickname}
                    </p>
                    <p className="font-mono font-bold text-yellow-400 text-sm mb-2">🪙 {player.coins}</p>

                    {/* Podium block */}
                    <div className={`w-full bg-gradient-to-b ${medal.bg} ${PODIUM_HEIGHTS[rank]} rounded-t-xl border-2 ${medal.border} flex flex-col items-center justify-center gap-1 shadow-lg ${medal.glow} shadow-xl relative overflow-hidden`}>
                      <span className={`text-2xl font-black ${medal.text} opacity-60`}>{rank + 1}</span>
                      <span className="text-lg">{medal.icon}</span>
                      {/* Shine effect */}
                      <div className="absolute top-0 left-0 right-0 h-1/3 bg-white/20 rounded-t-xl" />
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats strip (top 3) ── */}
        {phase === "done" && sorted.slice(0, 3).map((player, i) => (
          <motion.div
            key={player.id + "-stats"}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="hidden"
          />
        ))}

        {/* ── Full leaderboard ── */}
        {phase !== "suspense" && sorted.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            className="space-y-2"
          >
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
              <Star className="w-3.5 h-3.5" /> Full Rankings
            </h2>

            {sorted.map((player, idx) => {
              const barWidth = Math.max(4, Math.round((player.coins / maxCoins) * 100));
              const acc = accuracy(player);
              const medal = idx < 3 ? MEDAL_COLORS[idx] : null;

              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.5 + idx * 0.07 }}
                  className={`relative rounded-2xl border overflow-hidden ${
                    medal
                      ? `border-opacity-60 bg-card/80 border-${idx === 0 ? "yellow-400/40" : idx === 1 ? "slate-400/40" : "amber-600/40"}`
                      : "border-border/40 bg-card/40"
                  }`}
                >
                  {/* Coin bar background */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ delay: 1.6 + idx * 0.07, duration: 0.7, ease: "easeOut" }}
                    className={`absolute inset-0 rounded-2xl ${
                      idx === 0 ? "bg-yellow-400/10" :
                      idx === 1 ? "bg-slate-400/8" :
                      idx === 2 ? "bg-amber-600/10" :
                      "bg-primary/5"
                    }`}
                  />

                  <div className="relative flex items-center gap-3 px-4 py-3">
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      idx === 0 ? "bg-yellow-400 text-yellow-900" :
                      idx === 1 ? "bg-slate-400 text-slate-900" :
                      idx === 2 ? "bg-amber-600 text-amber-100" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {idx < 3 ? ["🥇","🥈","🥉"][idx] : idx + 1}
                    </div>

                    {/* Avatar */}
                    <span className="text-2xl shrink-0">{player.avatar ?? "🐱"}</span>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate ${idx === 0 ? "text-yellow-400" : ""}`}>{player.nickname}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {acc}% accuracy
                        </span>
                        {(player as any).correctAnswers !== undefined && (
                          <span>{(player as any).correctAnswers ?? 0}/{(player as any).totalAnswers ?? 0} correct</span>
                        )}
                      </div>
                    </div>

                    {/* Coins */}
                    <div className="shrink-0 text-right">
                      <p className="font-mono font-black text-yellow-400 text-lg">🪙 {player.coins}</p>
                      {idx < 3 && (
                        <p className={`text-xs font-bold ${medal ? medal.text.replace("text-", "text-") : ""} opacity-70`}>
                          {idx === 0 ? "🏆 Champion" : idx === 1 ? "⭐ Runner-up" : "🎖️ 3rd Place"}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ── Game stats ── */}
        {phase !== "suspense" && sorted.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0 }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              { icon: <Trophy className="w-5 h-5 text-yellow-400" />, label: "Players", value: sorted.length },
              { icon: <Zap className="w-5 h-5 text-primary" />, label: "Top coins", value: `🪙 ${sorted[0]?.coins ?? 0}` },
              { icon: <Medal className="w-5 h-5 text-secondary" />, label: "Avg coins", value: `🪙 ${Math.round(sorted.reduce((s, p) => s + p.coins, 0) / sorted.length)}` },
            ].map(({ icon, label, value }, i) => (
              <div key={i} className="rounded-2xl bg-card/50 border border-border/40 p-4 text-center">
                <div className="flex justify-center mb-1">{icon}</div>
                <p className="text-xl font-black">{value}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Actions ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2 }}
          className="flex justify-center gap-4 pt-4"
        >
          <Button asChild size="lg" className="h-14 px-8 text-lg font-bold gap-2">
            <Link href="/dashboard"><Home className="w-5 h-5" /> Dashboard</Link>
          </Button>
          {game?.quizId && (
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg font-bold gap-2">
              <Link href={`/host/${game.quizId}`}><Plus className="w-5 h-5" /> Play Again</Link>
            </Button>
          )}
        </motion.div>

      </div>
    </div>
  );
}
