import heroPgRoomImg from "../assets/images/hero_pg_room_1794647167512.jpg";
import demoWallStainImg from "../assets/images/demo_wall_stain_1794647167650.jpg";
import demoBathroomImg from "../assets/images/demo_bathroom_fitting_1794647168153.jpg";
import demoWardrobeImg from "../assets/images/demo_wardrobe_hinge_1794647168307.jpg";
import { AppDataState } from "../types";

export const HERO_PG_IMAGE = heroPgRoomImg;

const DAY_MS = 24 * 60 * 60 * 1000;

export function createInitialDemoState(): AppDataState {
  const now = Date.now();
  const moveInMs = now - 94 * DAY_MS;

  return {
    profile: {
      name: "Riya Sharma",
      phone: "+91 98801 44510",
      city: "Bengaluru",
      createdAtMs: moveInMs,
    },
    pg: {
      id: "demo-sunrise-pg-204",
      ownerUid: "demo-user",
      pgName: "Sunrise PG",
      ownerName: "Mahesh Gowda",
      ownerPhone: "+91 98450 11223",
      address: "18th Main, 4th Block, Koramangala, Bengaluru 560034",
      roomNumber: "Room 204",
      monthlyRent: 11500,
      depositAmount: 20000,
      moveInDate: new Date(moveInMs).toISOString().slice(0, 10),
      moveOutDate: new Date(now).toISOString().slice(0, 10),
      createdAtMs: moveInMs,
    },
    photos: [
      {
        id: "demo-photo-wall",
        ownerUid: "demo-user",
        roomArea: "wall",
        photoUrl: demoWallStainImg,
        aiDamageTags: ["water stain", "peeling plaster", "dark scuff mark"],
        aiSummary:
          "Pre-existing grey damp water stain, peeling plaster patch, and dark scuff marks beside the bedroom switchboard.",
        capturedAtMs: moveInMs + 2 * 60 * 60 * 1000,
        locked: true,
      },
      {
        id: "demo-photo-bathroom",
        ownerUid: "demo-user",
        roomArea: "bathroom",
        photoUrl: demoBathroomImg,
        aiDamageTags: ["hard water scaling", "loose faucet", "tile stain"],
        aiSummary:
          "Hard-water calcium deposits on bathroom wall tiles and a slightly tilted chrome basin tap.",
        capturedAtMs: moveInMs + 2 * 60 * 60 * 1000 + 180000,
        locked: true,
      },
      {
        id: "demo-photo-wardrobe",
        ownerUid: "demo-user",
        roomArea: "wardrobe",
        photoUrl: demoWardrobeImg,
        aiDamageTags: ["loose hinge", "peeling laminate"],
        aiSummary:
          "Top metal door hinge is loose and bottom laminate edge shows pre-existing peeling.",
        capturedAtMs: moveInMs + 2 * 60 * 60 * 1000 + 360000,
        locked: true,
      },
    ],
    complaints: [
      {
        id: "demo-complaint-wifi",
        ownerUid: "demo-user",
        category: "wifi",
        description:
          "2nd floor router disconnects every evening between 7 PM and 11 PM; reported on WhatsApp group twice.",
        reportedAtMs: now - 14 * DAY_MS,
        status: "open",
      },
      {
        id: "demo-complaint-water",
        ownerUid: "demo-user",
        category: "water",
        description:
          "Solar geyser hot water unavailable in Room 204 bathroom; lukewarm trickle only in mornings.",
        reportedAtMs: now - 6 * DAY_MS,
        status: "open",
      },
    ],
    deductions: [
      {
        id: "demo-ded-1",
        ownerUid: "demo-user",
        reason: "Wall repainting for damp stain and scuff marks near switchboard",
        amount: 4500,
        aiVerdict: "unfair",
        aiReason:
          "Your locked move-in wall photo from check-in day already documents the damp water stain, peeling plaster, and dark scuff marks beside the switchboard.",
        matchedPhotoId: "demo-photo-wall",
        createdAtMs: now - 3600000,
      },
      {
        id: "demo-ded-2",
        ownerUid: "demo-user",
        reason: "Standard room & mattress deep cleaning at move-out",
        amount: 1500,
        aiVerdict: "fair",
        aiReason:
          "Standard end-of-stay room sanitization fee is itemized and reasonable if agreed at move-in.",
        matchedPhotoId: "",
        createdAtMs: now - 3000000,
      },
      {
        id: "demo-ded-3",
        ownerUid: "demo-user",
        reason: "General building & common corridor maintenance surcharge",
        amount: 2000,
        aiVerdict: "unclear",
        aiReason:
          "Vague blanket charge with no specific room damage identified; request an itemized breakdown or bill.",
        matchedPhotoId: "",
        createdAtMs: now - 2400000,
      },
    ],
    notices: [],
  };
}
