import { ImageResponse } from "next/og";

export const alt = "RELAY — Private In-Browser File Converter";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#111111",
          backgroundImage: "radial-gradient(circle at 85% 15%, rgba(255, 79, 0, 0.25) 0%, transparent 60%), radial-gradient(circle at 15% 85%, rgba(255, 212, 0, 0.15) 0%, transparent 50%)",
          padding: "64px",
          fontFamily: "sans-serif",
          color: "#ffffff",
        }}
      >
        {/* Top bar: Brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                backgroundColor: "#FF4F00",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "24px",
                color: "#ffffff",
              }}
            >
              ▶▶
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-0.03em" }}>RELAY</span>
              <span style={{ fontSize: "14px", color: "#FFD400", fontWeight: 700, letterSpacing: "0.1em" }}>
                ZERO-UPLOAD FILE CONVERTER
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "9999px",
              backgroundColor: "rgba(255, 79, 0, 0.15)",
              border: "1px solid rgba(255, 79, 0, 0.4)",
              color: "#FF4F00",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            🔒 100% Client-Side
          </div>
        </div>

        {/* Center: Hero Heading */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "980px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: "60px", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
            <span>Convert Any File.&nbsp;</span>
            <span style={{ color: "#FF4F00" }}>Privately.&nbsp;</span>
            <span>Right in Your Browser.</span>
          </div>
          <div style={{ display: "flex", fontSize: "24px", color: "#a3a3a0", fontWeight: 400, lineHeight: 1.4 }}>
            Documents, images, audio, archives, data & 3D models processed locally using Web Workers & WebAssembly.
          </div>
        </div>

        {/* Bottom bar: Format badges & value props */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", borderTop: "1px solid #2b2b2b", paddingTop: "28px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {["HEIC", "PDF", "TAR", "ZIP", "CSV", "JSON", "DOCX", "MP4 → GIF"].map((fmt) => (
              <div
                key={fmt}
                style={{
                  display: "flex",
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333333",
                  color: "#ffffff",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "15px",
                  fontWeight: 700,
                }}
              >
                {fmt}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "16px", color: "#FFD400", fontWeight: 800 }}>⚡ 0 Bytes Uploaded — Ever</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
