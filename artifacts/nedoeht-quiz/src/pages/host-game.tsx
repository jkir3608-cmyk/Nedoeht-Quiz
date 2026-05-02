import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetGame, useListPlayers } from "@workspace/api-client-react";
import { getGetGameQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useGameWebSocket } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Users, StopCircle, ShieldAlert, Coins, Clock } from "lucide-react";

const ADMIN_PASSWORD = "2026BIOlogy!";

function formatTime(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const RANK_STYLES = [
  "bg-yellow-500 text-white shadow-lg shadow-yellow-500/40",
  "bg-gray-300 text-gray-800",
  "bg-amber-600 text-white",
];

export default function HostGame() {
  const { isLoading: authLoading } = useRequireAuth();
  const params = useParams();
  const gameId = parseInt(params.gameId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: game, isLoading: gameLoading } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) },
  });

  const { data: initialPlayers } = useListPlayers(gameId, {
    query: { enabled: !!gameId, queryKey: getListPlayersQueryKey(gameId) },
  });

  const { messages, isConnected, sendMessage } = useGameWebSocket(gameId, "host");

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [liveLeaderboard, setLiveLeaderboard] = useState<any[]>([]);
  const [gameStarted, setGameStarted] = useState(false);

  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [newTimerSeconds, setNewTimerSeconds] = useState("");

  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (initialPlayers && liveLeaderboard.length === 0) {
      setLiveLeaderboard(initialPlayers.map((p) => ({ ...p })));
    }
  }, [initialPlayers]);

  useEffect(() => {
    if (messages.length === 0) return;
    const msg = messages[messages.length - 1];

    if (msg.type === "game-started") {
      setGameStarted(true);
      setEndsAt((msg as any).endsAt);
      setTimeRemaining((msg as any).remainingSeconds);
    } else if ((msg as any).type === "timer") {
      setTimeRemaining((msg as any).remaining);
      setEndsAt((msg as any).endsAt);
    } else if (msg.type === "leaderboard") {
      setLiveLeaderboard((msg as any).players);
    } else if (msg.type === "player-joined") {
      setLiveLeaderboard((prev) => {
        if (prev.find((p) => p.id === (msg as any).player.id)) return prev;
        return [...prev, (msg as any).player];
      });
    } else if (msg.type === "player-list") {
      setLiveLeaderboard((msg as any).players);
    } else if (msg.type === "coins-updated") {
      setLiveLeaderboard((prev) =>
        prev.map((p) =>
          p.id === (msg as any).playerId ? { ...p, coins: (msg as any).coins } : p,
        ),
      );
    } else if (msg.type === "player-kicked") {
      setLiveLeaderboard((prev) => prev.filter((p) => p.id !== (msg as any).playerId));
    } else if (msg.type === "game-ended") {
      setLocation(`/results/${gameId}`);
    }
  }, [messages, gameId, setLocation]);

  useEffect(() => {
    if (timeRemaining === null) return;
    if (localTimerRef.current) clearInterval(localTimerRef.current);
    localTimerRef.current = setInterval(() => {
      if (endsAt) {
        const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
        setTimeRemaining(remaining);
      }
    }, 500);
    return () => {
      if (localTimerRef.current) clearInterval(localTimerRef.current);
    };
  }, [endsAt]);

  const handleEndGame = () => {
    sendMessage({ type: "start-game", duration: 0 });
    setLocation(`/results/${gameId}`);
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdminAuth(true);
      toast({ title: "Admin access granted" });
    } else {
      toast({ title: "Incorrect password", variant: "destructive" });
      setAdminPassword("");
    }
  };

  const handleAdjustTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const secs = parseInt(newTimerSeconds);
    if (isNaN(secs) || secs < 0) return;
    sendMessage({ type: "admin-adjust-timer", password: ADMIN_PASSWORD, newSeconds: secs });
    toast({ title: `Timer set to ${formatTime(secs)}` });
    setNewTimerSeconds("");
  };

  const timerColor =
    timeRemaining === null
      ? "text-muted-foreground"
      : timeRemaining > 60
      ? "text-green-400"
      : timeRemaining > 20
      ? "text-yellow-400"
      : "text-red-400 animate-pulse";

  const sortedBoard = [...liveLeaderboard].sort((a: any, b: any) => b.coins - a.coins);

  if (authLoading || gameLoading) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b px-6 py-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-lg font-bold">{game?.quizTitle}</h2>
          <p className="text-muted-foreground text-xs">
            Code: <span className="font-mono text-primary font-bold">{game?.code}</span>
            {" · "}Level {game?.skillLuckScale}
            {" · "}
            <span className={`font-mono font-bold ${isConnected ? "text-green-400" : "text-red-400"}`}>
              {isConnected ? "●" : "○"} {isConnected ? "Live" : "Connecting"}
            </span>
          </p>
        </div>

        <div className="flex gap-3 items-center">
          <div className={`text-center ${timerColor}`}>
            <div className="text-3xl font-black font-mono tabular-nums">
              {timeRemaining !== null ? formatTime(timeRemaining) : "––:––"}
            </div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">remaining</div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 border-primary/40 text-primary hover:bg-primary/10">
                <ShieldAlert className="w-4 h-4" /> Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary" /> Admin Panel
                </DialogTitle>
              </DialogHeader>

              {!isAdminAuth ? (
                <form onSubmit={handleAdminAuth} className="space-y-4 py-2">
                  <Input
                    type="password"
                    placeholder="Admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" className="w-full">Unlock</Button>
                </form>
              ) : (
                <div className="space-y-6 py-2">
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Adjust Timer</p>
                    <form onSubmit={handleAdjustTimer} className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Seconds (e.g. 120)"
                        value={newTimerSeconds}
                        onChange={(e) => setNewTimerSeconds(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="submit">Set</Button>
                    </form>
                    <div className="flex flex-wrap gap-2">
                      {[60, 120, 300, 480].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            sendMessage({ type: "admin-adjust-timer", password: ADMIN_PASSWORD, newSeconds: s });
                            toast({ title: `Timer set to ${formatTime(s)}` });
                          }}
                          className="px-3 py-1.5 rounded-full text-sm border border-border hover:border-primary/50 hover:text-primary transition-all"
                        >
                          {formatTime(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Button variant="destructive" size="sm" onClick={handleEndGame} className="gap-1">
            <StopCircle className="w-4 h-4" /> End
          </Button>
        </div>
      </div>

      {/* Body: leaderboard LEFT + center RIGHT */}
      <div className="flex-1 flex gap-0 overflow-hidden">

        {/* ─── LEFT: Leaderboard ─── */}
        <div className="w-80 xl:w-96 bg-card border-r flex flex-col shadow-xl shrink-0">
          <div className="px-5 pt-5 pb-3 border-b">
            <h3 className="text-base font-black flex items-center gap-2 uppercase tracking-wide">
              <Users className="w-4 h-4 text-primary" /> Leaderboard
              <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                {liveLeaderboard.length} players
              </span>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <AnimatePresence>
              {sortedBoard.map((player: any, idx: number) => (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                    idx === 0
                      ? "bg-yellow-500/10 border-yellow-500/40"
                      : idx === 1
                      ? "bg-gray-400/10 border-gray-400/20"
                      : idx === 2
                      ? "bg-amber-700/10 border-amber-700/20"
                      : "bg-muted/10 border-border"
                  }`}
                >
                  {/* Rank badge */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                      idx < 3 ? RANK_STYLES[idx] : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {/* Avatar emoji */}
                  <div className="text-2xl shrink-0 leading-none">{player.avatar ?? "🐱"}</div>

                  {/* Name + stats */}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate leading-tight">{player.nickname}</div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      {player.correctAnswers ?? 0}/{player.totalAnswers ?? 0} correct
                    </div>
                  </div>

                  {/* Coins — Blooket-style badge */}
                  <motion.div
                    key={`${player.id}-${player.coins}`}
                    initial={{ scale: 1.25 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-1 bg-yellow-400/15 border border-yellow-400/40 rounded-full px-2.5 py-1 font-black text-base text-yellow-300 shrink-0 font-mono"
                  >
                    🪙 {player.coins}
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>

            {liveLeaderboard.length === 0 && (
              <div className="text-center text-muted-foreground py-10 text-sm">
                Waiting for players…
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Center content ─── */}
        <div className="flex-1 flex flex-col bg-background p-8 overflow-hidden">
          {!gameStarted ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Clock className="w-16 h-16 mx-auto text-primary animate-pulse" />
                <h2 className="text-2xl font-bold text-muted-foreground">Waiting for game to start…</h2>
                <p className="text-muted-foreground">Game will begin once you press Start in the lobby.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-10">
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-2">Game in Progress</h2>
                <p className="text-muted-foreground text-lg">
                  Players are answering at their own pace
                </p>
              </div>

              {/* Giant countdown */}
              <div className={`text-center ${timerColor}`}>
                <motion.div
                  key={timeRemaining !== null ? Math.floor(timeRemaining / 10) : "idle"}
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-8xl xl:text-9xl font-black font-mono tabular-nums drop-shadow-lg leading-none"
                >
                  {timeRemaining !== null ? formatTime(timeRemaining) : "––:––"}
                </motion.div>
                <p className="text-xl text-muted-foreground mt-3 uppercase tracking-widest font-bold">
                  Time Remaining
                </p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-5 text-center w-full max-w-lg">
                <div className="bg-card rounded-2xl p-5 border shadow">
                  <div className="text-4xl font-black text-primary">{liveLeaderboard.length}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Players</div>
                </div>
                <div className="bg-card rounded-2xl p-5 border shadow">
                  <div className="text-4xl font-black text-yellow-400">
                    {liveLeaderboard.reduce((s: number, p: any) => s + (p.totalAnswers || 0), 0)}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Answers</div>
                </div>
                <div className="bg-card rounded-2xl p-5 border shadow">
                  <div className="text-4xl font-black text-green-400">
                    {liveLeaderboard.reduce((s: number, p: any) => s + (p.correctAnswers || 0), 0)}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Correct</div>
                </div>
              </div>

              {/* Top 3 podium preview */}
              {sortedBoard.length >= 2 && (
                <div className="w-full max-w-lg">
                  <p className="text-xs text-center text-muted-foreground uppercase tracking-widest font-bold mb-3">Top 3</p>
                  <div className="flex gap-3 justify-center">
                    {sortedBoard.slice(0, 3).map((p: any, idx: number) => (
                      <div key={p.id} className={`flex flex-col items-center gap-1 px-4 py-3 rounded-2xl border flex-1 max-w-[120px] ${
                        idx === 0 ? "bg-yellow-500/10 border-yellow-500/40" :
                        idx === 1 ? "bg-gray-400/10 border-gray-400/20" :
                        "bg-amber-700/10 border-amber-700/20"
                      }`}>
                        <div className="text-3xl">{p.avatar ?? "🐱"}</div>
                        <div className="font-bold text-xs truncate w-full text-center max-w-[90px]">{p.nickname}</div>
                        <div className="flex items-center gap-1 text-xs font-black text-yellow-400">
                          <Coins className="w-3 h-3" />{p.coins}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
