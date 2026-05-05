import { ImageResponse } from "next/og";

export const alt = "BudgetIn - Catat pengeluaran dan kelola keuangan pribadi";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0d0d0d 0%, #10231c 55%, #18E299 100%)",
          color: "#ffffff",
          padding: "80px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            fontSize: 32,
            fontWeight: 700,
            color: "#18E299",
          }}
        >
          BudgetIn
        </div>
        <div
          style={{
            marginTop: "36px",
            maxWidth: "900px",
            fontSize: 72,
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: "-2px",
          }}
        >
          Budget tracker yang terasa seperti ngobrol
        </div>
        <div
          style={{
            marginTop: "28px",
            maxWidth: "820px",
            fontSize: 30,
            lineHeight: 1.35,
            color: "#d8fff0",
          }}
        >
          Catat pengeluaran, pantau saldo, atur budget, tagihan, dan tabungan pribadi dengan input cepat berbasis teks.
        </div>
      </div>
    ),
    size
  );
}
