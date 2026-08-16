import { useEffect, useState } from "react";

const COLOR_MAP = {
  blue: { bg: "#dbe9fb", fg: "#185fa5" },
  teal: { bg: "#d7f3ee", fg: "#0f7a67" },
  coral: { bg: "#fde2dd", fg: "#c0392b" },
  pink: { bg: "#fbe0f0", fg: "#a3266b" },
  purple: { bg: "#eae0fb", fg: "#6c3fc7" },
  amber: { bg: "#fcecd2", fg: "#a86b0a" },
  green: { bg: "#dff5df", fg: "#2f7a2f" },
};

export default function Avatar({ username, avatarColor = "blue", avatarUrl, size = 38 }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [avatarUrl]);

  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt={username || "avatar"}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          objectPosition: "center",
          aspectRatio: "1 / 1",
          minWidth: size,
          minHeight: size,
          display: "block",
          flexShrink: 0,
        }}
        onError={() => setImageFailed(true)}
      />
    );
  }

  const colors = COLOR_MAP[avatarColor] || COLOR_MAP.blue;
  const initials = username ? username.slice(0, 2).toUpperCase() : "??";

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colors.bg,
        color: colors.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.34),
        fontWeight: 500,
        aspectRatio: "1 / 1",
        minWidth: size,
        minHeight: size,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
