import { ImageResponse } from "next/og";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 64,
        height: 64,
        background: "#164b7a",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 25,
        fontWeight: 700,
        borderRadius: 4,
        letterSpacing: -2,
      }}
    >
      RS
    </div>,
    size,
  );
}
