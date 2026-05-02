import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Zap, Brain, Users, Trophy, Star, ChevronRight, Sparkles, Target, Gift } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number,number,number,number] } }),
};

const features = [
  {
    icon: Brain,
    color: "from-violet-500 to-indigo-500",
    glow: "shadow-violet-500/25",
    title: "AI-Powered Quizzes",
    desc: "Paste any study material and let AI generate a full quiz in seconds — with explanations for every answer.",
  },
  {
    icon: Users,
    color: "from-pink-500 to-rose-500",
    glow: "shadow-pink-500/25",
    title: "Live Multiplayer",
    desc: "Real-time games with instant leaderboards. Every player sees results the moment they answer.",
  },
  {
    icon: Gift,
    color: "from-cyan-500 to-teal-500",
    glow: "shadow-cyan-500/25",
    title: "Chest Rewards",
    desc: "Every 3 correct answers, unlock a mystery chest — Wood, Iron, or Gold — and swap or steal coins.",
  },
  {
    icon: Target,
    color: "from-amber-500 to-orange-500",
    glow: "shadow-amber-500/25",
    title: "Skill vs Luck Scale",
    desc: "Tune the Coin-Quest game mode from pure knowledge to pure luck — or anywhere in between.",
  },
];

const stats = [
  { value: "10s", label: "Quiz creation" },
  { value: "∞", label: "Players per game" },
  { value: "4", label: "Game modes" },
  { value: "100%", label: "Free to start" },
];

export default function Home() {
  const [code, setCode] = useState("");
  const [, setLocation] = useLocation();

  const handleJoin = () => {
    if (code.trim()) setLocation(`/join?code=${code.trim()}`);
    else setLocation("/join");
  };

  return (
    <div className="relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none bg-grid opacity-100" />
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] glow-orb bg-violet-600/20 pointer-events-none" />
      <div className="fixed top-[10%] right-[-15%] w-[500px] h-[500px] glow-orb bg-pink-600/15 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[30%] w-[400px] h-[400px] glow-orb bg-cyan-600/10 pointer-events-none" />

      {/* Hero */}
      <section className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-20 text-center">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
          <span className="pill-badge mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI-powered quiz platform
          </span>
        </motion.div>

        <motion.h1
          custom={1} variants={fadeUp} initial="hidden" animate="show"
          className="text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tighter leading-none max-w-4xl mx-auto"
        >
          <span className="text-foreground">Learning </span>
          <span className="text-gradient-primary">meets</span>
          <br />
          <span className="text-foreground">competition</span>
          <span className="text-secondary">.</span>
        </motion.h1>

        <motion.p
          custom={2} variants={fadeUp} initial="hidden" animate="show"
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed"
        >
          Create AI-powered quizzes, host live multiplayer games, and keep students engaged with chest rewards and real-time leaderboards.
        </motion.p>

        {/* Join widget */}
        <motion.div
          custom={3} variants={fadeUp} initial="hidden" animate="show"
          className="mt-10 w-full max-w-sm mx-auto"
        >
          <div className="relative p-1 rounded-2xl bg-gradient-to-r from-primary via-secondary to-accent">
            <div className="bg-card rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Join a Game</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter game code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="text-center text-lg font-bold tracking-widest uppercase h-12 bg-background/60 border-border/60 focus:border-primary/60"
                  maxLength={8}
                />
                <Button
                  onClick={handleJoin}
                  className="h-12 px-4 bg-gradient-to-r from-primary to-secondary border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:opacity-90 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Teacher CTAs */}
        <motion.div
          custom={4} variants={fadeUp} initial="hidden" animate="show"
          className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button asChild variant="outline" size="lg" className="gap-2 border-border/60 hover:border-primary/50 hover:bg-primary/5">
            <Link href="/login">
              <Zap className="w-4 h-4 text-primary" />
              Teacher Login
            </Link>
          </Button>
          <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-primary to-secondary border-0 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:opacity-90 transition-all">
            <Link href="/login">
              <Star className="w-4 h-4" />
              Create Free Account
            </Link>
          </Button>
        </motion.div>

        {/* Stats row */}
        <motion.div
          custom={5} variants={fadeUp} initial="hidden" animate="show"
          className="mt-16 flex flex-wrap items-center justify-center gap-8 md:gap-12"
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-gradient-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="relative px-4 pb-24 max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Everything you need to<br />
            <span className="text-gradient-primary">run amazing games</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Built for teachers who want engagement, not just quizzes.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              whileHover={{ y: -6 }}
              className="group relative rounded-2xl border border-border/60 bg-card p-6 card-glow cursor-default"
            >
              <div className={`inline-flex w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} items-center justify-center shadow-lg ${f.glow} mb-4 group-hover:scale-110 transition-transform`}>
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom CTA band */}
      <section className="relative px-4 pb-20 max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/20 via-card to-secondary/20 border border-primary/20 p-10 md:p-14 text-center"
        >
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="relative z-10 space-y-5">
            <Trophy className="w-12 h-12 mx-auto text-amber-400" />
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Ready to engage your class?
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Create your first AI-generated quiz in under 30 seconds. No credit card required.
            </p>
            <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-primary to-secondary border-0 shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:opacity-90 transition-all text-base px-8">
              <Link href="/login">
                <Zap className="w-5 h-5" />
                Get started — it's free
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
