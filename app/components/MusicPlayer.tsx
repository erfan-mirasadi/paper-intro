"use client";

import { useEffect, useRef, useState } from "react";

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const fadeOutDuration = 2; // 2 seconds fade out
  const loopTime = 25; // 25 seconds

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // Start fade out
      if (audio.currentTime >= loopTime - fadeOutDuration && audio.currentTime < loopTime) {
         const remainingTime = loopTime - audio.currentTime;
         const volume = Math.max(0, Math.min(1, remainingTime / fadeOutDuration));
         audio.volume = volume;
      } else if (audio.currentTime < loopTime - fadeOutDuration) {
         // ensure volume is 1 if it's before the fade
         audio.volume = 1;
      }

      // Loop back
      if (audio.currentTime >= loopTime) {
         audio.currentTime = 0;
         audio.volume = 1;
         if (isPlaying) {
            audio.play().catch(console.error);
         }
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.volume = 1;
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <button
      onClick={togglePlay}
      className="absolute top-6 right-6 z-[999] p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-white/10 hover:scale-105 transition-all cursor-pointer shadow-lg"
      aria-label="Toggle Music"
    >
      <audio ref={audioRef} src="/music.mp4" preload="auto" />
      {isPlaying ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      )}
    </button>
  );
}
