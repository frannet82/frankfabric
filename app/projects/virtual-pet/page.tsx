import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import VirtualPet from "@/components/pet/VirtualPet";

export const metadata = {
  title: "Fabric Pet Virtual Tamagotchi — Frank Cloud Fabric",
  description:
    "A client-side 3D virtual pet: feed, play with, and care for a rigged, animated 3D Miniature Schnauzer that lives in your browser. Its stats decay over time and it reacts to how you look after it — no server, all in the browser.",
};

export default function VirtualPetPage() {
  return (
    <main
      className="min-h-screen relative"
      style={{
        background:
          "radial-gradient(1000px 720px at 86% -4%, rgba(224,138,76,0.22), transparent 54%), radial-gradient(900px 700px at 6% 4%, rgba(240,166,60,0.18), transparent 56%), linear-gradient(180deg, #fbf3e4 0%, #fffaf0 45%, #fbf3e4 100%)",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 pt-8 pb-3">
        <nav className="flex items-center justify-between gap-6 py-3 px-5 rounded-full border border-pet-accentSoft bg-pet-paper/80 backdrop-blur-md shadow-sm">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="font-display font-semibold text-[16px] text-pet-ink tracking-tight">
              Frank<span className="text-pet-accent">.</span>CloudFabric
            </span>
          </Link>
          <Link href="/#projects" className="text-[14px] text-pet-inkSoft hover:text-pet-accent">
            ← Back to Portfolio
          </Link>
        </nav>
      </div>

      <section className="max-w-[1100px] mx-auto px-6 pt-8 pb-4 text-center">
        <span className="font-mono text-xs tracking-[2px] uppercase text-pet-accent">{"// Live Demo"}</span>
        <h1 className="font-display font-semibold text-[clamp(28px,3.6vw,42px)] tracking-tight text-pet-ink mt-3 mb-3">
          Fabric Pet <span className="text-pet-accent">Virtual Tamagotchi</span>
        </h1>
        <p className="text-[15px] leading-relaxed text-pet-inkSoft max-w-[560px] mx-auto font-light">
          Meet a rigged, animated 3D Miniature Schnauzer that lives entirely in your browser. Feed it, play with it, let it
          rest, and keep it clean — its hunger, happiness, energy, and cleanliness decay in real time and it sits, naps,
          wags, barks and follows your cursor depending on how you care for it. State is saved locally, so your pup
          remembers you between visits. No server, no API key, part of the Frank Cloud Fabric portfolio.
        </p>
      </section>

      <section className="max-w-[900px] mx-auto px-6 pb-24">
        {/* VirtualPet's root is positioned `absolute inset-0` (it fills its
            parent), so it needs a sized relative container here to establish a
            positioning context and give it height. */}
        <div className="relative w-full min-h-[600px] rounded-3xl overflow-hidden border border-pet-accentSoft bg-pet-paper shadow-[0_10px_40px_rgba(224,138,76,0.22)]">
          <VirtualPet />
        </div>
      </section>
    </main>
  );
}
