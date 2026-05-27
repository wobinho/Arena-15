"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRoomByCode } from "@/lib/room-store";
import { useAuth } from "@/lib/auth-store";
import { GameShell } from "@/components/games/GameShell";
import { TimeoutGame } from "@/components/games/TimeoutGame";
import { HighLowGame } from "@/components/games/HighLowGame";
import { NumberTrapGame } from "@/components/games/NumberTrapGame";
import { SafecrackerGame } from "@/components/games/SafecrackerGame";
import { SpotlightGame } from "@/components/games/SpotlightGame";
import { MinefieldGame } from "@/components/games/MinefieldGame";

export default function MatchPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const room = useRoomByCode(code);
  const matchState = useQuery(
    api.match.getMatchState,
    room && (room.status === "in-game" || room.status === "finished") ? { roomId: room._id } : "skip",
  );

  useEffect(() => {
    if (!hydrated) return;
    if (room === null) {
      router.replace("/play");
    }
  }, [hydrated, room, router]);

  // If match finished and lobby reopens, kick back to lobby.
  useEffect(() => {
    if (room && room.status === "lobby") {
      router.replace(`/play/room/${room.code}`);
    }
  }, [room, router]);

  if (!hydrated || !user || room === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-bone-200/60">Loading match…</div>
      </div>
    );
  }
  if (room === null) return null;

  return (
    <GameShell room={room}>
      {room.gameId === "timeout" && (
        <TimeoutGame room={room} matchState={matchState ?? null} userId={user.id} />
      )}
      {room.gameId === "high-low" && (
        <HighLowGame room={room} matchState={matchState ?? null} userId={user.id} />
      )}
      {room.gameId === "number-trap" && (
        <NumberTrapGame room={room} matchState={matchState ?? null} userId={user.id} />
      )}
      {room.gameId === "safecracker" && (
        <SafecrackerGame room={room} matchState={matchState ?? null} userId={user.id} />
      )}
      {room.gameId === "spotlight" && (
        <SpotlightGame room={room} matchState={matchState ?? null} userId={user.id} />
      )}
      {room.gameId === "minefield" && (
        <MinefieldGame room={room} matchState={matchState ?? null} userId={user.id} />
      )}
    </GameShell>
  );
}
