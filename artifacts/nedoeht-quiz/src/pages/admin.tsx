import { useState, useEffect, useRef, useCallback } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetRecentGames, useListPlayers, useUpdatePlayer, useKickPlayer, getGetRecentGamesQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameWebSocket } from "@/hooks/use-game";
import type { PopupData } from "@/components/media-popup";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Coins, Trash2, ChevronLeft, Users, Loader2, Clock, Image, Video, Link2, Monitor, User, Globe, X, Play, Maximize2, AlignCenter, AlignJustify } from "lucide-react";
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
        <Input type="number" placeholder="Seconds (e.g. 300)" value={newSeconds} onChange={e => setNewSeconds(e.target.value)} className="flex-1 h-9 text-sm" />
        <Button type="submit" size="sm">Set</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {[60, 120, 300, 480, 600].map(s => (
          <button key={s} type="button"
            onClick={() => { sendMessage({ type: "admin-adjust-timer", password: ADMIN_PASSWORD, newSeconds: s }); toast({ title: `Timer set to ${formatTime(s)}` }); }}
            className="px-3 py-1 text-xs rounded-full border border-border hover:border-primary/50 hover:text-primary transition-all"
          >{formatTime(s)}</button>
        ))}
      </div>
    </div>
  );
}

type SourceMode = "image-upload" | "image-url" | "video-url";
type SizeOption = "small" | "medium" | "fullscreen";
type TargetOption = "all" | "host" | "player";

function MediaPopupPanel({ gameId, players }: { gameId: number; players: any[] }) {
  const { toast } = useToast();
  const { sendMessage, messages, isConnected } = useGameWebSocket(gameId, "host");
  const [popups, setPopups] = useState<PopupData[]>([]);

  const [sourceMode, setSourceMode] = useState<SourceMode>("image-upload");
  const [mediaSrc, setMediaSrc] = useState("");
  const [previewSrc, setPreviewSrc] = useState("");
  const [target, setTarget] = useState<TargetOption>("all");
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [size, setSize] = useState<SizeOption>("medium");
  const [duration, setDuration] = useState("0");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didFetchPopups = useRef(false);

  // On connect, fetch active popups once
  useEffect(() => {
    if (isConnected && !didFetchPopups.current) {
      didFetchPopups.current = true;
      sendMessage({ type: "get-active-popups", password: ADMIN_PASSWORD });
    }
  }, [isConnected, sendMessage]);

  // Handle WS messages
  useEffect(() => {
    if (messages.length === 0) return;
    const msg = messages[messages.length - 1] as any;
    if (msg.type === "active-popups") {
      setPopups(msg.popups as PopupData[]);
    } else if (msg.type === "popup-created") {
      setPopups(prev => [...prev.filter(p => p.id !== msg.popup.id), msg.popup as PopupData]);
      setSending(false);
      toast({ title: "Popup sent!" });
    } else if (msg.type === "popup-dismissed") {
      setPopups(prev => prev.filter(p => p.id !== msg.popupId));
    }
  }, [messages, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setMediaSrc(dataUrl);
      setPreviewSrc(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (url: string) => {
    setMediaSrc(url);
    setPreviewSrc(url);
  };

  const handleSend = () => {
    if (!mediaSrc) { toast({ title: "No media selected", variant: "destructive" }); return; }
    const finalTarget = target === "player" ? (targetPlayerId ? "player" : "all") : target;
    setSending(true);
    sendMessage({
      type: "admin-media-popup",
      password: ADMIN_PASSWORD,
      mediaSrc,
      mediaType: sourceMode === "video-url" ? "video" : "image",
      target: finalTarget,
      targetPlayerId: target === "player" ? targetPlayerId : undefined,
      size,
      duration: parseInt(duration) || 0,
    });
  };

  const handleDismiss = (popupId: string) => {
    sendMessage({ type: "admin-dismiss-popup", password: ADMIN_PASSWORD, popupId });
  };

  const targetLabel = (p: PopupData) => {
    if (p.target === "all") return "All connected";
    if (p.target === "host") return "Host screens";
    return `Player #${(p.target as any).playerId}`;
  };

  return (
    <div className="mt-6 space-y-4 p-4 bg-muted/20 rounded-xl border border-primary/20">
      <div className="flex items-center gap-2 font-bold text-sm text-primary">
        <Image className="w-4 h-4" /> Media Popup
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isConnected ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
          {isConnected ? "Connected" : "Connecting…"}
        </span>
      </div>

      {/* Source mode tabs */}
      <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs font-medium">
        {([["image-upload", <Image className="w-3.5 h-3.5" />, "Upload Image"] as const,
          ["image-url", <Link2 className="w-3.5 h-3.5" />, "Image URL"] as const,
          ["video-url", <Video className="w-3.5 h-3.5" />, "Video URL"] as const,
        ]).map(([mode, icon, label]) => (
          <button key={mode} type="button"
            onClick={() => { setSourceMode(mode as SourceMode); setMediaSrc(""); setPreviewSrc(""); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 transition-colors ${sourceMode === mode ? "bg-primary text-white" : "hover:bg-muted/60"}`}
          >{icon}{label}</button>
        ))}
      </div>

      {/* Source input */}
      {sourceMode === "image-upload" ? (
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border/60 rounded-xl p-6 text-center text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
          >
            {previewSrc ? (
              <img src={previewSrc} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain" />
            ) : (
              <><Image className="w-8 h-8 mx-auto mb-2 opacity-50" /><span>Click to upload image</span></>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder={sourceMode === "video-url" ? "https://example.com/video.mp4" : "https://example.com/image.jpg"}
            value={mediaSrc}
            onChange={e => handleUrlChange(e.target.value)}
            className="h-9 text-sm"
          />
          {previewSrc && sourceMode === "image-url" && (
            <img src={previewSrc} alt="preview" className="max-h-28 rounded-lg object-contain border border-border/60" />
          )}
          {previewSrc && sourceMode === "video-url" && (
            <video src={previewSrc} className="max-h-28 rounded-lg border border-border/60" controls muted />
          )}
        </div>
      )}

      {/* Target */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Show on screen of</p>
        <div className="flex gap-2 flex-wrap">
          {([["all", <Globe className="w-3.5 h-3.5" />, "All Players"] as const,
            ["host", <Monitor className="w-3.5 h-3.5" />, "Host Only"] as const,
            ["player", <User className="w-3.5 h-3.5" />, "Specific Player"] as const,
          ]).map(([t, icon, label]) => (
            <button key={t} type="button" onClick={() => setTarget(t as TargetOption)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${target === t ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}
            >{icon}{label}</button>
          ))}
        </div>
        {target === "player" && players.length > 0 && (
          <select
            className="w-full h-8 text-sm rounded-lg border border-border bg-background px-2"
            value={targetPlayerId ?? ""}
            onChange={e => setTargetPlayerId(Number(e.target.value) || null)}
          >
            <option value="">— pick a player —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.nickname} ({p.coins} coins)</option>)}
          </select>
        )}
      </div>

      {/* Size */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Size</p>
        <div className="flex gap-2">
          {([["small", <AlignCenter className="w-3.5 h-3.5" />, "Small"] as const,
            ["medium", <AlignJustify className="w-3.5 h-3.5" />, "Medium"] as const,
            ["fullscreen", <Maximize2 className="w-3.5 h-3.5" />, "Fullscreen"] as const,
          ]).map(([s, icon, label]) => (
            <button key={s} type="button" onClick={() => setSize(s as SizeOption)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${size === s ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}
            >{icon}{label}</button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Auto-close after</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {[["0", "Permanent"], ["5", "5 sec"], ["10", "10 sec"], ["30", "30 sec"], ["60", "1 min"]].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setDuration(val)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${duration === val ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}
              >{label}</button>
            ))}
          </div>
          <Input type="number" min="0" placeholder="Custom (s)" value={duration} onChange={e => setDuration(e.target.value)} className="w-24 h-7 text-xs text-center" />
        </div>
      </div>

      {/* Send button */}
      <Button onClick={handleSend} disabled={!mediaSrc || sending} className="w-full gap-2 bg-gradient-to-r from-primary to-secondary border-0">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {sending ? "Sending…" : "Show Popup"}
      </Button>

      {/* Active popups list */}
      {popups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Active Popups ({popups.length})</p>
          {popups.map(popup => (
            <div key={popup.id} className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border/60">
              {popup.mediaType === "image" ? (
                <img src={popup.mediaSrc} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-bold truncate capitalize">{popup.size} · {targetLabel(popup)}</p>
                <p className="text-muted-foreground">{popup.duration > 0 ? `${popup.duration}s auto-close` : "Permanent"}</p>
              </div>
              <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleDismiss(popup.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => popups.forEach(p => handleDismiss(p.id))}
          >
            <X className="w-3 h-3" /> Dismiss All
          </Button>
        </div>
      )}
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
          <p className="text-muted-foreground">Manage player coins, game sessions and media popups</p>
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
                <Input type="password" placeholder="Admin password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
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
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading games…</div>
              ) : recentGames && recentGames.length > 0 ? (
                <div className="space-y-3">
                  {recentGames.map(game => (
                    <motion.div key={game.id} whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400 }}>
                      <Card className="cursor-pointer hover:border-primary/60 transition-colors" onClick={() => setSelectedGameId(game.id)}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{game.quizTitle}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {game.playerCount} players</span>
                              <span>{format(new Date(game.createdAt), "MMM d, yyyy")}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${game.status === "active" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>{game.status}</span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">Manage</Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">No games found. Host a game first.</div>
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

              {/* Media Popup Panel — always show when game is selected */}
              <MediaPopupPanel gameId={selectedGameId} players={players ?? []} />

              {playersLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground mt-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading players…</div>
              ) : players && players.length > 0 ? (
                <div className="space-y-3 mt-6">
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
                          <Button size="sm" onClick={() => handleSaveCoins(player.id)}
                            disabled={player.isKicked || editingCoins[player.id] === undefined || updatePlayer.isPending}
                          >Save</Button>
                          <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleKick(player.id)} disabled={player.isKicked}
                          ><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl mt-6">No players in this game.</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
