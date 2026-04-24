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
          borderRadius: 6,
          background: "#facc15",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Bar chart — three bars of increasing height */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, paddingBottom: 3 }}>
          <div style={{ width: 5, height: 8,  background: "#1e293b", borderRadius: 1 }} />
          <div style={{ width: 5, height: 13, background: "#1e293b", borderRadius: 1 }} />
          <div style={{ width: 5, height: 18, background: "#1e293b", borderRadius: 1 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
