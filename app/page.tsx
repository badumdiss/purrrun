"use client";

import { useState } from "react";
import HomeScreen from "@/components/HomeScreen";
import CatGame from "@/components/CatGame";
import Leaderboard from "@/components/Leaderboard";

type Screen = "home" | "game" | "leaderboard";

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [playerName, setPlayerName] = useState("");

  const handleStart = (name: string) => {
    setPlayerName(name);
    setScreen("game");
  };

  if (screen === "game") {
    return <CatGame playerName={playerName} onQuit={() => setScreen("home")} />;
  }

  if (screen === "leaderboard") {
    return <Leaderboard onBack={() => setScreen("home")} />;
  }

  return (
    <HomeScreen
      onStart={handleStart}
      onLeaderboard={() => setScreen("leaderboard")}
    />
  );
}
