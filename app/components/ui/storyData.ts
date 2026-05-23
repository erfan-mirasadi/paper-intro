export type StoryTextType = "title" | "text" | "transition";

export interface StoryNode {
  id: string;
  scene: "cave" | "palace" | "ocean";
  startTime: number; // Time in seconds after the scene becomes active
  duration: number; // How long the text stays on screen in seconds
  type: StoryTextType;
  text: string;
  hasBackdrop: boolean; // If true, darkens the whole screen behind the text
}

export const storyScript: StoryNode[] = [
  // ── SCENE 1: CAVE (Mount Noor) ──
  {
    id: "cave_1",
    scene: "cave",
    startTime: 0, // Starts as soon as the transition into the scene begins
    duration: 4,
    type: "title",
    text: "Jabal al-Nour",
    hasBackdrop: true,
  },
  {
    id: "cave_2",
    scene: "cave",
    startTime: 7,
    duration: 4,
    type: "text",
    text: "In the profound silence of the mountain, away from the noise of the world...",
    hasBackdrop: false,
  },
  {
    id: "cave_3",
    scene: "cave",
    startTime: 12,
    duration: 4,
    type: "text",
    text: "A soul sought the truth in the depths of the Hira cave.",
    hasBackdrop: false,
  },
  {
    id: "cave_transition",
    scene: "cave",
    startTime: 16.5,
    duration: 5,
    type: "transition",
    text: "The wait was coming to an end.",
    hasBackdrop: true,
  },

  // ── SCENE 2: PALACE (Idols / Age of Ignorance) ──
  {
    id: "palace_1",
    scene: "palace",
    startTime: 0, // Starts during the dark transition (activeScene changed)
    duration: 4, // Stays while fading into Palace
    type: "title",
    text: "The Age of Ignorance",
    hasBackdrop: true,
  },
  {
    id: "palace_2",
    scene: "palace",
    startTime: 7,
    duration: 4,
    type: "text",
    text: "False gods stood tall in the shadows of humanity's lost path.",
    hasBackdrop: false,
  },
  {
    id: "palace_3",
    scene: "palace",
    startTime: 12,
    duration: 4,
    type: "text",
    text: "But shadows cannot withstand the coming dawn.",
    hasBackdrop: false,
  },
  {
    id: "palace_transition",
    scene: "palace",
    startTime: 17,
    duration: 3,
    type: "transition",
    text: "One by one, the illusions fall.",
    hasBackdrop: true,
  },

  // ── SCENE 3: OCEAN (Volcano / Moon / Revelation) ──
  // {
  //   id: "ocean_1",
  //   scene: "ocean",
  //   startTime: 0, // Starts during the dark transition
  //   duration: 3,
  //   type: "title",
  //   text: "The Revelation",
  //   hasBackdrop: true,
  // },
  // {
  //   id: "ocean_2",
  //   scene: "ocean",
  //   startTime: 6.5,
  //   duration: 6,
  //   type: "text",
  //   text: "Through the fires of existence,\na singular light emerged in the heavens.\nRead! In the name of your Lord who created...",
  //   hasBackdrop: false,
  // },
  // {
  //   id: "ocean_4",
  //   scene: "ocean",
  //   startTime: 13.5,
  //   duration: 8,
  //   type: "title",
  //   text: "Iqra",
  //   hasBackdrop: true,
  // },
];
