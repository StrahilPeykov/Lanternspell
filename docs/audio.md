# Local sound design

All nine PCM files under public/audio are original offline synthesis by this project, authored 2026-09-10 in scripts/author-audio.py. No third-party recordings, sample libraries, model training, runtime AI or external services. No external attribution obligations.

Rebuild with `python scripts/author-audio.py`. Deterministic seed 712; 22.05 kHz mono 16-bit PCM. Layered filtered noise produces paving contacts and page friction; inharmonic decaying modes provide brass mechanisms and glass; the signature combines page turns, staggered harmonic arrivals, flight and a low landing. Courtyard wind and short bird phrases loop quietly. This is designed synthesis, not recorded Foley or a score.

AudioContext starts on user gesture, buffers decode locally, mute controls the master bus, hidden tabs suspend audio, and skipped effects stop spell sources. Audio callbacks have no authority over game state.
