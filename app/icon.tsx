import { ImageResponse } from "next/og";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 64,
        height: 64,
        background: "#17392e",
        color: "#d9ed9a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 25,
        fontWeight: 700,
        borderRadius: 14,
        letterSpacing: -2,
      }}
    >
      TE
    </div>,
    size,
  );
}
