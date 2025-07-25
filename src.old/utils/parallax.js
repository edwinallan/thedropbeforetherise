/**
 * Simple mouse‑move parallax.
 * Pass element refs to apply transform. Disabled on touch devices.
 */
export const applyParallax = (elements, strength = 25) => {
  if ("ontouchstart" in window) return;
  const handleMove = (e) => {
    const { innerWidth: w, innerHeight: h } = window;
    const x = (e.clientX - w / 2) / (w / 2);
    const y = (e.clientY - h / 2) / (h / 2);
    const rotateY = x * strength;
    const translateY = y * (strength / 10);
    elements.forEach((el) => {
      if (!el.current) return;
      el.current.style.transform = `perspective(500px) rotateY(${rotateY}deg) translateY(${translateY}px)`;
    });
  };
  window.addEventListener("mousemove", handleMove);
  return () => window.removeEventListener("mousemove", handleMove);
};
