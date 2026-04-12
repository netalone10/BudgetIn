import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "linear-gradient(135deg, #01696f 0%, #0c4e54 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Top-right coin accent */}
        <div
          style={{
            position: "absolute",
            top: 28,
            right: 28,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            border: "2.5px solid rgba(255,255,255,0.35)",
          }}
        />
        {/* Bottom-left coin accent */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 24,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
          }}
        />
        {/* Letter B */}
        <span
          style={{
            color: "#ffffff",
            fontSize: 104,
            fontWeight: 800,
            fontFamily: "sans-serif",
            lineHeight: 1,
            letterSpacing: "-3px",
          }}
        >
          B
        </span>
      </div>
    ),
    { ...size }
  );
}
