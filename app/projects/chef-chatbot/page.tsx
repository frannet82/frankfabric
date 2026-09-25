import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import ChefChatbot from "@/components/chef/ChefChatbot";

export const metadata = {
  title: "Chef Fabric Recipe Assistant — Frank Cloud Fabric",
  description:
    "A client-side conversational chef with a 3D avatar: ask for recipes, cook with the ingredients you have, and get step-by-step instructions from a deterministic in-browser engine.",
};

export default function ChefChatbotPage() {
  return (
    <main
      className="min-h-screen relative"
      style={{
        background:
          "radial-gradient(1000px 720px at 86% -4%, rgba(143,211,232,0.35), transparent 54%), radial-gradient(900px 700px at 6% 4%, rgba(143,206,122,0.35), transparent 56%), linear-gradient(180deg, #fdf6e3 0%, #f5e8c7 55%, #fdf6e3 100%)",
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 pt-8 pb-3">
        <nav className="flex items-center justify-between gap-6 py-3 px-5 rounded-full border border-ac-leaf/50 bg-ac-cream/80 backdrop-blur-md shadow-sm">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="font-display font-semibold text-[16px] text-ac-brown tracking-tight">
              Frank<span className="text-ac-leafDark">.</span>CloudFabric
            </span>
          </Link>
          <Link href="/#projects" className="text-[14px] text-ac-brownSoft hover:text-ac-brown">
            ← Back to Portfolio
          </Link>
        </nav>
      </div>

      <section className="max-w-[1600px] mx-auto px-6 pt-8 pb-4 text-center">
        <span className="font-mono text-xs tracking-[2px] uppercase text-ac-leafDark">Your kitchen companion</span>
        <h1 className="font-display font-semibold text-[clamp(28px,3.6vw,42px)] tracking-tight text-ac-brown mt-3 mb-3">
          Chef Fabric Recipe Assistant
        </h1>
        <p className="text-ac-brownSoft text-[16px] leading-relaxed opacity-75 max-w-[680px] mx-auto">
          Find something delicious in the ingredients you already have. Ask for a recipe, explore substitutions, or cook along one step at a time.
        </p>
      </section>

      <section className="max-w-[1600px] mx-auto px-3 sm:px-6 pb-10">
        {/* ChefChatbot's root is positioned `absolute inset-0` (it was built to
            fill an aspect-video card), so it needs a sized relative container
            here to establish a positioning context and give it height. */}
        <div className="relative w-full h-[850px] md:h-[max(720px,calc(100dvh-250px))] rounded-3xl overflow-hidden border border-ac-leaf/50 bg-ac-cream shadow-[0_10px_40px_rgba(107,79,42,0.15)]">
          <ChefChatbot />
        </div>
      </section>
      <nav aria-label="Explore projects" className="text-ac-brownSoft max-w-[1600px] mx-auto px-6 pb-10 flex flex-wrap gap-3 text-sm">
        <Link className="rounded-full border border-current/20 px-5 py-2 hover:opacity-70" href="/projects/coach-trainer">Fitness studio</Link>
        <Link className="rounded-full border border-current/20 px-5 py-2 hover:opacity-70" href="/projects/virtual-pet">Pet companion</Link>
        <Link className="rounded-full border border-current/20 px-5 py-2 hover:opacity-70" href="/projects/digital-wardrobe">Wardrobe</Link>
      </nav>
    </main>
  );
}
