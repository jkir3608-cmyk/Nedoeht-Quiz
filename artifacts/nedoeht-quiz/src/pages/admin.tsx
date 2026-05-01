import { useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetRecentGames, useListPlayers, useUpdatePlayer, useKickPlayer, getGetRecentGamesQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameWebSocket } from "@/hooks/use-game";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Coins, Trash2, ChevronLeft, Users, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";

const ADMIN_PASSWORD = "2026BIOlogy!";

function formatTime(s: number) {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.max(0, s) % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function TimerControls({ gameId }: { gameId: number }) {
  const { toast } = useToast();
  const { sendMessage, isConnected } = useGameWebSocket(gameId, "host");
  const [newSeconds, setNewSeconds] = useState("");

  const handleSet = (e: React.FormEvent) => {
    e.preventDefault();
    const secs = parseInt(newSeconds);
    if (isNaN(secs) || secs < 0) return;
    sendMessage({ type: "admin-adjust-timer", password: ADMIN_PASSWORD, newSeconds: secs });
    toast({ title: `Timer set to ${formatTime(secs)}` });
    setNewSeconds("");
  };

  return (
    <div className="space-y-3 p-4 bg-muted/30 rounded-xl border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Clock className="w-4 h-4 text-primary" /> Adjust Game Timer
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${isConnected ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
          {isConnected ? "Connected" : "Connecting…"}
        </span>
      </div>
      <form onSubmit={handleSet} className="flex gap-2">
        <Input
          type="number"
          placeholder="Seconds (e.g. 300)"
          value={newSeconds}
          onChange={e => setNewSeconds(e.target.value)}
          className="flex-1 h-9 text-sm"
        />
        <Button type="submit" size="sm">Set</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {[60, 120, 300, 480, 600].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => {
              sendMessage({ type: "admin-adjust-timer", password: ADMIN_PASSWORD, newSeconds: s });
              toast({ title: `Timer set to ${formatTime(s)}` });
            }}
            className="px-3 py-1 text-xs rounded-full border border-border hover:border-primary/50 hover:text-primary transition-all"
          >
            {formatTime(s)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { isLoading: authLoading } = useRequireAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [editingCoins, setEditingCoins] = useState<Record<number, string>>({});

  const { data: recentGames, isLoading: gamesLoading } = useGetRecentGames({
    query: { queryKey: getGetRecentGamesQueryKey(), enabled: isAuthed },
  });

  const { data: players, isLoading: playersLoading } = useListPlayers(selectedGameId ?? 0, {
    query: { queryKey: getListPlayersQueryKey(selectedGameId ?? 0), enabled: !!selectedGameId },
  });

  const updatePlayer = useUpdatePlayer();
  const kickPlayer = useKickPlayer();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthed(true);
    } else {
      toast({ title: "Wrong password", variant: "destructive" });
      setPassword("");
    }
  };

  const handleSaveCoins = (playerId: number) => {
    if (!selectedGameId) return;
    const val = parseInt(editingCoins[playerId] ?? "0");
    if (isNaN(val)) return;
    updatePlayer.mutate({ gameId: selectedGameId, playerId, data: { coins: val, adminPassword: ADMIN_PASSWORD } }, {
      onSuccess: () => {
        toast({ title: "Coins updated" });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(selectedGameId) });
        setEditingCoins(prev => { const n = { ...prev }; delete n[playerId]; return n; });
      },
      onError: () => toast({ title: "Failed to update coins", variant: "destructive" }),
    });
  };

  const handleKick = (playerId: number) => {
    if (!selectedGameId) return;
    kickPlayer.mutate({ gameId: selectedGameId, playerId }, {
      onSuccess: () => {
        toast({ title: "Player removed" });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(selectedGameId) });
      },
    });
  };

  if (authLoading) return null;

  return (
    <div className="container py-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10 text-primary">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">Manage player coins and game sessions</p>
        </div>
      </div>

      {!isAuthed ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="max-w-sm mx-auto">
            <CardHeader>
              <CardTitle>Admin Access Required</CardTitle>
              <CardDescription>Enter the admin password to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                <Input
                  type="password"
                  placeholder="Admin password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                />
                <Button type="submit" className="w-full">Unlock</Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          {!selectedGameId ? (
            <motion.div key="games" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-xl font-bold mb-4">Select a Game Session</h2>
              {gamesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading games…
                </div>
              ) : recentGames && recentGames.length > 0 ? (
                <div className="space-y-3">
                  {recentGames.map(game => (
                    <motion.div key={game.id} whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400 }}>
                      <Card
                        className="cursor-pointer hover:border-primary/60 transition-colors"
                        onClick={() => setSelectedGameId(game.id)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{game.quizTitle}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {game.playerCount} players</span>
                              <span>{format(new Date(game.createdAt), "MMM d, yyyy")}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${game.status === "active" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                                {game.status}
                              </span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">Manage</Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  No games found. Host a game first.
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="players" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" className="gap-2 -ml-2" onClick={() => setSelectedGameId(null)}>
                  <ChevronLeft className="w-4 h-4" /> Back to games
                </Button>
                <h2 className="text-xl font-bold">Player Management</h2>
              </div>

              {(() => {
                const selectedGame = recentGames?.find(g => g.id === selectedGameId);
                if (selectedGame?.status === "playing") {
                  return <TimerControls gameId={selectedGameId!} />;
                }
                return null;
              })()}

              {playersLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading players…
                </div>
              ) : players && players.length > 0 ? (
                <div className="space-y-3">
                  {[...players].sort((a, b) => b.coins - a.coins).map((player, idx) => (
                    <Card key={player.id} className={player.isKicked ? "opacity-50" : ""}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-700" : "bg-muted-foreground"}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{player.nickname}</p>
                          {player.isKicked && <p className="text-xs text-destructive">Kicked</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Coins className="w-4 h-4 text-yellow-400" />
                          <Input
                            type="number"
                            className="w-24 text-right"
                            value={editingCoins[player.id] ?? player.coins}
                            onChange={e => setEditingCoins(prev => ({ ...prev, [player.id]: e.target.value }))}
                            disabled={player.isKicked}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveCoins(player.id)}
                            disabled={player.isKicked || editingCoins[player.id] === undefined || updatePlayer.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleKick(player.id)}
                            disabled={player.isKicked}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  No players in this game.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
