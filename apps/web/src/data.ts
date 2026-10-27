export type Lesson = { id: string; title: string; body: string };
export type Track = { id: string; title: string; benchId: string; lessons: Lesson[] };

export const tracks: Track[] = [
  {
    id: "portraits",
    title: "Talking portraits",
    benchId: "heygem",
    lessons: [
      {
        id: "portraits-1",
        title: "One breath, one line",
        body: "Write lines a person could say out loud without gasping. If a line runs past about twenty words, split it. HeyGem plays one line at a time, so the break is the edit.",
      },
      {
        id: "portraits-2",
        title: "Match the face to the job",
        body: "Mira reads as round and friendly, Sol is sharper, and Nim is wide and calm. Pick the face the way you would pick a type size: for the job, not for decoration.",
      },
      {
        id: "portraits-3",
        title: "Play it before you keep it",
        body: "A line that looks fine on the page can stumble when spoken. Play the read, then cut any word you would not actually say at the door.",
      },
    ],
  },
  {
    id: "graphs",
    title: "Node graphs",
    benchId: "workflow",
    lessons: [
      {
        id: "graphs-1",
        title: "Name the prompt first",
        body: "A graph with an empty prompt has nowhere to go. Write the thing you want to see, then connect that node toward the preview.",
      },
      {
        id: "graphs-2",
        title: "One wire, one job",
        body: "Prompt feeds the model, the model feeds the sampler, the sampler feeds the preview. Extra wires are fine once that chain exists.",
      },
      {
        id: "graphs-3",
        title: "Run a small graph",
        body: "This bench previews the shape of a workflow. It does not load the full ComfyUI runtime. Run it, read the card, then change one node and run again.",
      },
    ],
  },
  {
    id: "voices",
    title: "Voice profiles",
    benchId: "omnivoice",
    lessons: [
      {
        id: "voices-1",
        title: "Sample speech, not a slogan",
        body: "Paste two or three sentences you might actually say. A profile built from a single word has almost nothing to lean on.",
      },
      {
        id: "voices-2",
        title: "The profile is on this device",
        body: "OmniVoice stores a pitch and a pace from the sample and speaks with the device speech engine. It is a workable preview, not a neural clone.",
      },
      {
        id: "voices-3",
        title: "Speak a new line",
        body: "After the profile is saved, type a line that was not in the sample. If the device has no speech engine, the line still stays on screen.",
      },
    ],
  },
  {
    id: "judging",
    title: "Judging takes",
    benchId: "arena",
    lessons: [
      {
        id: "judging-1",
        title: "One brief, two takes",
        body: "Change the brief before you vote if the pair is not about the thing you care about. The vote is only useful when both cards answer the same sentence.",
      },
      {
        id: "judging-2",
        title: "Ties are allowed",
        body: "If both takes miss, call it a tie. A forced winner teaches the board the wrong lesson.",
      },
      {
        id: "judging-3",
        title: "Read the board after a few votes",
        body: "Wins are a count, not a verdict about the world. They only say which preview you kept inside this browser.",
      },
    ],
  },
  {
    id: "habits",
    title: "Studio habits",
    benchId: "artcraft",
    lessons: [
      {
        id: "habits-1",
        title: "Start from a noun",
        body: "A brief with a real object, a place, or a person gives the studio something to hold. Adjectives alone tend to blur.",
      },
      {
        id: "habits-2",
        title: "Run the action once",
        body: "Every studio has one main button. Press it before you tune. An empty result well means the bench is still waiting.",
      },
      {
        id: "habits-3",
        title: "Send the work to the job board",
        body: "When a piece is worth keeping, open Artcraft services and add a job. Status is how you remember what is still in review.",
      },
    ],
  },
];

export const arenaBriefs = [
  { label: "Poster", text: "A poster for a Saturday repair cafe, bold and friendly" },
  { label: "Interface", text: "A home screen for a shared toolbox, large type, few buttons" },
  { label: "Story", text: "The opening of a short story about a night bus and a lost glove" },
  { label: "Mark", text: "A simple mark for a neighborhood bread club" },
];

export const models = ["Northline", "Kiln", "Harbor", "Quill", "Paperplane", "Lumen"] as const;

export const sampleTake =
  "The Saturday bench opens at nine. Bring a lamp, a loose hinge, or a page you want read aloud.";

export const sampleDocument = `ATOZ bench notes

How a work order moves

A work order starts as one paragraph on the home bench. ATOZ points it at a studio, a voice tool, or the arena. The plan is short on purpose: three steps you can finish in one sitting.

Reading a document back

RevPDF keeps the pages in order, lists short headings, and finds a phrase without sending the file anywhere. The copy stays in this browser. Text files read straight through. A simple PDF can too, when its letters are stored as plain text.

What the arena is for

Two takes, one brief. You keep the one that reads clearly at a glance. Ties are allowed when both miss. The board counts what you kept. It does not claim a winner beyond this device.

A note on previews

Portrait playback, voice, and graphs are browser previews. They are here so the path through the workshop is real, even when the full engine is not running beside you.

Closing the loop

When a piece is worth tracking, add it on Artcraft services. Queued, running, review, done. That list is the memory of the bench.`;
