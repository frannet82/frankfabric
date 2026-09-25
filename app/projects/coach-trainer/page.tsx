import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import CoachChatbot from "@/components/coach/CoachChatbot";

export const metadata = {
  title: "Coach Fabric Smart Fit Trainer — Frank Cloud Fabric",
  description:
    "A client-side conversational gym coach with a 3D avatar: get a workout matched to your goal and level, list the exercises, and get walked through a routine by a deterministic in-browser engine.",
};

export default function CoachTrainerPage() {
  return (
    <main
      className="min-h-screen relative"
      style={{
        background:
          "radial-gradient(1000px 720px at 86% -4%, rgba(230,0,126,0.28), transparent 54%), radial-gradient(900px 700px at 6% 4%, rgba(255,242,0,0.20), transparent 56%), linear-gradient(180deg, #111111 0%, #1a1a1a 55%, #111111 100%)",
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 pt-8 pb-3">
        <nav className="flex items-center justify-between gap-6 py-3 px-5 rounded-full border border-sf-yellow/40 bg-sf-black/70 backdrop-blur-md shadow-sm">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="font-display font-semibold text-[16px] text-sf-mist tracking-tight">
              Frank<span className="text-sf-yellow">.</span>CloudFabric
            </span>
          </Link>
          <Link href="/#projects" className="text-[14px] text-sf-mist/70 hover:text-sf-yellow">
            ← Back to Portfolio
          </Link>
        </nav>
      </div>

      <section className="max-w-[1600px] mx-auto px-6 pt-8 pb-4 text-center">
        <span className="font-mono text-xs tracking-[2px] uppercase text-sf-yellow">Make room for movement</span>
        <h1 className="font-display font-bold text-[clamp(28px,3.6vw,42px)] tracking-tight text-sf-mist mt-3 mb-3">
          Coach Fabric <span className="text-sf-yellow">Smart Fit</span> Trainer
        </h1>
        <p className="text-sf-mist text-[16px] leading-relaxed opacity-75 max-w-[680px] mx-auto">
          Build a routine around your goals, experience, and available time. Ask your coach for a workout, then work through the exercises at your pace.
        </p>
      </section>

      <section className="max-w-[1600px] mx-auto px-3 sm:px-6 pb-10">
        {/* CoachChatbot's root is positioned `absolute inset-0` (it fills its
            parent), so it needs a sized relative container here to establish a
            positioning context and give it height. */}
        <div className="relative w-full h-[850px] md:h-[max(720px,calc(100dvh-250px))] rounded-3xl overflow-hidden border border-sf-yellow/40 bg-sf-black shadow-[0_10px_40px_rgba(230,0,126,0.25)]">
          <CoachChatbot />
        </div>
      </section>
      <nav aria-label="Explore projects" className="text-sf-mist max-w-[1600px] mx-auto px-6 pb-10 flex flex-wrap gap-3 text-sm">
        <Link className="rounded-full border border-current/20 px-5 py-2 hover:opacity-70" href="/projects/chef-chatbot">Kitchen</Link>
        <Link className="rounded-full border border-current/20 px-5 py-2 hover:opacity-70" href="/projects/virtual-pet">Pet companion</Link>
        <Link className="rounded-full border border-current/20 px-5 py-2 hover:opacity-70" href="/projects/digital-wardrobe">Wardrobe</Link>
      </nav>
    </main>
  );
}
