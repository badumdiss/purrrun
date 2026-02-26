"use client";

import { useState } from "react";
import HomeScreen from "@/components/HomeScreen";
import CatGame from "@/components/CatGame";

type Screen = "home" | "game";

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [playerName, setPlayerName] = useState("");

  const handleStart = (name: string) => {
    setPlayerName(name);
    setScreen("game");
  };

  const handleQuit = () => {
    setScreen("home");
  };

  if (screen === "game") {
    return <CatGame playerName={playerName} onQuit={handleQuit} />;
  }

  return <HomeScreen onStart={handleStart} />;
}
