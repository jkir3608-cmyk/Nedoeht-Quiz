import { Link } from "wouter";
import { Zap, ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <Link href="/">
        <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mb-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </Link>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-primary uppercase tracking-widest">QuizzyBlast Inc.</span>
        </div>
        <h1 className="text-4xl font-black">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm">Effective Date: The day you were born · Last Updated: Right now, as you read this</p>
      </div>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">1. Introduction</h2>
          <p>At QuizzyBlast, your privacy is extremely important to us. We think about it constantly. We have meetings about it. Sometimes we think about it so hard that we forget to actually do anything about it. This Privacy Policy explains what data we collect, what we do with it, and what we tell ourselves we're doing with it (which may differ).</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">2. Information We Collect</h2>
          <p>We collect the following information when you use QuizzyBlast:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Your nickname (we judge it immediately)</li>
            <li>Your chosen avatar emoji (this tells us everything we need to know about you)</li>
            <li>Your quiz scores (stored forever as a reminder of your performance)</li>
            <li>Your general vibe (inferred from which avatar you picked — 🤡 users get flagged)</li>
            <li>The timestamp of every correct answer you got (to calculate whether you got lucky)</li>
            <li>Your browser's favourite colour (we can't actually do this, but we like the mystery)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">3. How We Use Your Information</h2>
          <p>We use your data to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Run the leaderboard (so everyone can see your shame or glory)</li>
            <li>Send you absolutely zero marketing emails (we are too lazy)</li>
            <li>Improve our services, which mostly means fixing bugs nobody reported</li>
            <li>Compile a report called "Who Is Really Good At Quizzes" that nobody reads</li>
            <li>Whisper your nickname to the server at 3 AM for good luck</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">4. Sharing Your Information</h2>
          <p>We do not sell your personal data to third parties. We give it away for free to our very exclusive list of partners, which currently includes:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Your teacher (they already know your score anyway)</li>
            <li>The leaderboard (literally everyone in the game can see your name)</li>
            <li>Our intern Dave, who has full database access and no supervision</li>
            <li>Nobody else, probably</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">5. Cookies</h2>
          <p>We use cookies on our platform. We would also like regular cookies, specifically snickerdoodles. If you would like to send us snickerdoodles, please reach out. We cannot promise they will improve your data privacy but they will improve our mood, which may indirectly result in better privacy practices.</p>
          <p>You may disable cookies in your browser settings. This will break everything. Good luck.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">6. Data Retention</h2>
          <p>We retain your data for as long as necessary, which we define as "until something goes wrong and we have to wipe the database." Historical records suggest this happens approximately once per semester. Your high score will be remembered in our hearts forever, even if not in our servers.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">7. Children's Privacy</h2>
          <p>QuizzyBlast is used by students of all ages. We take children's privacy very seriously, which is why we only collect their nicknames, avatars, and scores, and display them publicly on a live leaderboard visible to the entire class. We feel this is fine.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">8. Security</h2>
          <p>We protect your data using industry-leading security measures including, but not limited to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>A very strong password (it has a capital letter AND a number)</li>
            <li>Hoping for the best</li>
            <li>Positive affirmations directed at the server</li>
            <li>Not telling anyone where the database is (we kind of forgot too)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">9. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. To exercise these rights, please submit a formal written request by carrier pigeon to our headquarters in Quizzylvania. Processing time is 6–8 weeks or one ice age, whichever comes first.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">10. Changes to This Policy</h2>
          <p>We reserve the right to update this Privacy Policy at any time. We will notify you of material changes by posting a small notice somewhere on the website that you will definitely scroll past without reading. Just like you almost scrolled past this sentence.</p>
        </section>

        <div className="pt-4 border-t border-border/40 text-xs text-muted-foreground/60">
          <p>If you have privacy concerns, please send them to privacy@quizzyblast.example.com where they will be read by our automated system, given a ticket number, and quietly archived.</p>
          <p className="mt-1">© {new Date().getFullYear()} QuizzyBlast Inc. All rights reserved, including the right to change any of this at any moment for any reason.</p>
        </div>
      </div>
    </div>
  );
}
