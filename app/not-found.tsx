import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <div className="relative inline-block">
          <div className="font-display text-[120px] sm:text-[160px] text-lemon leading-none">404</div>
          <div className="absolute -top-4 -right-6 chip bg-magenta text-black border-black rotate-12 text-xs">
            game over
          </div>
        </div>
        <h1 className="font-display text-3xl text-bone-50 mt-2">Wrong arena.</h1>
        <p className="mt-2 text-bone-200/60 font-semibold">
          This page doesn't exist or the room expired. Head back to the lobby and pick a game.
        </p>
        <Link href="/" className="inline-block mt-6">
          <Button size="lg">← Back to games</Button>
        </Link>
      </div>
    </div>
  );
}
