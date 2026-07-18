// Pure-CSS logo lockup per design handoff §Brand — pin sizes per placement.

type Variant = "intro" | "login" | "side";

const SPECS: Record<
  Variant,
  {
    box: [number, number];
    pin: { left: number; top: number; size: number; glow: number };
    hole: { left: number; top: number; size: number };
    word: number;
    wordSpacing: string;
    product: number;
    productSpacing: number;
    productTop: number;
    gap: number;
  }
> = {
  intro: {
    box: [76, 84],
    pin: { left: 8, top: 3, size: 60, glow: 44 },
    hole: { left: 30, top: 22, size: 17 },
    word: 46,
    wordSpacing: "-2px",
    product: 12,
    productSpacing: 5,
    productTop: 10,
    gap: 26,
  },
  login: {
    box: [54, 60],
    pin: { left: 5, top: 2, size: 44, glow: 30 },
    hole: { left: 21, top: 16, size: 12 },
    word: 32,
    wordSpacing: "-1px",
    product: 10.5,
    productSpacing: 4,
    productTop: 7,
    gap: 16,
  },
  side: {
    box: [32, 36],
    pin: { left: 3, top: 1, size: 26, glow: 18 },
    hole: { left: 12, top: 9, size: 8 },
    word: 17,
    wordSpacing: "-.5px",
    product: 6.5,
    productSpacing: 2.2,
    productTop: 3,
    gap: 11,
  },
};

export default function Logo({ variant }: { variant: Variant }) {
  const s = SPECS[variant];
  const animated = variant === "intro";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s.gap }}>
      <div
        style={{
          position: "relative",
          width: s.box[0],
          height: s.box[1],
          flex: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: s.pin.left,
            top: s.pin.top,
            width: s.pin.size,
            height: s.pin.size,
            background: "linear-gradient(135deg,#6ef0a0,#2fae5e)",
            borderRadius: "50% 50% 50% 0",
            transform: "rotate(45deg)",
            animation: animated ? "pinbob 2.6s ease-in-out infinite" : undefined,
            boxShadow: `0 0 ${s.pin.glow}px rgba(74,222,128,${animated ? ".45" : variant === "login" ? ".4" : ".35"})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: s.hole.left,
            top: s.hole.top,
            width: s.hole.size,
            height: s.hole.size,
            borderRadius: "50%",
            background: "var(--deep)",
          }}
        />
        {animated && (
          <>
            <div
              style={{
                position: "absolute",
                left: 19,
                bottom: 4,
                width: 38,
                height: 9,
                borderRadius: "50%",
                background: "rgba(74,222,128,.18)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 11,
                bottom: -4,
                width: 54,
                height: 22,
                borderRadius: "50%",
                border: "1px solid rgba(74,222,128,.4)",
                animation: "ping 2.2s infinite",
              }}
            />
          </>
        )}
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-sg)",
            fontWeight: 800,
            fontSize: s.word,
            letterSpacing: s.wordSpacing,
            color: "var(--text)",
            lineHeight: 1,
          }}
        >
          Alex
          {variant === "intro" ? (
            <span
              style={{
                background: "linear-gradient(90deg,#6ef0a0,#2fae5e)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              .ai
            </span>
          ) : (
            <span style={{ color: "var(--green)" }}>.ai</span>
          )}
        </div>
        <div
          className="mono"
          style={{
            fontWeight: 600,
            fontSize: s.product,
            letterSpacing: s.productSpacing,
            color: "#aeb6c0",
            marginTop: s.productTop,
          }}
        >
          A <span style={{ color: "var(--green)" }}>XORVION</span> PRODUCT
        </div>
      </div>
    </div>
  );
}
