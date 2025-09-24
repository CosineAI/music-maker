# Music Toy — Drones, Beats & Blips

A no-build, browser-based music playground. Sequence drums, add simple “beep/blip” synth voices, layer sustained drones, and optionally trigger your own one-shot sample — all powered by the Web Audio API. State is encoded in the URL, so you can share what you’re hearing by copying the link.

## Features
- Step sequencer
  - Adjustable BPM (40–220)
  - Adjustable steps per pattern (4–32)
  - Tracks for Kick, Snare, Hat, Beeps/Blips, and a Sample lane
- Beep/Blip instruments
  - Add/remove channels
  - Per-channel voice, waveform, note, and volume
- Drones
  - Three independent sustained tones with note, wave, and volume
- Sample support
  - Upload an audio file to trigger on the sequencer’s Sample track
- Themes
  - Light, Dark, Outrunner, and Vaporwave
- Shareable state
  - The entire setup (tempo, steps, patterns, instruments, drones, theme) is preserved in the URL hash

## Quick start
- Open index.html in any modern browser (no build step required)
- Click Play to start the transport
- Toggle steps on the grid to create rhythms
- Add a Beep/Blip channel to layer melodies
- Optionally upload a sample (WAV/MP3/etc.) and place steps on the Sample row
- Choose a theme from the top-right theme selector
- To share, copy the page URL after you’ve made changes — it includes your pattern and settings

Tip: Browsers require a user gesture before audio starts. If audio is muted initially, press Play once.

## Controls overview
- Transport
  - Play/Stop: Starts and stops the sequencer and any armed drones
  - BPM: Set tempo with number input or slider
  - Steps: Set pattern length (4–32)
- Sequencer
  - Click cells to toggle steps; the current step is highlighted while playing
- Beep instruments
  - Add Beep/Blip Channel to create a new synth lane
  - For each instrument: choose voice, waveform, musical note, and volume; remove when not needed
- Drones
  - Start/Stop a sustained tone
  - Pick note, waveform, and set volume
- Sample
  - Upload an audio file; once loaded, place steps on the Sample row

## URL/state sharing
State is encoded into the URL hash for easy sharing. Parameters include:
- b: BPM
- s: Steps
- p: Per-track step data (hex-packed)
- i: Beep/Blip instrument definitions
- d: Drone settings
- t: Theme

You don’t need to manage these directly — just copy the URL to share your current setup.

## Project structure
- index.html — App markup and script/style includes
- assets/style.css — UI styling and themes
- assets/js/main.js — App wiring, transport, URL sync
- assets/js/lib
  - audio.js — Audio context and triggering
  - notes.js — Musical note utilities
  - theme.js — Theme handling
  - tracks.js — Track definitions and helpers
  - url.js — URL read/write and sequence encoding
- assets/js/ui
  - grid.js — Sequencer grid UI
  - instruments.js — Beep/Blip instrument UI
  - drones.js — Drone controls

## Tech
- Plain HTML/CSS/JS, no frameworks
- Web Audio API for sound generation and scheduling
- URL hash for persist/share of app state

## Development
No tooling required:
- Open index.html directly in the browser
- Or serve the folder with any static file server for friendlier URL behavior

## License
Open source under the MIT License. You can change this to whatever you prefer for your project.
