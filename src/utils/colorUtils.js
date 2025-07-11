// src/utils/colorUtils.js
/*
 * Given a hex color (e.g. "#abc" or "aabbcc"), returns either "#000000" or "#FFFFFF"
 * depending on perceived brightness (YIQ formula).
 * */
export function getContrastColor(inputColor) {
  // Normalize hex (strip "#" if present)
  let hex = inputColor.startsWith("#") ? inputColor.slice(1) : inputColor;
  // Expand 3-digit hex to 6-digit
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Compute YIQ brightness
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq > 128 ? "#000000" : "#FFFFFF";
}
