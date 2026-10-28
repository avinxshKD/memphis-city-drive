# Events

90 BPM, 30 fps, 20 frames per beat, seed `20261027`.
Frame 720 is an exclusive endpoint, not an exported image. Sound cues are synthesized by scripts/audio.cjs at frame x 1600 samples (see audio_sync.md).

| Event | Frame | Seconds | Beat | Visual | Sound |
|---|---:|---:|---:|---|---|
| opening | 0 | 0.00 | 0.0 | Eased drive begins; caption fades in. | Kalimba lead, pad, traffic bed. |
| label_ready | 60 | 2.00 | 3.0 | Caption fully visible; landmark between towers. | Plucked bass enters. |
| overpass_enter | 120 | 4.00 | 6.0 | Overpass approaches. | Traffic hum darkens. |
| birds_start | 120 | 4.00 | 6.0 | Flock enters from the left. | Bird chirp arpeggio. |
| overpass_whoomp | 180 | 6.00 | 9.0 | Overpass shadow fills the lower frame. | Low whoomp. |
| overpass_clear | 240 | 8.00 | 12.0 | Overpass passes overhead. | Open-air traffic returns. |
| crossing_green | 260 | 8.67 | 13.0 | Pedestrian signal turns green. | Two beeps and a C6-E6-G6 chime. |
| pedestrians_walk | 280 | 9.33 | 14.0 | Pedestrians cross. | Walk beeps. |
| bus_overtake | 340 | 11.33 | 17.0 | Yellow bus overtakes in the right lane. | Whoosh rises from the right. |
| bus_occlusion | 360 | 12.00 | 18.0 | Bus blocks the landmark. | Whoosh peaks; lead rests. |
| landmark_reveal | 400 | 13.33 | 20.0 | Bus clears; full landmark in view. | Two-tone horn; melody lands on C. |
| leaf_release | 420 | 14.00 | 21.0 | Ginkgo leaf lifts into the bus wake. | Wake swish. |
| leaf_spiral_1 | 440 | 14.67 | 22.0 | Leaf spiral 1. | Pizzicato E5. |
| leaf_spiral_2 | 480 | 16.00 | 24.0 | Leaf spiral 2. | Pizzicato G5. |
| leaf_spiral_3 | 520 | 17.33 | 26.0 | Leaf spiral 3. | Pizzicato A5. |
| leaf_land | 560 | 18.67 | 28.0 | Leaf lands on the curb. | Soft C6 pizzicato. |
| cloud_shadow | 580 | 19.33 | 29.0 | Cloud shadow crosses the landmark. | Pad brightens. |
| music_resolve | 660 | 22.00 | 33.0 | Roll and zoom near final pose. | Final C chord and arpeggio. |
| fade_begin | 680 | 22.67 | 34.0 | Drive continues. | Fade out begins. |
| end | 720 | 24.00 | 36.0 | Exclusive end; last image is frame 719. | Silence at 24.000 s. |
