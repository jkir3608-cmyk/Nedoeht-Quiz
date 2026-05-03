import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useJoinGame } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, ShieldAlert, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const AVATAR_CATEGORIES = [
  {
    label: "🐾 Animals",
    avatars: [
      { emoji: "🐱", label: "Cat" },
      { emoji: "🐶", label: "Dog" },
      { emoji: "🐸", label: "Frog" },
      { emoji: "🐼", label: "Panda" },
      { emoji: "🐨", label: "Koala" },
      { emoji: "🐯", label: "Tiger" },
      { emoji: "🦊", label: "Fox" },
      { emoji: "🐺", label: "Wolf" },
      { emoji: "🦁", label: "Lion" },
      { emoji: "🐮", label: "Cow" },
      { emoji: "🐷", label: "Pig" },
      { emoji: "🐻", label: "Bear" },
      { emoji: "🐬", label: "Dolphin" },
      { emoji: "🦈", label: "Shark" },
      { emoji: "🐙", label: "Octopus" },
      { emoji: "🦋", label: "Butterfly" },
      { emoji: "🦅", label: "Eagle" },
      { emoji: "🦒", label: "Giraffe" },
      { emoji: "🦓", label: "Zebra" },
      { emoji: "🐘", label: "Elephant" },
      { emoji: "🦜", label: "Parrot" },
      { emoji: "🦦", label: "Otter" },
      { emoji: "🦔", label: "Hedgehog" },
      { emoji: "🐊", label: "Croc" },
    ],
  },
  {
    label: "✨ Fantasy",
    avatars: [
      { emoji: "🦄", label: "Unicorn" },
      { emoji: "🐉", label: "Dragon" },
      { emoji: "🧜", label: "Mermaid" },
      { emoji: "🧚", label: "Fairy" },
      { emoji: "🧙", label: "Wizard" },
      { emoji: "🧝", label: "Elf" },
      { emoji: "🧞", label: "Genie" },
      { emoji: "🧛", label: "Vampire" },
      { emoji: "🧟", label: "Zombie" },
      { emoji: "👻", label: "Ghost" },
      { emoji: "🎃", label: "Pumpkin" },
      { emoji: "🌙", label: "Moon Witch" },
      { emoji: "⭐", label: "Star Spirit" },
      { emoji: "🌊", label: "Sea Spirit" },
      { emoji: "🔥", label: "Fire Spirit" },
      { emoji: "❄️", label: "Ice Spirit" },
      { emoji: "🌪️", label: "Storm" },
      { emoji: "⚡", label: "Thunder" },
    ],
  },
  {
    label: "⚔️ Warriors",
    avatars: [
      { emoji: "🧙‍♂️", label: "Mage" },
      { emoji: "🦸", label: "Hero" },
      { emoji: "🦹", label: "Villain" },
      { emoji: "🤺", label: "Fencer" },
      { emoji: "🛡️", label: "Shield Knight" },
      { emoji: "⚔️", label: "Knight" },
      { emoji: "🏹", label: "Archer" },
      { emoji: "🗡️", label: "Rogue" },
      { emoji: "🔱", label: "Sea Warrior" },
      { emoji: "🪃", label: "Hunter" },
      { emoji: "🥷", label: "Ninja" },
      { emoji: "🪖", label: "Soldier" },
      { emoji: "👑", label: "King" },
      { emoji: "💎", label: "Diamond Knight" },
      { emoji: "🧲", label: "Magnetar" },
      { emoji: "🚀", label: "Rocket Ranger" },
    ],
  },
  {
    label: "🎉 Fun",
    avatars: [
      { emoji: "🤖", label: "Robot" },
      { emoji: "👽", label: "Alien" },
      { emoji: "👾", label: "Invader" },
      { emoji: "🎩", label: "Magician" },
      { emoji: "🤠", label: "Cowboy" },
      { emoji: "🤡", label: "Clown" },
      { emoji: "🎭", label: "Drama" },
      { emoji: "🧑‍🚀", label: "Astronaut" },
      { emoji: "🧑‍🔬", label: "Scientist" },
      { emoji: "🧑‍🍳", label: "Chef" },
      { emoji: "🧑‍🎤", label: "Rockstar" },
      { emoji: "🦩", label: "Flamingo" },
      { emoji: "🐲", label: "Mini Dragon" },
      { emoji: "🌵", label: "Cactus" },
      { emoji: "🍄", label: "Mushroom" },
      { emoji: "🎯", label: "Bullseye" },
    ],
  },
];

const ALL_AVATARS = AVATAR_CATEGORIES.flatMap(c => c.avatars);

const codeSchema = z.object({
  code: z.string().length(6, "Code must be 6 characters").toUpperCase(),
});

const nameSchema = z.object({
  nickname: z.string().min(2, "Nickname must be at least 2 characters").max(15, "Nickname too long"),
});

type Step = "code" | "name" | "avatar";

export default function JoinGame() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("code");
  const [gameId, setGameId] = useState<number | null>(null);
  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  const joinGame = useJoinGame();

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const nameForm = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { nickname: "" },
  });

  const onCodeSubmit = async (data: z.infer<typeof codeSchema>) => {
    setIsCheckingCode(true);
    try {
      const res = await fetch(`/api/games/code/${data.code}`);
      if (!res.ok) throw new Error("Game not found");
      const game = await res.json();
      if (game.status !== "waiting") {
        toast({ title: "Game already in progress or ended", variant: "destructive" });
        return;
      }
      setGameId(game.id);
      setStep("name");
    } catch {
      toast({ title: "Invalid game code", variant: "destructive" });
    } finally {
      setIsCheckingCode(false);
    }
  };

  const onNameSubmit = (data: z.infer<typeof nameSchema>) => {
    setNickname(data.nickname);
    // Pick a random avatar if none selected
    if (!selectedAvatar) {
      setSelectedAvatar(ALL_AVATARS[Math.floor(Math.random() * ALL_AVATARS.length)].emoji);
    }
    setStep("avatar");
  };

  const onAvatarConfirm = () => {
    if (!gameId || !selectedAvatar) return;
    joinGame.mutate(
      { gameId, data: { nickname, avatar: selectedAvatar } },
      {
        onSuccess: (player) => setLocation(`/play/${gameId}/${player.id}`),
        onError: (err) => toast({ title: "Could not join game", description: err.message, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0" />

      <div className="w-full max-w-sm z-10">
        <h1 className="text-4xl md:text-5xl font-black text-center tracking-tight drop-shadow-md mb-10">
          <span className="text-primary">Quizzy</span><span className="text-foreground/80">Blast</span>
        </h1>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Enter code ── */}
          {step === "code" && (
            <motion.div key="code" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} transition={{ duration: 0.3 }}>
              <Card className="border-primary/20 shadow-2xl bg-card/95 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <Form {...codeForm}>
                    <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-6">
                      <FormField control={codeForm.control} name="code" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="GAME CODE"
                              className="h-16 text-center text-2xl font-black tracking-widest uppercase"
                              {...field}
                              onChange={e => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormMessage className="text-center" />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full h-14 text-xl font-bold gap-2 shadow-[0_4px_0_0_hsl(var(--primary)/0.5)] active:shadow-none active:translate-y-1 transition-all" disabled={isCheckingCode}>
                        {isCheckingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Enter</>}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Step 2: Enter name ── */}
          {step === "name" && (
            <motion.div key="name" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} transition={{ duration: 0.3 }}>
              <Card className="border-secondary/20 shadow-2xl bg-card/95 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <Form {...nameForm}>
                    <form onSubmit={nameForm.handleSubmit(onNameSubmit)} className="space-y-6">
                      <FormField control={nameForm.control} name="nickname" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Your nickname" className="h-16 text-center text-xl font-bold" {...field} autoFocus />
                          </FormControl>
                          <FormMessage className="text-center" />
                        </FormItem>
                      )} />
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" className="h-14 px-4" onClick={() => setStep("code")}>
                          <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <Button type="submit" className="flex-1 h-14 text-xl font-bold bg-secondary hover:bg-secondary/90 shadow-[0_4px_0_0_hsl(var(--secondary)/0.5)] active:shadow-none active:translate-y-1 transition-all">
                          Next →
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Step 3: Pick avatar ── */}
          {step === "avatar" && (
            <motion.div key="avatar" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} transition={{ duration: 0.3 }}>
              <div className="space-y-3">
                {/* Big selected avatar preview */}
                <div className="text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedAvatar ?? "empty"}
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.3, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="text-7xl inline-block drop-shadow-lg"
                    >
                      {selectedAvatar ?? "❓"}
                    </motion.div>
                  </AnimatePresence>
                  <p className="text-sm text-muted-foreground font-medium mt-1">
                    {selectedAvatar
                      ? (ALL_AVATARS.find(a => a.emoji === selectedAvatar)?.label ?? "")
                      : "Pick your avatar"}
                  </p>
                </div>

                <Card className="border-primary/20 shadow-2xl bg-card/95 backdrop-blur-sm overflow-hidden">
                  {/* Category tabs */}
                  <div className="flex border-b border-border/50">
                    {AVATAR_CATEGORIES.map((cat, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveCategory(i)}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${
                          activeCategory === i
                            ? "bg-primary/10 text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {cat.label.split(" ")[0]}
                      </button>
                    ))}
                  </div>

                  <CardContent className="pt-3 pb-3">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeCategory}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="grid grid-cols-6 gap-1.5 max-h-52 overflow-y-auto"
                      >
                        {AVATAR_CATEGORIES[activeCategory].avatars.map(({ emoji, label }) => (
                          <motion.button
                            key={emoji}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.85 }}
                            onClick={() => setSelectedAvatar(emoji)}
                            title={label}
                            className={`
                              relative text-3xl p-1.5 rounded-xl transition-all
                              ${selectedAvatar === emoji
                                ? "bg-primary/20 ring-2 ring-primary scale-110 shadow-lg shadow-primary/20"
                                : "hover:bg-muted/80"}
                            `}
                          >
                            {emoji}
                            {selectedAvatar === emoji && (
                              <motion.div
                                layoutId="avatar-selected"
                                className="absolute inset-0 rounded-xl bg-primary/10 border-2 border-primary"
                                style={{ zIndex: -1 }}
                              />
                            )}
                          </motion.button>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="h-14 px-4" onClick={() => setStep("name")}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    className="flex-1 h-14 text-lg font-bold shadow-[0_4px_0_0_hsl(var(--primary)/0.5)] active:shadow-none active:translate-y-1 transition-all"
                    onClick={onAvatarConfirm}
                    disabled={!selectedAvatar || joinGame.isPending}
                  >
                    {joinGame.isPending
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : selectedAvatar
                      ? <span>{selectedAvatar} Join as {nickname}</span>
                      : "Pick an avatar first"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Link href="/admin">
        <button className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all text-sm font-medium shadow-lg">
          <ShieldAlert className="w-4 h-4" /> Admin
        </button>
      </Link>
    </div>
  );
}
