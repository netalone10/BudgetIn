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
          background: "#01696f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "sans-serif",
            lineHeight: 1,
            letterSpacing: "-1px",
          }}
        >
          C
        </span>
      </div>
    ),
    { ...size }
  );
}
