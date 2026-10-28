// Shared by the renderer (browser global) and the audio script (CommonJS).
(function (root) {
  'use strict';
  const EVENTS = Object.freeze([
    { name: 'opening', frame: 0, visual: 'Eased drive begins; caption fades in.', audio: 'Kalimba lead, pad, traffic bed.' },
    { name: 'label_ready', frame: 60, visual: 'Caption fully visible; landmark between towers.', audio: 'Plucked bass enters.' },
    { name: 'overpass_enter', frame: 120, visual: 'Overpass approaches.', audio: 'Traffic hum darkens.' },
    { name: 'birds_start', frame: 120, visual: 'Flock enters from the left.', audio: 'Bird chirp arpeggio.' },
    { name: 'overpass_whoomp', frame: 180, visual: 'Overpass shadow fills the lower frame.', audio: 'Low whoomp.' },
    { name: 'overpass_clear', frame: 240, visual: 'Overpass passes overhead.', audio: 'Open-air traffic returns.' },
    { name: 'crossing_green', frame: 260, visual: 'Pedestrian signal turns green.', audio: 'Two beeps and a C6-E6-G6 chime.' },
    { name: 'pedestrians_walk', frame: 280, visual: 'Pedestrians cross.', audio: 'Walk beeps.' },
    { name: 'bus_overtake', frame: 340, visual: 'Yellow bus overtakes in the right lane.', audio: 'Whoosh rises from the right.' },
    { name: 'bus_occlusion', frame: 360, visual: 'Bus blocks the landmark.', audio: 'Whoosh peaks; lead rests.' },
    { name: 'landmark_reveal', frame: 400, visual: 'Bus clears; full landmark in view.', audio: 'Two-tone horn; melody lands on C.' },
    { name: 'leaf_release', frame: 420, visual: 'Ginkgo leaf lifts into the bus wake.', audio: 'Wake swish.' },
    { name: 'leaf_spiral_1', frame: 440, visual: 'Leaf spiral 1.', audio: 'Pizzicato E5.' },
    { name: 'leaf_spiral_2', frame: 480, visual: 'Leaf spiral 2.', audio: 'Pizzicato G5.' },
    { name: 'leaf_spiral_3', frame: 520, visual: 'Leaf spiral 3.', audio: 'Pizzicato A5.' },
    { name: 'leaf_land', frame: 560, visual: 'Leaf lands on the curb.', audio: 'Soft C6 pizzicato.' },
    { name: 'cloud_shadow', frame: 580, visual: 'Cloud shadow crosses the landmark.', audio: 'Pad brightens.' },
    { name: 'music_resolve', frame: 660, visual: 'Roll and zoom near final pose.', audio: 'Final C chord and arpeggio.' },
    { name: 'fade_begin', frame: 680, visual: 'Drive continues.', audio: 'Fade out begins.' },
    { name: 'end', frame: 720, visual: 'Exclusive end; last image is frame 719.', audio: 'Silence at 24.000 s.' }
  ].map(Object.freeze));
  const data = Object.freeze({ fps: 30, frames: 720, seed: 20261027, bpm: 90, events: EVENTS });
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  root.FilmEvents = data;
})(typeof window === 'undefined' ? globalThis : window);
