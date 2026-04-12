import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "linear-gradient(135deg, #01696f 0%, #0c4e54 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Coin circle accent */}
        <div
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
          }}
        />
        <span
          style={{
            color: "#ffffff",
            fontSize: 18,
            fontWeight: 800,
            fontFamily: "sans-serif",
            lineHeight: 1,
            letterSpacing: "-0.5px",
          }}
        >
          B
        </span>
      </div>
    ),
    { ...size }
  );
}
