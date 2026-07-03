/**
 * src/content/clues.ts
 * --------------------
 * Trail clues — the treasure-trail repeatable. Monsters rarely drop a sealed
 * trail-scroll (easy / medium / hard by the creature's level). Reading it gives
 * a riddle that points at one real landmark somewhere in Varath; walk there and
 * interact with the landmark while carrying the scroll and it becomes a casket
 * of that tier. Pure DATA (RULE 3): every target below is an existing world
 * object id, so the trail recycles the map the game already has — fingerposts,
 * waystones, shrines, boards — and teaches the player their world.
 */

export interface ClueSpot {
  /** The world object id the riddle points at. */
  target: string;
  /** The riddle shown when the scroll is read. */
  riddle: string;
}

export type ClueTier = "easy" | "medium" | "hard";

export const clueSpots: Record<ClueTier, ClueSpot[]> = {
  // --- EASY: Ironvale and its doorstep — safe ground, gentle riddles. -------
  easy: [
    { target: "fountain_1", riddle: "Children dare each other to drink me, and nobody knows where my spring rises. Stand where the bright water meets green-stained stone." },
    { target: "grand_exchange_1", riddle: "Chalk promises, wiped and rewritten a hundred times a day. Seek the booth where the whole country haggles." },
    { target: "altar_ironvale", riddle: "Knees have worn my step smoother than any mason could. Kneel where the city refills its Grace." },
    { target: "sign_west", riddle: "I am a finger that never curls, pointing a Lodge road into the trees. Read me at the city's west gate." },
    { target: "sign_north", riddle: "I point at the mountain's high pass and the caves beyond, and I have never once gone there myself. Find me north of the walls." },
    { target: "sign_south", riddle: "Two directions on one post: warm flats one way, a sodden moor the other. Read me on the south road." },
    { target: "sign_east", riddle: "I send travellers down a river road to the sea and stay planted doing it. Read me on the east road." },
    { target: "ws_ironvale", riddle: "Touch the stone that carries half the country's footsteps home — the city's own waystone." },
  ],
  // --- MEDIUM: the regions — a proper walk, and wilder company. -------------
  medium: [
    { target: "ws_greyoak", riddle: "A stone that hums under the oldest canopy in Varath. Touch the wood's waystone, where the Lodge road ends." },
    { target: "ws_heartmoor", riddle: "A stone the mist keeps trying to swallow. Touch the moor's waystone and mind where you step on the way." },
    { target: "ws_ashfen", riddle: "A stone standing on ground that breathes warm. Touch the flats' waystone, where the seams glow after dark." },
    { target: "ws_redrun", riddle: "A stone within earshot of red water running to the grey sea. Touch the river's waystone." },
    { target: "lm_knuckle", riddle: "The hills are named for my bald stone fist, and something older than masons kept tally on me. Stand at the Knuckle." },
    { target: "ow_sign", riddle: "Every tree of the realm grows behind my board, ashwood to deeproot. Read me at the Old Wood's edge." },
    { target: "spine_wind_shrine", riddle: "The wind carved me into the shape of a vertebra, and the faithful and the faithless argue about whose. Stand at the Wind-Shrine, high on the Spine." },
    { target: "heartmoor_barrow", riddle: "Under my lichen a seated figure holds scales, and a road goes north that no longer goes anywhere. Find the drowned court's boundary-mark." },
  ],
  // --- HARD: the deep places — endgame ground, endgame pay. -----------------
  hard: [
    { target: "ws_spine", riddle: "The highest stone that will still carry you home. Touch the Spine's waystone, where the snow starts thinking about staying." },
    { target: "ws_marrow", riddle: "A waystone at the mouth of the cave country, where daylight gives up early. Touch the Marrow's stone." },
    { target: "marrow_vault", riddle: "My walls are too smooth for the dark to have made, and my door was opened from the inside. Stand before the Marrow Vault and think about that." },
    { target: "ar_sign", riddle: "My board names the deepest water in Varath and understates the strangest things in it. Read me at Anglers' Reach." },
    { target: "wyrm_sign", riddle: "I am a polite suggestion to turn around, planted outside a sleeping dragon's gallery. Read me at the Roost — quietly." },
    { target: "spine_vault", riddle: "Shut, and shut from the inside, and the ward-stones never moved. Stand before the mountain's sealed door." },
    { target: "lm_knuckle", riddle: "Begin at the beginning: the fist of stone the first road ever left from. Stand at the Knuckle with the whole country behind you." },
    { target: "ws_greyoak", riddle: "End where the felled trees begin — the wood's own waystone, with an axe-song in the distance." },
  ],
};
