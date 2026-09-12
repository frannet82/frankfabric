export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="relative grid place-items-center"
    >
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cloud-blue to-cloud-violet shadow-[0_0_16px_rgba(63,169,255,0.6)]" />
      <svg viewBox="0 0 20 20" width={size * 0.6} height={size * 0.6} className="relative">
        <path d="M2 6 H18 M2 10 H18 M2 14 H18" stroke="#0b0f1a" strokeWidth="1.4" />
        <path d="M6 2 V18 M10 2 V18 M14 2 V18" stroke="#0b0f1a" strokeWidth="1.4" />
      </svg>
    </div>
  );
}
