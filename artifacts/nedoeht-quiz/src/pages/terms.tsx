import { Link } from "wouter";
import { Zap, ArrowLeft } from "lucide-react";

export default function Terms() {
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
        <h1 className="text-4xl font-black">Terms of Service</h1>
        <p className="text-muted-foreground text-sm">Effective Date: January 1, 2024 · Last Updated: Yesterday at 11:58 PM</p>
      </div>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground leading-relaxed">

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">1. Acceptance of Terms</h2>
          <p>By accessing or using QuizzyBlast ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must immediately close this tab, go outside, touch grass, and reconsider your life choices. We are not responsible for any grass-related injuries that occur as a result.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">2. Eligibility</h2>
          <p>You must be at least 4 years old to use QuizzyBlast. Users under the age of 4 are welcome but will need assistance reaching the keyboard. We accept no liability for drool on the screen. You also must not be a time-traveling dinosaur. If you are, please contact support — we have questions.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">3. User Conduct</h2>
          <p>You agree NOT to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Use QuizzyBlast while operating heavy machinery (scooters included)</li>
            <li>Answer questions incorrectly on purpose just to annoy your teacher</li>
            <li>Blame QuizzyBlast when you fail your actual exam after using this to "study"</li>
            <li>Sell your QuizzyBlast account for crypto, NFTs, or Pokémon cards</li>
            <li>Name your avatar anything that contains the word "fortnite"</li>
            <li>Claim you scored first place when you were actually playing alone</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">4. Intellectual Property</h2>
          <p>All content on QuizzyBlast — including but not limited to the logo, the emoji avatars, the vibes, and the general aura of the website — is the exclusive property of QuizzyBlast Inc. and its subsidiaries, QuizzyBlast LLC, QuizzyBlast GmbH, and Blastly Quizzy Holdings (Cayman Islands). Unauthorized reproduction of the vibes is strictly prohibited.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">5. Limitation of Liability</h2>
          <p>QuizzyBlast is not liable for:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Emotional damage caused by losing to someone named "CoolKid2009"</li>
            <li>The shattering of your ego when a 7-year-old beats you</li>
            <li>Addiction to checking the leaderboard every 0.3 seconds</li>
            <li>Any confetti that somehow got through your screen</li>
            <li>Friends who unmute themselves during a quiz and breathe too loud</li>
            <li>Teachers who use this to give surprise quizzes on a Friday</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">6. Termination</h2>
          <p>We reserve the right to terminate your account at any time for any reason, including but not limited to: "we felt like it," "Mercury was in retrograde," or you selected the 🤡 avatar and lost anyway. Terminated users may re-apply after completing a 30-day reflection period and writing a 500-word essay on why they deserved it.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">7. Modifications to Terms</h2>
          <p>We may update these Terms at any time without notice, without warning, and without mercy. Continued use of the Service after a change constitutes acceptance of the new Terms. We once changed the Terms while someone was mid-quiz. They never knew. Neither did we.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">8. Governing Law</h2>
          <p>These Terms are governed by the laws of the Fictional Republic of Quizzylvania, where the national sport is trivia and the currency is knowledge (and also coins, in-game). Any disputes shall be settled by a best-of-5 quiz match. Loser pays court fees in Quizzylvania Doubloons.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-foreground font-bold text-lg">9. Entire Agreement</h2>
          <p>These Terms constitute the entire agreement between you and QuizzyBlast and supersede all prior agreements, conversations, pinky promises, and vibes. If any provision is found to be unenforceable, that provision will be replaced with something equally confusing.</p>
        </section>

        <div className="pt-4 border-t border-border/40 text-xs text-muted-foreground/60">
          <p>Questions? Email us at definitely-real@quizzyblast.example.com. We will respond within 3–5 business centuries.</p>
        </div>
      </div>
    </div>
  );
}
