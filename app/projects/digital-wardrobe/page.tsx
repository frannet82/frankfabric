import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import WardrobeBuilder from "@/components/WardrobeBuilder";

export const metadata = {
  title: "Digital Wardrobe Avatar Builder — Frank Cloud Fabric",
  description:
    "A real-time interactive 3D outfit builder: rotate the model and swap garments and colors live in the browser.",
};

export default function DigitalWardrobePage() {
  return (
    <main
      className="min-h-screen relative"
      style={{
        background:
          "radial-gradient(1000px 720px at 86% -4%, rgba(63,169,255,0.16), transparent 54%), radial-gradient(900px 700px at 6% 4%, rgba(155,107,255,0.16), transparent 56%), linear-gradient(180deg, #05060c 0%, #06071a 45%, #05060c 100%)",
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 pt-8 pb-3">
        <nav className="flex items-center justify-between gap-6 py-3 px-5 rounded-full border border-white/20 bg-white/[0.06] backdrop-blur-md">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="font-display font-semibold text-[16px] text-white tracking-tight">
              Frank<span className="text-cloud-mist">.</span>CloudFabric
            </span>
          </Link>
          <Link href="/#projects" className="text-[14px] text-white/80 hover:text-white">
            ← Back to Portfolio
          </Link>
        </nav>
      </div>

      <section className="max-w-[1600px] mx-auto px-6 pt-8 pb-4 text-center">
        <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue">Your personal style studio</span>
        <h1 className="font-display font-semibold text-[clamp(28px,3.6vw,42px)] tracking-tight text-[#f4f6fb] mt-3 mb-3">
          Digital Wardrobe Avatar Builder
        </h1>
        <p className="text-white text-[16px] leading-relaxed opacity-75 max-w-[680px] mx-auto">
          Explore silhouettes, combine your favorite pieces, and make every color your own. Drag to turn the model and zoom in to see the details.
        </p>
      </section>

      <section className="max-w-[1600px] mx-auto px-3 sm:px-6 pb-10">
        <WardrobeBuilder />
      </section>
      <nav aria-label="Explore projects" className="text-white max-w-[1600px] mx-auto px-6 pb-10 flex flex-wrap gap-3 text-sm">
        <Link className="rounded-full border border-current/20 px-5 py-2 hover:opacity-70" href="/projects/chef-chatbot">Kitchen</Link>
        <Link className="rounded-full border border-current/20 px-5 py-2 hover:opacity-70" href="/projects/coach-trainer">Fitness studio</Link>
        <Link className="rounded-full border border-current/20 px-5 py-2 hover:opacity-70" href="/projects/virtual-pet">Pet companion</Link>
      </nav>
    </main>
  );
}
