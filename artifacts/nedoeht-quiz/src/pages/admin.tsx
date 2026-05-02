import { useState, useEffect, useRef } from "react";
import { useListPlayers, useUpdatePlayer, useKickPlayer, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameWebSocket } from "@/hooks/use-game";
import type { PopupData } from "@/components/media-popup";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, Coins, Trash2, ChevronLeft, Users, Loader2, Clock,
  Image, Video, Link2, Monitor, User, Globe, X, Play, Maximize2,
  AlignCenter, AlignJustify, Search, RefreshCw, Zap,
} from "lucide-react";

const ADMIN_PASSWORD = "2026BIOlogy!";

function formatTime(s: number) {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.max(0, s) % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type SourceMode = "image-upload" | "image-url" | "video-url";
type SizeOption = "small" | "medium" | "fullscreen";
type TargetOption = "all" | "host" | "player";

// ─── Full admin management panel for a game ──────────────────────────────────
function AdminGamePanel({
  gameId,
  gameInfo,
  onBack,
}: {
  gameId: number;
  gameInfo: { quizTitle: string; status: string; code: string; playerCount: number };
  onBack: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { sendMessage, messages, isConnected } = useGameWebSocket(gameId, "host");

  // Players
  const { data: players, isLoading: playersLoading, refetch: refetchPlayers } = useListPlayers(gameId, {
    query: { queryKey: getListPlayersQueryKey(gameId), enabled: !!gameId, refetchInterval: 5000 },
  });
  const updatePlayer = useUpdatePlayer();
  const kickPlayer = useKickPlayer();
  const [editingCoins, setEditingCoins] = useState<Record<number, string>>({});

  // Timer
  const [newSeconds, setNewSeconds] = useState("");

  // Media popup
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

  // Active section tab
  const [activeTab, setActiveTab] = useState<"media" | "timer" | "players">("media");

  // Fetch active popups on WS connect
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
      toast({ title: "✅ Popup pushed to screens!" });
    } else if (msg.type === "popup-dismissed") {
      setPopups(prev => prev.filter(p => p.id !== msg.popupId));
    } else if (msg.type === "admin-update-done") {
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
    } else if (msg.type === "error") {
      toast({ title: "Error: " + msg.message, variant: "destructive" });
      setSending(false);
    }
  }, [messages, toast, gameId, queryClient]);

  // Handlers
  const handleSetTimer = (secs: number) => {
    sendMessage({ type: "admin-adjust-timer", password: ADMIN_PASSWORD, newSeconds: secs });
    toast({ title: `⏱ Timer set to ${formatTime(secs)}` });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setMediaSrc(dataUrl);
      setPreviewSrc(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSendPopup = () => {
    if (!mediaSrc) {
      toast({ title: "Please select or enter an image/video first", variant: "destructive" });
      return;
    }
    if (!isConnected) {
      toast({ title: "Not connected to game yet, please wait…", variant: "destructive" });
      return;
    }
    if (target === "player" && !targetPlayerId) {
      toast({ title: "Please select a specific player", variant: "destructive" });
      return;
    }
    setSending(true);
    sendMessage({
      type: "admin-media-popup",
      password: ADMIN_PASSWORD,
      mediaSrc,
      mediaType: sourceMode === "video-url" ? "video" : "image",
      target: target === "player" ? "player" : target,
      targetPlayerId: target === "player" ? targetPlayerId : undefined,
      size,
      duration: parseInt(duration) || 0,
    });
  };

  const handleDismissPopup = (popupId: string) => {
    sendMessage({ type: "admin-dismiss-popup", password: ADMIN_PASSWORD, popupId });
  };

  const handleSaveCoins = (playerId: number, current: number) => {
    const val = parseInt(editingCoins[playerId] ?? String(current));
    if (isNaN(val)) return;
    updatePlayer.mutate(
      { gameId, playerId, data: { coins: val, adminPassword: ADMIN_PASSWORD } },
      {
        onSuccess: () => {
          toast({ title: "Coins updated" });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
          setEditingCoins(prev => { const n = { ...prev }; delete n[playerId]; return n; });
        },
        onError: () => toast({ title: "Failed to update coins", variant: "destructive" }),
      }
    );
  };

  const handleKick = (playerId: number) => {
    kickPlayer.mutate({ gameId, playerId }, {
      onSuccess: () => {
        toast({ title: "Player removed" });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
      },
    });
  };

  const targetLabel = (p: PopupData) => {
    if (p.target === "all") return "All players";
    if (p.target === "host") return "Host only";
    const pp = players?.find(pl => pl.id === (p.target as any).playerId);
    return pp ? `${pp.avatar ?? ""} ${pp.nickname}` : `Player #${(p.target as any).playerId}`;
  };

  const sortedPlayers = [...(players ?? [])].sort((a, b) => b.coins - a.coins);

  return (
    <div className="space-y-0">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{gameInfo.quizTitle}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span>Code: <span className="font-mono font-bold text-primary">{gameInfo.code}</span></span>
            <span className={`px-2 py-0.5 rounded-full font-medium ${gameInfo.status === "playing" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
              {gameInfo.status}
            </span>
            <span>{gameInfo.playerCount} players</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
          <span className={isConnected ? "text-green-400" : "text-yellow-400"}>
            {isConnected ? "Live" : "Connecting…"}
          </span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex rounded-xl border border-border overflow-hidden mb-6 text-sm font-semibold">
        {([
          ["media",   <Image className="w-4 h-4" />,   "Push Media"] as const,
          ["timer",   <Clock className="w-4 h-4" />,   "Timer"] as const,
          ["players", <Users className="w-4 h-4" />,   "Players"] as const,
        ] as ["media" | "timer" | "players", React.ReactElement, string][]).map(([tab, icon, label]) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 transition-colors ${activeTab === tab ? "bg-primary text-white" : "hover:bg-muted/50 text-muted-foreground"}`}
          >
            {icon}{label}
            {tab === "players" && players && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab ? "bg-white/20" : "bg-muted"}`}>
                {sortedPlayers.length}
              </span>
            )}
            {tab === "media" && popups.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab ? "bg-white/20" : "bg-primary/20 text-primary"}`}>
                {popups.length} live
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── MEDIA TAB ── */}
        {activeTab === "media" && (
          <motion.div key="media" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

            {/* Source type */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">1. Choose media source</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["image-upload", <Image className="w-5 h-5" />, "Upload Image", "Pick from your device"] as const,
                  ["image-url",    <Link2 className="w-5 h-5" />, "Image URL",    "Paste a link"] as const,
                  ["video-url",    <Video className="w-5 h-5" />, "Video URL",    "MP4 / embed link"] as const,
                ]).map(([mode, icon, label, sub]) => (
                  <button key={mode} type="button"
                    onClick={() => { setSourceMode(mode as SourceMode); setMediaSrc(""); setPreviewSrc(""); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${sourceMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"}`}
                  >
                    {icon}
                    <span className="text-xs font-bold">{label}</span>
                    <span className="text-[10px] opacity-70">{sub}</span>
                  </button>
                ))}
              </div>

              {/* Upload area */}
              {sourceMode === "image-upload" && (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-primary/60 rounded-xl transition-all group"
                  >
                    {previewSrc ? (
                      <div className="p-2">
                        <img src={previewSrc} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                        <p className="text-xs text-muted-foreground mt-2 group-hover:text-primary transition-colors">Click to change image</p>
                      </div>
                    ) : (
                      <div className="p-8 flex flex-col items-center gap-3 text-muted-foreground group-hover:text-primary transition-colors">
                        <Image className="w-10 h-10" />
                        <div>
                          <p className="font-bold text-sm">Click to upload an image</p>
                          <p className="text-xs opacity-70 mt-0.5">PNG, JPG, GIF, WebP supported</p>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              )}

              {/* URL inputs */}
              {(sourceMode === "image-url" || sourceMode === "video-url") && (
                <div className="space-y-2">
                  <Input
                    placeholder={sourceMode === "video-url" ? "https://example.com/video.mp4" : "https://example.com/image.jpg"}
                    value={mediaSrc}
                    onChange={e => { setMediaSrc(e.target.value); setPreviewSrc(e.target.value); }}
                    className="h-10"
                  />
                  {previewSrc && sourceMode === "image-url" && (
                    <img src={previewSrc} alt="preview" onError={() => setPreviewSrc("")}
                      className="max-h-40 rounded-xl object-contain border border-border/60 w-full bg-muted/20" />
                  )}
                  {previewSrc && sourceMode === "video-url" && (
                    <video src={previewSrc} className="max-h-40 rounded-xl border border-border/60 w-full bg-black" controls muted playsInline />
                  )}
                </div>
              )}
            </div>

            {/* Target */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">2. Who sees this?</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["all",    <Globe className="w-5 h-5" />,   "Everyone",     "All players + host"] as const,
                  ["host",   <Monitor className="w-5 h-5" />, "Host only",    "Just the host screen"] as const,
                  ["player", <User className="w-5 h-5" />,    "One player",   "Pick a specific player"] as const,
                ]).map(([t, icon, label, sub]) => (
                  <button key={t} type="button" onClick={() => { setTarget(t as TargetOption); setTargetPlayerId(null); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${target === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"}`}
                  >
                    {icon}
                    <span className="text-xs font-bold">{label}</span>
                    <span className="text-[10px] opacity-70">{sub}</span>
                  </button>
                ))}
              </div>

              {target === "player" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Select player:</p>
                  {playersLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading players…</div>
                  ) : sortedPlayers.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {sortedPlayers.map(p => (
                        <button key={p.id} type="button" onClick={() => setTargetPlayerId(p.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${targetPlayerId === p.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                        >
                          <span className="text-xl shrink-0">{p.avatar ?? "🐱"}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{p.nickname}</p>
                            <p className="text-[10px] text-muted-foreground">🪙 {p.coins}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No players in this game yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Size */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">3. Popup size</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["small",      <AlignCenter className="w-5 h-5" />, "Small",      "Corner of screen"] as const,
                  ["medium",     <AlignJustify className="w-5 h-5" />, "Medium",    "Centre overlay"] as const,
                  ["fullscreen", <Maximize2 className="w-5 h-5" />,   "Fullscreen", "Covers entire screen"] as const,
                ]).map(([s, icon, label, sub]) => (
                  <button key={s} type="button" onClick={() => setSize(s as SizeOption)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${size === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"}`}
                  >
                    {icon}
                    <span className="text-xs font-bold">{label}</span>
                    <span className="text-[10px] opacity-70">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">4. Auto-close after</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: "0",  label: "♾ Permanent" },
                  { val: "5",  label: "5 sec" },
                  { val: "10", label: "10 sec" },
                  { val: "15", label: "15 sec" },
                  { val: "30", label: "30 sec" },
                  { val: "60", label: "1 min" },
                ].map(({ val, label }) => (
                  <button key={val} type="button" onClick={() => setDuration(val)}
                    className={`px-4 py-2 rounded-full text-sm border-2 font-medium transition-all ${duration === val ? "border-primary bg-primary text-white" : "border-border hover:border-primary/50"}`}
                  >{label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" min="0" placeholder="Custom seconds…" value={duration}
                  onChange={e => setDuration(e.target.value)} className="h-9 w-44 text-sm" />
                <span className="text-xs text-muted-foreground">seconds (0 = stay until dismissed)</span>
              </div>
            </div>

            {/* Send button */}
            <Button
              onClick={handleSendPopup}
              disabled={!mediaSrc || sending || (target === "player" && !targetPlayerId)}
              size="lg"
              className="w-full gap-2 text-base font-bold bg-gradient-to-r from-primary to-secondary border-0 h-14 shadow-lg shadow-primary/30"
            >
              {sending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Pushing to screens…</>
              ) : (
                <><Zap className="w-5 h-5" /> Push to Screen Now</>
              )}
            </Button>

            {!isConnected && (
              <p className="text-xs text-center text-yellow-400">⚠ Still connecting to game — button will work once connected</p>
            )}

            {/* Active popups list */}
            {popups.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Currently live on screens ({popups.length})
                  </p>
                  <Button variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10 h-7 gap-1"
                    onClick={() => popups.forEach(p => handleDismissPopup(p.id))}
                  >
                    <X className="w-3 h-3" /> Dismiss all
                  </Button>
                </div>
                <div className="space-y-2">
                  {popups.map(popup => (
                    <div key={popup.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
                      {popup.mediaType === "image" ? (
                        <img src={popup.mediaSrc} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border/60" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/60">
                          <Video className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate capitalize">{popup.size} · {targetLabel(popup)}</p>
                        <p className="text-xs text-muted-foreground">{popup.duration > 0 ? `Auto-closes in ${popup.duration}s` : "Permanent until dismissed"}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="w-8 h-8 shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDismissPopup(popup.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── TIMER TAB ── */}
        {activeTab === "timer" && (
          <motion.div key="timer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {gameInfo.status !== "playing" && (
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                ⚠ Game is not currently playing — timer adjustments will apply when the game starts.
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick presets</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { secs: 60,   label: "1 min" },
                  { secs: 120,  label: "2 min" },
                  { secs: 180,  label: "3 min" },
                  { secs: 300,  label: "5 min" },
                  { secs: 480,  label: "8 min" },
                  { secs: 600,  label: "10 min" },
                  { secs: 900,  label: "15 min" },
                  { secs: 1200, label: "20 min" },
                  { secs: 1800, label: "30 min" },
                ].map(({ secs, label }) => (
                  <button key={secs} type="button" onClick={() => handleSetTimer(secs)}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-primary/5 hover:text-primary font-bold text-sm transition-all"
                  >
                    <Clock className="w-4 h-4 mb-1 opacity-60" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Custom duration</p>
              <form onSubmit={e => { e.preventDefault(); const s = parseInt(newSeconds); if (!isNaN(s) && s >= 0) { handleSetTimer(s); setNewSeconds(""); } }}
                className="flex gap-2">
                <Input type="number" min="0" placeholder="Enter seconds (e.g. 450)" value={newSeconds}
                  onChange={e => setNewSeconds(e.target.value)} className="flex-1 h-11 text-base" />
                <Button type="submit" size="lg" className="h-11 px-6">Set Timer</Button>
              </form>
              {newSeconds && !isNaN(parseInt(newSeconds)) && (
                <p className="text-sm text-muted-foreground">= {formatTime(parseInt(newSeconds))}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* ── PLAYERS TAB ── */}
        {activeTab === "players" && (
          <motion.div key="players" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {sortedPlayers.length} players — sorted by coins
              </p>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => refetchPlayers()}>
                <RefreshCw className="w-3 h-3" /> Refresh
              </Button>
            </div>

            {playersLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading players…</div>
            ) : sortedPlayers.length > 0 ? (
              <div className="space-y-2">
                {sortedPlayers.map((player, idx) => (
                  <Card key={player.id} className={`transition-opacity ${player.isKicked ? "opacity-40" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Rank */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ${idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-700" : "bg-muted-foreground"}`}>
                          {idx + 1}
                        </div>
                        {/* Avatar */}
                        <span className="text-2xl shrink-0">{player.avatar ?? "🐱"}</span>
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{player.nickname}</p>
                          {player.isKicked && <p className="text-xs text-destructive font-medium">Kicked</p>}
                        </div>
                        {/* Coins editor */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Coins className="w-4 h-4 text-yellow-400 shrink-0" />
                          <Input
                            type="number"
                            className="w-24 h-9 text-right font-mono"
                            value={editingCoins[player.id] ?? player.coins}
                            onChange={e => setEditingCoins(prev => ({ ...prev, [player.id]: e.target.value }))}
                            disabled={!!player.isKicked}
                          />
                          <Button size="sm" className="h-9 px-4"
                            onClick={() => handleSaveCoins(player.id, player.coins)}
                            disabled={!!player.isKicked || editingCoins[player.id] === undefined || updatePlayer.isPending}
                          >
                            Save
                          </Button>
                          <Button size="icon" variant="ghost"
                            className="w-9 h-9 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => handleKick(player.id)}
                            disabled={!!player.isKicked}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {/* Stats row */}
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>✅ {player.correctAnswers ?? 0} correct</span>
                        <span>📊 {player.totalAnswers ?? 0} answered</span>
                        <span className="ml-auto font-mono text-yellow-400 font-bold">🪙 {player.coins}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                No players in this game yet.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Top-level Admin Page ─────────────────────────────────────────────────────
export default function AdminPanel() {
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [gameCode, setGameCode] = useState("");
  const [gameInfo, setGameInfo] = useState<{ id: number; quizTitle: string; status: string; code: string; playerCount: number } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthed(true);
    } else {
      toast({ title: "Wrong password", variant: "destructive" });
      setPassword("");
    }
  };

  const handleLookupGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = gameCode.trim().toUpperCase();
    if (code.length !== 6) {
      toast({ title: "Game code must be 6 digits", variant: "destructive" });
      return;
    }
    setLookingUp(true);
    try {
      const res = await fetch(`/api/games/code/${code}`);
      if (!res.ok) throw new Error("Game not found");
      const data = await res.json();
      setGameInfo({ id: data.id, quizTitle: data.quizTitle, status: data.status, code: data.code, playerCount: data.playerCount });
    } catch {
      toast({ title: "Game not found — check the code and try again", variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <div className="container py-8 max-w-3xl mx-auto space-y-8 pb-20">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground text-sm">Push media, manage timers and coins during a live game</p>
        </div>
      </div>

      {!isAuthed ? (
        /* ── Step 1: password ── */
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="max-w-sm mx-auto">
            <CardHeader>
              <CardTitle>Admin Access Required</CardTitle>
              <CardDescription>Enter the admin password to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                <Input type="password" placeholder="Admin password" value={password}
                  onChange={e => setPassword(e.target.value)} autoFocus className="h-11" />
                <Button type="submit" className="w-full h-11 text-base font-bold">Unlock</Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      ) : !gameInfo ? (
        /* ── Step 2: enter game code ── */
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="p-5 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>Admin access granted. Enter the 6-digit game code shown on the host screen to manage that game.</span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="w-5 h-5" /> Find a Game</CardTitle>
              <CardDescription>Enter the same 6-digit code players use to join the game.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLookupGame} className="space-y-4">
                <Input
                  placeholder="e.g. 482917"
                  value={gameCode}
                  onChange={e => setGameCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-14 text-center text-3xl font-black tracking-[0.3em] font-mono"
                  maxLength={6}
                  autoFocus
                />
                <Button type="submit" size="lg" className="w-full h-12 text-base font-bold gap-2" disabled={lookingUp || gameCode.length !== 6}>
                  {lookingUp ? <><Loader2 className="w-4 h-4 animate-spin" /> Looking up game…</> : <><Search className="w-4 h-4" /> Find Game</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* ── Step 3: full management panel ── */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AdminGamePanel
            gameId={gameInfo.id}
            gameInfo={gameInfo}
            onBack={() => { setGameInfo(null); setGameCode(""); }}
          />
        </motion.div>
      )}
    </div>
  );
}
