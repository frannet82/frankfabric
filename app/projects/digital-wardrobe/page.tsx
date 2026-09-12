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
      <div className="max-w-[1100px] mx-auto px-6 pt-8 pb-3">
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

      <section className="max-w-[1100px] mx-auto px-6 pt-8 pb-4 text-center">
        <span className="font-mono text-xs tracking-[2px] uppercase text-cloud-blue">{"// Live Demo"}</span>
        <h1 className="font-display font-semibold text-[clamp(28px,3.6vw,42px)] tracking-tight text-[#f4f6fb] mt-3 mb-3">
          Digital Wardrobe Avatar Builder
        </h1>
        <p className="text-[15px] leading-relaxed text-[#9aa2b4] max-w-[560px] mx-auto font-light">
          Style a real-time 3D model: rotate and zoom the avatar, swap tops, bottoms, shoes, and hats, and
          recolor each piece on the fly. Built as a fully interactive React Three Fiber component, part of
          the Frank Cloud Fabric portfolio.
        </p>
      </section>

      <section className="max-w-[900px] mx-auto px-6 pb-24">
        <WardrobeBuilder />
      </section>
    </main>
  );
}
