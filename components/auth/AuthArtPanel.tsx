export function AuthArtPanel({ title, kicker }: { title: string; kicker: string }) {
  return (
    <aside className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden border-r-2 border-black bg-ink-900">
      {/* big abstract sticker collage */}
      <div className="absolute inset-0 opacity-90">
        <div className="absolute -top-10 -left-10 w-80 h-80 rounded-full bg-magenta border-[3px] border-black shadow-pop-lg animate-float" />
        <div className="absolute top-1/3 -right-16 w-72 h-72 rotate-12 bg-cyan border-[3px] border-black shadow-pop-lg" />
        <div className="absolute bottom-12 left-8 w-56 h-56 rotate-[-8deg] bg-lime border-[3px] border-black shadow-pop-lg rounded-chunk" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 -translate-y-1/2 bg-lemon border-[3px] border-black rounded-full shadow-pop animate-spin-slow flex items-center justify-center">
          <div className="font-display text-5xl text-black">15</div>
        </div>
        <div className="absolute inset-0 bg-dots opacity-40" />
      </div>

      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black bg-bone-50 rounded-full text-xs font-bold uppercase tracking-widest text-black">
          <span className="w-1.5 h-1.5 rounded-full bg-magenta" />
          {kicker}
        </div>
      </div>

      <div className="relative z-10">
        <h2 className="font-display text-5xl xl:text-6xl text-bone-50 leading-[0.95]">
          {title}
        </h2>
        <p className="mt-4 text-sm text-bone-50/70 max-w-sm font-semibold">
          Two players. One screen of chaos. Build a streak, climb the leaderboard, and ruin a friendship — politely.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
          {[
            { k: "GAMES", v: "2", c: "bg-lemon" },
            { k: "MODES", v: "3", c: "bg-cyan" },
            { k: "BETA", v: "OPEN", c: "bg-lime" },
          ].map((s) => (
            <div key={s.k} className="border-[3px] border-black rounded-chunk bg-ink-800 p-3 shadow-pop">
              <div className={`inline-block px-2 py-0.5 border-2 border-black ${s.c} text-black text-[10px] font-bold uppercase tracking-widest rounded-full`}>
                {s.k}
              </div>
              <div className="mt-2 font-display text-2xl text-bone-50">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
