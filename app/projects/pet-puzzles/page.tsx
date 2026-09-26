import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { asset } from "@/lib/asset";

export const metadata = {
  title: "Pet Puzzles Tile & Tower — Frank Cloud Fabric",
  description:
    "Two original browser puzzle games behind one menu: Pet Jump, a triple-matching tray game, and Pet Tower Sort, a column-filling sort game with face-down tiles. One self-contained HTML file — original SVG artwork, synthesised sound, no assets, no server, plays offline.",
};

// The playable build is a single self-contained HTML file in public/games/.
// It is embedded here in an iframe rather than ported to React on purpose:
// it is the same artifact that ships to a game portal or gets wrapped for the
// App Store, so the portfolio demos exactly what is distributed.
const GAME_SRC = "/games/pet-puzzles.html";

export default function PetPuzzlesPage() {
  return (
    <main
      className="puzzles-page min-h-screen relative"
      style={{
        background:
          "radial-gradient(1000px 720px at 88% -4%, rgba(238,110,150,0.16), transparent 54%), radial-gradient(900px 700px at 6% 4%, rgba(47,143,107,0.14), transparent 56%), linear-gradient(180deg, #f4ede3 0%, #fffcf7 45%, #f4ede3 100%)",
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 pt-8 pb-3">
        <nav className="flex items-center justify-between gap-6 py-3 px-5 rounded-full border border-puz-rim bg-puz-paper/80 backdrop-blur-md shadow-sm">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="font-display font-semibold text-[16px] text-puz-ink tracking-tight">
              Frank<span className="text-puz-pinkDeep">.</span>CloudFabric
            </span>
          </Link>
          <Link href="/#projects" className="text-[14px] text-puz-inkSoft hover:text-puz-pinkDeep">
            ← Back to Portfolio
          </Link>
        </nav>
      </div>

      <section className="max-w-[1600px] mx-auto px-6 pt-8 pb-4 text-center">
        <span className="font-mono text-xs tracking-[2px] uppercase text-puz-leaf">{"// Live Demo"}</span>
        <h1 className="font-display font-semibold text-[clamp(28px,3.6vw,42px)] tracking-tight text-puz-ink mt-3 mb-3">
          Pet Puzzles <span className="text-puz-pinkDeep">Tile</span> &amp;{" "}
          <span className="text-puz-leafDeep">Tower</span>
        </h1>
        <p className="text-[15px] leading-relaxed text-puz-inkSoft max-w-[620px] mx-auto font-light">
          Two original puzzle games behind one menu. <strong className="font-medium text-puz-ink">Pet Jump</strong> is a
          triple-matching game — tap the front tile of eight stacks into a seven-slot tray and clear three of a kind
          before the tray fills. <strong className="font-medium text-puz-ink">Pet Tower Sort</strong> is a sorting game
          — move one tile at a time across seven capped columns until a column holds seven of a kind, with face-down
          tiles that only flip when you dig down to them.
        </p>
        <p className="text-[13.5px] leading-relaxed text-puz-inkSoft max-w-[620px] mx-auto font-light mt-4">
          Every icon is original inline SVG and every sound is synthesised with the Web Audio API, so the whole thing is
          one HTML file with no images, no audio files and no network calls. It plays offline and saves your progress
          locally.
        </p>
      </section>

      <section className="puzzles-workspace max-w-[560px] lg:max-w-[1600px] mx-auto px-6 pb-6">
        <div className="relative w-full h-[min(82vh,900px)] min-h-[620px] lg:min-h-0 lg:h-[calc(100dvh-180px)] rounded-3xl overflow-hidden border border-puz-rim bg-puz-paper shadow-[0_10px_40px_rgba(140,122,102,0.25)]">
          <iframe
            src={asset(GAME_SRC)}
            title="Pet Puzzles — Pet Jump and Pet Tower Sort"
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
          />
        </div>
      </section>

      <section className="max-w-[560px] mx-auto px-6 pb-24 text-center">
        <a
          href={asset(GAME_SRC)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-puz-leaf text-white font-display font-semibold text-[14px] shadow-[0_3px_0_#1c6147] hover:brightness-110 transition"
        >
          Open full screen
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5h10v10M19 5 7 17" />
          </svg>
        </a>
        <p className="text-[12px] text-puz-inkSoft mt-3 font-light">
          Play on desktop or mobile. Use the speaker button to mute sound.
        </p>
      </section>
    </main>
  );
}
