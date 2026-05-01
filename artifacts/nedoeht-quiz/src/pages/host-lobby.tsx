import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetGame, useListPlayers } from "@workspace/api-client-react";
import { getGetGameQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useGameWebSocket } from "@/hooks/use-game";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Users, Play, Copy, ArrowLeft, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const DURATION_OPTIONS = [
  { label: "2 min", value: 120 },
  { label: "4 min", value: 240 },
  { label: "6 min", value: 360 },
  { label: "8 min", value: 480 },
  { label: "10 min", value: 600 },
  { label: "15 min", value: 900 },
  { label: "20 min", value: 1200 },
];

export default function HostLobby() {
  const { isLoading: authLoading } = useRequireAuth();
  const params = useParams();
  const gameId = parseInt(params.gameId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: game, isLoading: gameLoading } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) },
  });

  const { data: players } = useListPlayers(gameId, {
    query: {
      enabled: !!gameId,
      queryKey: getListPlayersQueryKey(gameId),
      refetchInterval: 2000,
    },
  });

  const { messages, isConnected, sendMessage } = useGameWebSocket(gameId, "host");
  const [livePlayers, setLivePlayers] = useState<any[]>([]);
  const [duration, setDuration] = useState(480);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (players) setLivePlayers(players);
  }, [players]);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.type === "player-joined") {
      setLivePlayers((prev) => {
        if (prev.find((p) => p.id === (lastMsg as any).player.id)) return prev;
        return [...prev, (lastMsg as any).player];
      });
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
    } else if (lastMsg.type === "player-list") {
      setLivePlayers((lastMsg as any).players);
    }
  }, [messages, gameId, queryClient]);

  const handleStartGame = () => {
    if (livePlayers.length === 0) {
      toast({ title: "Need at least one player to start!", variant: "destructive" });
      return;
    }
    setStarting(true);
    sendMessage({ type: "start-game", duration });
    setTimeout(() => {
      setLocation(`/host/game/${gameId}`);
    }, 400);
  };

  const copyCode = () => {
    if (game?.code) {
      navigator.clipboard.writeText(game.code);
      toast({ title: "Code copied!" });
    }
  };

  if (authLoading || gameLoading || !game) return null;

  const durationMinutes = Math.round(duration / 60);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 text-center">
      <div className="w-full max-w-5xl space-y-10">
        <div className="flex justify-between items-center w-full">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" /> Exit
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`}
            />
            <span className="text-sm font-medium text-muted-foreground">
              {isConnected ? "Live" : "Connecting…"}
            </span>
          </div>
        </div>

        <div className="bg-card border-2 border-primary/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
          <div className="relative z-10 space-y-4">
            <h2 className="text-xl font-bold text-muted-foreground">
              Join at{" "}
              <span className="text-primary">
                {window.location.host}
                {import.meta.env.BASE_URL}join
              </span>{" "}
              with code
            </h2>
            <div
              className="text-8xl md:text-[140px] font-black tracking-widest text-primary drop-shadow-lg cursor-pointer hover:scale-105 transition-transform select-all"
              onClick={copyCode}
            >
              {game.code}
            </div>
            <div className="flex items-center justify-center gap-4 text-base font-medium text-muted-foreground">
              <span>{game.quizTitle}</span>
              <span>•</span>
              <span>Skill/Luck Level {game.skillLuckScale}</span>
              <Button variant="ghost" size="sm" onClick={copyCode} className="gap-1">
                <Copy className="w-3 h-3" /> Copy
              </Button>
            </div>
          </div>
        </div>

        {/* Duration picker */}
        <div className="bg-card border rounded-2xl p-6 text-left space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Clock className="w-5 h-5 text-primary" />
              Game Duration
            </div>
            <span className="text-2xl font-black text-primary">{durationMinutes} min</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${
                  duration === opt.value
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="px-2">
            <Slider
              value={[duration]}
              min={60}
              max={1800}
              step={60}
              onValueChange={(v) => setDuration(v[0])}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1 min</span>
              <span>30 min</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="text-left">
            <h3 className="text-2xl font-bold flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              Players joined
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-lg">
                {livePlayers.length}
              </span>
            </h3>
          </div>

          <Button
            size="lg"
            className="text-xl h-16 px-12 font-bold shadow-[0_4px_0_0_hsl(var(--primary)/0.5)] active:shadow-none active:translate-y-1 transition-all gap-2"
            onClick={handleStartGame}
            disabled={starting}
          >
            <Play className="w-6 h-6 fill-current" />
            {starting ? "Starting…" : "Start Game"}
          </Button>
        </div>

        <div className="bg-card/50 border rounded-2xl p-6 min-h-[180px]">
          {livePlayers.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground py-8">
              No players yet — share the code above!
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 justify-center">
              <AnimatePresence>
                {livePlayers.map((player) => (
                  <motion.div
                    key={player.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="px-5 py-2.5 rounded-xl text-base font-bold shadow-md border-b-4 border-black/10"
                    style={{
                      backgroundColor: player.avatarColor || "hsl(var(--primary))",
                      color: "white",
                    }}
                  >
                    {player.nickname}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
