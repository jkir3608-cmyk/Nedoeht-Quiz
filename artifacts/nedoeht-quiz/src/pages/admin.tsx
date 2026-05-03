import { useState, useEffect, useRef, useCallback } from "react";
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
  AlignCenter, AlignJustify, Search, RefreshCw, Zap, Plus, Library,
  Pencil, Check, BookImage, Upload,
} from "lucide-react";

const ADMIN_PASSWORD = "2026BIOlogy!";
const API_BASE = "/api";

function formatTime(s: number) {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.max(0, s) % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Compress image to jpeg base64 (max 900px wide, quality 0.82)
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 900;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

type MediaType = "image" | "video";
type SourceMode = "upload" | "url";
type SizeOption = "small" | "medium" | "fullscreen";
type TargetOption = "all" | "host" | "player";

interface LibraryItem {
  id: number;
  name: string;
  mediaType: MediaType;
  dataSrc: string;
  createdAt: string;
}

// ─── Media Library hooks (plain fetch, no codegen needed) ────────────────────
function useLibrary(enabled: boolean) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/media?password=${encodeURIComponent(ADMIN_PASSWORD)}`);
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (enabled) fetchItems(); }, [enabled, fetchItems]);

  const addItem = async (name: string, mediaType: MediaType, dataSrc: string) => {
    const res = await fetch(`${API_BASE}/admin/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: ADMIN_PASSWORD, name, mediaType, dataSrc }),
    });
    if (res.ok) { const item = await res.json(); setItems(prev => [item, ...prev]); return item as LibraryItem; }
    throw new Error("Failed to save");
  };

  const renameItem = async (id: number, name: string) => {
    const res = await fetch(`${API_BASE}/admin/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: ADMIN_PASSWORD, name }),
    });
    if (res.ok) { const item = await res.json(); setItems(prev => prev.map(i => i.id === id ? item : i)); }
  };

  const deleteItem = async (id: number) => {
    await fetch(`${API_BASE}/admin/media/${id}?password=${encodeURIComponent(ADMIN_PASSWORD)}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return { items, loading, fetchItems, addItem, renameItem, deleteItem };
}

// ─── Library manager panel ───────────────────────────────────────────────────
function LibraryPanel({
  onSelect,
  isAuthed,
}: {
  onSelect: (item: LibraryItem) => void;
  isAuthed: boolean;
}) {
  const { toast } = useToast();
  const { items, loading, fetchItems, addItem, renameItem, deleteItem } = useLibrary(isAuthed);

  // Add-new form
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"upload-image" | "url-image" | "url-video">("upload-image");
  const [addName, setAddName] = useState("");
  const [addSrc, setAddSrc] = useState("");
  const [addPreview, setAddPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Rename
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setAddSrc(compressed);
      setAddPreview(compressed);
      if (!addName) setAddName(file.name.replace(/\.[^/.]+$/, ""));
    } catch {
      toast({ title: "Could not read image", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!addSrc) { toast({ title: "No media selected", variant: "destructive" }); return; }
    if (!addName.trim()) { toast({ title: "Please give it a name", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const mediaType: MediaType = addMode === "url-video" ? "video" : "image";
      await addItem(addName.trim(), mediaType, addSrc);
      toast({ title: `"${addName.trim()}" saved to library!` });
      setShowAdd(false); setAddName(""); setAddSrc(""); setAddPreview("");
    } catch {
      toast({ title: "Failed to save to library", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Saved Media Library</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{items.length}/20</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={fetchItems}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowAdd(v => !v)}>
            <Plus className="w-3 h-3" /> Add media
          </Button>
        </div>
      </div>

      {/* Add new form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Add to Library</p>

              {/* Source type */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["upload-image", <Upload className="w-4 h-4" />, "Upload image"] as const,
                  ["url-image",    <Image className="w-4 h-4" />,  "Image URL"] as const,
                  ["url-video",    <Video className="w-4 h-4" />,  "Video URL"] as const,
                ]).map(([m, icon, label]) => (
                  <button key={m} type="button"
                    onClick={() => { setAddMode(m as typeof addMode); setAddSrc(""); setAddPreview(""); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-xs font-bold transition-all ${addMode === m ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground"}`}
                  >{icon}{label}</button>
                ))}
              </div>

              {/* File picker */}
              {addMode === "upload-image" && (
                <div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-primary/60 rounded-xl transition-all">
                    {addPreview
                      ? <div className="p-2"><img src={addPreview} alt="" className="max-h-36 mx-auto rounded-lg object-contain" /></div>
                      : <div className="p-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                          <BookImage className="w-8 h-8" />
                          <span className="text-sm font-medium">Click to upload image</span>
                          <span className="text-xs opacity-60">PNG, JPG, GIF, WebP — auto-compressed</span>
                        </div>
                    }
                  </button>
                </div>
              )}

              {/* URL inputs */}
              {(addMode === "url-image" || addMode === "url-video") && (
                <div className="space-y-2">
                  <Input
                    placeholder={addMode === "url-video" ? "https://example.com/video.mp4" : "https://example.com/image.jpg"}
                    value={addSrc}
                    onChange={e => { setAddSrc(e.target.value); setAddPreview(e.target.value); }}
                    className="h-9 text-sm"
                  />
                  {addPreview && addMode === "url-image" && (
                    <img src={addPreview} alt="" onError={() => setAddPreview("")}
                      className="max-h-28 rounded-lg object-contain border border-border/60 w-full bg-muted/20" />
                  )}
                  {addPreview && addMode === "url-video" && (
                    <video src={addPreview} className="max-h-28 rounded-lg border border-border/60 w-full bg-black" controls muted playsInline />
                  )}
                </div>
              )}

              {/* Name input */}
              <Input
                placeholder="Give it a name (e.g. 'Bacteria diagram')"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                className="h-9 text-sm"
              />

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!addSrc || !addName.trim() || saving} className="flex-1 gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Saving…" : "Save to Library"}
                </Button>
                <Button variant="ghost" onClick={() => setShowAdd(false)} className="px-4">Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid of items */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading library…
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm space-y-2">
          <BookImage className="w-8 h-8 mx-auto opacity-30" />
          <p>No saved media yet.</p>
          <p className="text-xs opacity-60">Click "Add media" above to save images and videos for quick reuse.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map(item => (
            <div key={item.id} className="group relative rounded-xl border border-border overflow-hidden bg-card hover:border-primary/60 transition-all">
              {/* Thumbnail */}
              <button type="button" className="w-full" onClick={() => onSelect(item)}>
                {item.mediaType === "image" ? (
                  <img src={item.dataSrc} alt={item.name}
                    className="w-full h-28 object-cover bg-muted/20" />
                ) : (
                  <div className="w-full h-28 bg-muted flex flex-col items-center justify-center gap-2">
                    <Video className="w-8 h-8 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Video</span>
                  </div>
                )}
              </button>

              {/* Name bar */}
              <div className="p-2 flex items-center gap-1.5">
                {renamingId === item.id ? (
                  <form className="flex gap-1 w-full" onSubmit={async e => {
                    e.preventDefault();
                    await renameItem(item.id, renameVal);
                    setRenamingId(null);
                  }}>
                    <Input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      className="h-6 text-xs flex-1" autoFocus />
                    <button type="submit" className="text-primary"><Check className="w-3.5 h-3.5" /></button>
                  </form>
                ) : (
                  <>
                    <span className="text-xs font-medium truncate flex-1">{item.name}</span>
                    <button type="button" onClick={() => { setRenamingId(item.id); setRenameVal(item.name); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => deleteItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>

              {/* Push overlay on hover */}
              <div className="absolute inset-0 bg-primary/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-white rounded-full px-3 py-1 text-xs font-bold text-primary flex items-center gap-1.5">
                  <Play className="w-3 h-3" /> Select
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Full admin management panel for a game ──────────────────────────────────
function AdminGamePanel({
  gameId,
  gameInfo,
  onBack,
  isAuthed,
}: {
  gameId: number;
  gameInfo: { quizTitle: string; status: string; code: string; playerCount: number };
  onBack: () => void;
  isAuthed: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { sendMessage, messages, isConnected } = useGameWebSocket(gameId, "host");

  const { data: players, isLoading: playersLoading, refetch: refetchPlayers } = useListPlayers(gameId, {
    query: { queryKey: getListPlayersQueryKey(gameId), enabled: !!gameId, refetchInterval: 5000 },
  });
  const updatePlayer = useUpdatePlayer();
  const kickPlayer = useKickPlayer();
  const [editingCoins, setEditingCoins] = useState<Record<number, string>>({});
  const [newSeconds, setNewSeconds] = useState("");

  // Push panel state
  const [popups, setPopups] = useState<PopupData[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<{ src: string; type: MediaType } | null>(null);
  const [target, setTarget] = useState<TargetOption>("all");
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [size, setSize] = useState<SizeOption>("medium");
  const [duration, setDuration] = useState("0");
  const [sending, setSending] = useState(false);

  // Quick-add state for push tab
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickMode, setQuickMode] = useState<"upload" | "image-url" | "video-url">("upload");
  const [quickSrc, setQuickSrc] = useState("");
  const [quickPreview, setQuickPreview] = useState("");
  const quickFileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"library" | "push" | "timer" | "players">("library");

  const didFetchPopups = useRef(false);
  useEffect(() => {
    if (isConnected && !didFetchPopups.current) {
      didFetchPopups.current = true;
      sendMessage({ type: "get-active-popups", password: ADMIN_PASSWORD });
    }
  }, [isConnected, sendMessage]);

  useEffect(() => {
    if (messages.length === 0) return;
    const msg = messages[messages.length - 1] as any;
    if (msg.type === "active-popups") setPopups(msg.popups as PopupData[]);
    else if (msg.type === "popup-created") {
      setPopups(prev => [...prev.filter(p => p.id !== msg.popup.id), msg.popup]);
      setSending(false);
      toast({ title: "✅ Popup live on screens!" });
    } else if (msg.type === "popup-dismissed") {
      setPopups(prev => prev.filter(p => p.id !== msg.popupId));
    } else if (msg.type === "admin-update-done") {
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
    } else if (msg.type === "error") {
      toast({ title: "Error: " + msg.message, variant: "destructive" });
      setSending(false);
    }
  }, [messages, toast, gameId, queryClient]);

  const handleSetTimer = (secs: number) => {
    sendMessage({ type: "admin-adjust-timer", password: ADMIN_PASSWORD, newSeconds: secs });
    toast({ title: `⏱ Timer set to ${formatTime(secs)}` });
  };

  const handleSelectFromLibrary = (item: LibraryItem) => {
    setSelectedMedia({ src: item.dataSrc, type: item.mediaType });
    setActiveTab("push");
    toast({ title: `"${item.name}" selected — set options and push` });
  };

  const handleQuickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setQuickSrc(compressed); setQuickPreview(compressed);
    setSelectedMedia({ src: compressed, type: "image" });
  };

  const handleSendPopup = () => {
    const src = selectedMedia?.src ?? quickSrc;
    if (!src) { toast({ title: "No media selected", variant: "destructive" }); return; }
    if (!isConnected) { toast({ title: "Still connecting…", variant: "destructive" }); return; }
    if (target === "player" && !targetPlayerId) { toast({ title: "Pick a player", variant: "destructive" }); return; }
    setSending(true);
    const mediaType = selectedMedia?.type ?? (quickMode === "video-url" ? "video" : "image");
    sendMessage({
      type: "admin-media-popup",
      password: ADMIN_PASSWORD,
      mediaSrc: src,
      mediaType,
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
    updatePlayer.mutate({ gameId, playerId, data: { coins: val, adminPassword: ADMIN_PASSWORD } }, {
      onSuccess: () => {
        toast({ title: "Coins updated" });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
        setEditingCoins(prev => { const n = { ...prev }; delete n[playerId]; return n; });
      },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  const handleKick = (playerId: number) => {
    kickPlayer.mutate({ gameId, playerId }, {
      onSuccess: () => {
        toast({ title: "Player removed" });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
      },
    });
  };

  const sortedPlayers = [...(players ?? [])].sort((a, b) => b.coins - a.coins);
  const targetLabel = (p: PopupData) => {
    if (p.target === "all") return "All";
    if (p.target === "host") return "Host";
    const pp = players?.find(pl => pl.id === (p.target as any).playerId);
    return pp ? `${pp.avatar ?? ""} ${pp.nickname}` : `Player #${(p.target as any).playerId}`;
  };

  const TABS = [
    { id: "library" as const, icon: <Library className="w-4 h-4" />, label: "Library" },
    { id: "push" as const,    icon: <Zap className="w-4 h-4" />,     label: "Push" },
    { id: "timer" as const,   icon: <Clock className="w-4 h-4" />,   label: "Timer" },
    { id: "players" as const, icon: <Users className="w-4 h-4" />,   label: "Players" },
  ];

  return (
    <div className="space-y-0">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{gameInfo.quizTitle}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
            <span>Code: <span className="font-mono font-bold text-primary">{gameInfo.code}</span></span>
            <span className={`px-2 py-0.5 rounded-full font-medium ${gameInfo.status === "playing" ? "bg-green-500/20 text-green-400" : "bg-muted"}`}>
              {gameInfo.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
          <span className={isConnected ? "text-green-400" : "text-yellow-400"}>{isConnected ? "Live" : "Connecting…"}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border overflow-hidden mb-6">
        {TABS.map(({ id, icon, label }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors relative ${activeTab === id ? "bg-primary text-white" : "hover:bg-muted/50 text-muted-foreground"}`}
          >
            {icon}{label}
            {id === "players" && players && players.length > 0 && (
              <span className={`text-[10px] px-1 rounded-full font-bold ${activeTab === id ? "bg-white/20" : "bg-muted"}`}>{players.length}</span>
            )}
            {id === "push" && popups.length > 0 && (
              <span className={`text-[10px] px-1 rounded-full font-bold ${activeTab === id ? "bg-white/20" : "bg-primary/20 text-primary"}`}>{popups.length}</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── LIBRARY TAB ── */}
        {activeTab === "library" && (
          <motion.div key="library" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <LibraryPanel onSelect={handleSelectFromLibrary} isAuthed={isAuthed} />
          </motion.div>
        )}

        {/* ── PUSH TAB ── */}
        {activeTab === "push" && (
          <motion.div key="push" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

            {/* Selected media preview */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Selected media to push</p>

              {selectedMedia ? (
                <div className="relative rounded-xl border-2 border-primary overflow-hidden bg-muted/20">
                  {selectedMedia.type === "image" ? (
                    <img src={selectedMedia.src} alt="" className="w-full max-h-48 object-contain bg-muted/20" />
                  ) : (
                    <video
                      src={selectedMedia.src}
                      className="w-full max-h-48 bg-black"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  )}
                  <button type="button" onClick={() => setSelectedMedia(null)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/60 rounded-full px-2.5 py-0.5 text-xs text-white font-medium capitalize">
                    {selectedMedia.type}
                  </div>
                </div>
              ) : (
                <div className="p-6 border-2 border-dashed border-border rounded-xl text-center space-y-3">
                  <BookImage className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No media selected — pick from Library or add below</p>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveTab("library")}>
                    <Library className="w-3.5 h-3.5" /> Open Library
                  </Button>
                </div>
              )}

              {/* Quick-add without saving to library */}
              <button type="button" onClick={() => setShowQuickAdd(v => !v)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                <Plus className="w-3.5 h-3.5" />
                {showQuickAdd ? "Hide" : "Or add one-time image / video (won't save to library)"}
              </button>

              <AnimatePresence>
                {showQuickAdd && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden">
                    <div className="p-4 rounded-xl border border-border space-y-3">
                      <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs font-medium">
                        {([
                          ["upload",    <Upload className="w-3 h-3" />, "Upload"] as const,
                          ["image-url", <Link2 className="w-3 h-3" />,  "Image URL"] as const,
                          ["video-url", <Video className="w-3 h-3" />,  "Video URL"] as const,
                        ]).map(([m, icon, label]) => (
                          <button key={m} type="button"
                            onClick={() => { setQuickMode(m as typeof quickMode); setQuickSrc(""); setQuickPreview(""); setSelectedMedia(null); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${quickMode === m ? "bg-primary text-white" : "hover:bg-muted/60"}`}
                          >{icon}{label}</button>
                        ))}
                      </div>

                      {quickMode === "upload" && (
                        <div>
                          <input ref={quickFileRef} type="file" accept="image/*" onChange={handleQuickFile} className="hidden" />
                          <button type="button" onClick={() => quickFileRef.current?.click()}
                            className="w-full border-2 border-dashed border-border hover:border-primary/60 rounded-xl transition-all">
                            {quickPreview
                              ? <div className="p-2"><img src={quickPreview} alt="" className="max-h-32 mx-auto rounded-lg object-contain" /></div>
                              : <div className="p-5 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                                  <Upload className="w-6 h-6" /><span className="text-sm">Click to upload</span>
                                </div>
                            }
                          </button>
                        </div>
                      )}

                      {(quickMode === "image-url" || quickMode === "video-url") && (
                        <div className="space-y-2">
                          <Input
                            placeholder={quickMode === "video-url" ? "https://…/video.mp4" : "https://…/image.jpg"}
                            value={quickSrc}
                            onChange={e => {
                              setQuickSrc(e.target.value);
                              setQuickPreview(e.target.value);
                              setSelectedMedia({ src: e.target.value, type: quickMode === "video-url" ? "video" : "image" });
                            }}
                            className="h-9 text-sm"
                          />
                          {quickPreview && quickMode === "image-url" && (
                            <img src={quickPreview} alt="" onError={() => setQuickPreview("")}
                              className="max-h-28 rounded-lg object-contain border border-border/60 w-full bg-muted/20" />
                          )}
                          {quickPreview && quickMode === "video-url" && (
                            <video
                              src={quickPreview}
                              className="max-h-28 rounded-lg border border-border/60 w-full bg-black"
                              controls muted playsInline preload="metadata"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Target */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Who sees this?</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["all",    <Globe className="w-4 h-4" />,   "Everyone"] as const,
                  ["host",   <Monitor className="w-4 h-4" />, "Host only"] as const,
                  ["player", <User className="w-4 h-4" />,    "One player"] as const,
                ]).map(([t, icon, label]) => (
                  <button key={t} type="button" onClick={() => { setTarget(t as TargetOption); setTargetPlayerId(null); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-bold transition-all ${target === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground"}`}
                  >{icon}{label}</button>
                ))}
              </div>
              {target === "player" && (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
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
              )}
            </div>

            {/* Size */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Popup size</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["small",      <AlignCenter className="w-4 h-4" />,  "Small",       "Corner"] as const,
                  ["medium",     <AlignJustify className="w-4 h-4" />, "Medium",      "Overlay"] as const,
                  ["fullscreen", <Maximize2 className="w-4 h-4" />,    "Fullscreen",  "Full screen"] as const,
                ]).map(([s, icon, label, sub]) => (
                  <button key={s} type="button" onClick={() => setSize(s as SizeOption)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-bold transition-all ${size === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground"}`}
                  >{icon}{label}<span className="font-normal opacity-60">{sub}</span></button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Auto-close after</p>
              <div className="flex flex-wrap gap-2">
                {[{ v: "0", l: "♾ Permanent" }, { v: "5", l: "5s" }, { v: "10", l: "10s" }, { v: "15", l: "15s" }, { v: "30", l: "30s" }, { v: "60", l: "1 min" }].map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setDuration(v)}
                    className={`px-4 py-2 rounded-full text-sm border-2 font-medium transition-all ${duration === v ? "border-primary bg-primary text-white" : "border-border hover:border-primary/50"}`}
                  >{l}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" min="0" placeholder="Custom…" value={duration}
                  onChange={e => setDuration(e.target.value)} className="h-9 w-36 text-sm" />
                <span className="text-xs text-muted-foreground">seconds (0 = permanent)</span>
              </div>
            </div>

            {/* Push button */}
            <Button
              onClick={handleSendPopup}
              disabled={(!selectedMedia?.src && !quickSrc) || sending || (target === "player" && !targetPlayerId)}
              size="lg"
              className="w-full h-14 text-base font-bold gap-2 bg-gradient-to-r from-primary to-secondary border-0 shadow-lg shadow-primary/30"
            >
              {sending ? <><Loader2 className="w-5 h-5 animate-spin" /> Pushing…</> : <><Zap className="w-5 h-5" /> Push to Screen Now</>}
            </Button>

            {!isConnected && (
              <p className="text-xs text-center text-yellow-400">⚠ Connecting to game WebSocket…</p>
            )}

            {/* Active popups */}
            {popups.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live on screens ({popups.length})</p>
                  <Button variant="ghost" size="sm" className="text-xs text-destructive h-6 gap-1"
                    onClick={() => popups.forEach(p => handleDismissPopup(p.id))}
                  ><X className="w-3 h-3" /> Dismiss all</Button>
                </div>
                {popups.map(popup => (
                  <div key={popup.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
                    {popup.mediaType === "image"
                      ? <img src={popup.mediaSrc} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border/60" />
                      : <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0"><Video className="w-5 h-5 text-muted-foreground" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold capitalize">{popup.size} · {targetLabel(popup)}</p>
                      <p className="text-xs text-muted-foreground">{popup.duration > 0 ? `${popup.duration}s auto-close` : "Permanent"}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDismissPopup(popup.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── TIMER TAB ── */}
        {activeTab === "timer" && (
          <motion.div key="timer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {gameInfo.status !== "playing" && (
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                ⚠ Game isn't playing yet — timer will apply when the game starts.
              </div>
            )}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick presets</p>
              <div className="grid grid-cols-3 gap-3">
                {[60, 120, 180, 300, 480, 600, 900, 1200, 1800].map(secs => (
                  <button key={secs} type="button" onClick={() => handleSetTimer(secs)}
                    className="flex flex-col items-center p-4 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-primary/5 hover:text-primary font-bold text-sm transition-all">
                    <Clock className="w-4 h-4 mb-1 opacity-60" />{formatTime(secs)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Custom duration</p>
              <form onSubmit={e => { e.preventDefault(); const s = parseInt(newSeconds); if (!isNaN(s) && s >= 0) { handleSetTimer(s); setNewSeconds(""); } }} className="flex gap-2">
                <Input type="number" min="0" placeholder="Seconds (e.g. 450)" value={newSeconds} onChange={e => setNewSeconds(e.target.value)} className="flex-1 h-11" />
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
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{sortedPlayers.length} players</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => refetchPlayers()}>
                <RefreshCw className="w-3 h-3" /> Refresh
              </Button>
            </div>
            {playersLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : sortedPlayers.length > 0 ? (
              <div className="space-y-2">
                {sortedPlayers.map((player, idx) => (
                  <Card key={player.id} className={player.isKicked ? "opacity-40" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ${idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-700" : "bg-muted-foreground"}`}>{idx + 1}</div>
                        <span className="text-2xl shrink-0">{player.avatar ?? "🐱"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{player.nickname}</p>
                          {player.isKicked && <p className="text-xs text-destructive">Kicked</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Coins className="w-4 h-4 text-yellow-400" />
                          <Input type="number" className="w-24 h-9 text-right font-mono"
                            value={editingCoins[player.id] ?? player.coins}
                            onChange={e => setEditingCoins(prev => ({ ...prev, [player.id]: e.target.value }))}
                            disabled={!!player.isKicked} />
                          <Button size="sm" className="h-9 px-3"
                            onClick={() => handleSaveCoins(player.id, player.coins)}
                            disabled={!!player.isKicked || editingCoins[player.id] === undefined || updatePlayer.isPending}
                          >Save</Button>
                          <Button size="icon" variant="ghost" className="w-9 h-9 text-destructive hover:bg-destructive/10"
                            onClick={() => handleKick(player.id)} disabled={!!player.isKicked}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
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
    if (password === ADMIN_PASSWORD) { setIsAuthed(true); }
    else { toast({ title: "Wrong password", variant: "destructive" }); setPassword(""); }
  };

  const handleLookupGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = gameCode.trim();
    if (code.length !== 6) { toast({ title: "Game code must be 6 digits", variant: "destructive" }); return; }
    setLookingUp(true);
    try {
      const res = await fetch(`/api/games/code/${code}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setGameInfo({ id: data.id, quizTitle: data.quizTitle, status: data.status, code: data.code, playerCount: data.playerCount });
    } catch {
      toast({ title: "Game not found — check the code", variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <div className="container py-8 max-w-3xl mx-auto space-y-8 pb-20">
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="p-5 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>Admin access granted. Enter the 6-digit game code from the host screen to manage a game. You can also browse your media library without entering a game.</span>
          </div>

          {/* Game lookup card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="w-5 h-5" /> Find a Game</CardTitle>
              <CardDescription>Enter the same 6-digit code players use to join.</CardDescription>
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
                <Button type="submit" size="lg" className="w-full h-12 font-bold gap-2" disabled={lookingUp || gameCode.length !== 6}>
                  {lookingUp ? <><Loader2 className="w-4 h-4 animate-spin" /> Looking up…</> : <><Search className="w-4 h-4" /> Find Game</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Standalone library access (no game needed) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Library className="w-5 h-5" /> Media Library</CardTitle>
              <CardDescription>Upload and manage saved images and videos without being in a game.</CardDescription>
            </CardHeader>
            <CardContent>
              <LibraryPanel onSelect={() => toast({ title: "Enter a game code above to push media to screens" })} isAuthed={isAuthed} />
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AdminGamePanel
            gameId={gameInfo.id}
            gameInfo={gameInfo}
            onBack={() => { setGameInfo(null); setGameCode(""); }}
            isAuthed={isAuthed}
          />
        </motion.div>
      )}
    </div>
  );
}
