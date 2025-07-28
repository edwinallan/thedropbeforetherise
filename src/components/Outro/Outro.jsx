import React, { useRef } from "react";
import styles from "./Outro.module.css";
import { useParallax } from "../../hooks/useParallax";
import { track } from "../../utils/analytics";

// Spam-proofed email assembly
const collaborationEmail = "doane" + "@" + "allan.ch";

// Default URLs for social links
const defaultLinkUrls = {
  instagram: "https://www.instagram.com/doane.music",
  tiktok: "https://www.tiktok.com/",
  spotify: "https://open.spotify.com/",
  apple: "https://music.apple.com/",
};

export default function Outro({
  onReplay,
  showReplay = true,
  useClickableLinks = true,
}) {
  const replayRef = useRef(null);
  const joinRef = useRef(null);
  const linksRef = useRef(null);
  const outroRef = useRef(null);

  useParallax([joinRef], 25);

  const handleReplay = () => {
    track("replay");
    onReplay();
  };

  return (
    <div className={styles.container}>
      <div className={styles.panel} ref={outroRef}>
        <a
          ref={joinRef}
          className={styles.join}
          href={`mailto:${collaborationEmail}?subject=${encodeURIComponent(
            "I'd I'd like to collaborate with you"
          )}`}
          onClick={(e) => {
            e.stopPropagation();
            track("contact");
          }}
        >
          JOIN
        </a>
      </div>
      <div ref={linksRef} className={styles.links}>
        {["instagram", "tiktok", "spotify", "apple"].map((n) =>
          useClickableLinks ? (
            <a
              key={n}
              href={defaultLinkUrls[n]}
              target="_blank"
              rel="noopener noreferrer"
            >
              {n}
            </a>
          ) : (
            <span key={n}>{n}</span>
          )
        )}
      </div>
      {showReplay && (
        <div
          ref={replayRef}
          className={styles.column}
          onClick={(e) => {
            e.stopPropagation();
            handleReplay();
          }}
        >
          <span className={styles.icon}>⟳</span>
          <span>REPLAY</span>
        </div>
      )}
    </div>
  );
}
