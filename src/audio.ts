/** Local authored PCM samples; audio is presentation, unlocked by a gesture. */
export class Sound {
  context?: AudioContext;
  lastStep = 0;
  private isMuted = false;
  private stepIndex = 0;
  private buffers = new Map<string, AudioBuffer>();
  private master?: GainNode;
  private spells = new Set<AudioBufferSourceNode>();
  private loading?: Promise<void>;
  get muted() {
    return this.isMuted;
  }
  set muted(value: boolean) {
    this.isMuted = value;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        value ? 0 : 0.65,
        this.context.currentTime,
        0.08,
      );
  }
  start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.isMuted ? 0 : 0.65;
      this.master.connect(this.context.destination);
      this.loading = Promise.all(
        [
          "courtyard",
          "step-a",
          "step-b",
          "book",
          "cast",
          "impact",
          "ward",
          "atlas",
          "signature",
        ].map(async (name) => {
          try {
            const r = await fetch(`/audio/${name}.wav`);
            if (!r.ok) return;
            this.buffers.set(
              name,
              await this.context!.decodeAudioData(await r.arrayBuffer()),
            );
          } catch {
            /* Sound never blocks play. */
          }
        }),
      ).then(() => {
        this.play("courtyard", 0.45, true);
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) void this.context?.suspend();
        else void this.context?.resume();
      });
    }
    void this.context.resume();
    return this.loading;
  }
  private play(name: string, volume = 1, loop = false, spell = false) {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.context || !this.master) return;
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = loop;
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    if (spell) this.spells.add(source);
    source.onended = () => {
      this.spells.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return source;
  }
  cast(spell: string) {
    this.stopSpell();
    this.play(
      spell === "unfold"
        ? "signature"
        : ["mend", "shelter"].includes(spell)
          ? "ward"
          : ["heavy", "strike", "rebind"].includes(spell)
            ? "atlas"
            : spell === "mark"
              ? "book"
              : "cast",
      0.7,
      false,
      true,
    );
    if (spell === "unseal") this.play("impact", 0.35, false, true);
  }
  book() {
    this.play("book", 0.5);
  }
  stopSpell() {
    for (const source of this.spells) {
      try {
        source.stop();
      } catch {}
    }
    this.spells.clear();
  }
  step() {
    const now = performance.now();
    if (now - this.lastStep > 360) {
      this.lastStep = now;
      this.play(this.stepIndex++ % 2 ? "step-a" : "step-b", 0.24);
    }
  }
}
