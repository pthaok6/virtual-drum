# Drum samples

These one-shot samples come from the three kits in [Boochi44/free-drum-samples](https://github.com/Boochi44/free-drum-samples). The source repository states that its samples are released under CC0 1.0. This note is kept for provenance.

Each kit maps kick, snare, closed hi-hat, tom, and cymbal to the source samples described in `src/services/audio.ts`. The Bounce kit files are at this directory's root; Hard Trap and Soulful Vintage files are under `kits/`.

The browser loads all three kits through the Web Audio API. Synthesized sounds remain as a fallback if a sample fails to load.
