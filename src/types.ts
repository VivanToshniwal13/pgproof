export type RoomArea = "bed" | "wall" | "bathroom" | "wardrobe" | "floor";

export type ComplaintCategory =
  | "food"
  | "hygiene"
  | "wifi"
  | "water"
  | "power"
  | "safety"
  | "other";

export type ComplaintStatus = "open" | "fixed";

export type DeductionVerdict = "fair" | "unfair" | "unclear";

export type NoticeStage = "reminder" | "formal_notice" | "consumer_complaint_draft";

export type AppScreen =
  | "dashboard"
  | "pg-setup"
  | "scan"
  | "complaints"
  | "claim"
  | "notices";

export interface UserProfile {
  name: string;
  phone: string;
  city: string;
  createdAtMs: number;
}

export interface PgStay {
  id: string;
  ownerUid: string;
  pgName: string;
  ownerName: string;
  ownerPhone: string;
  address: string;
  roomNumber: string;
  monthlyRent: number;
  depositAmount: number;
  moveInDate: string;
  moveOutDate?: string;
  createdAtMs: number;
}

export interface MoveInPhoto {
  id: string;
  ownerUid: string;
  roomArea: RoomArea;
  photoUrl: string;
  aiDamageTags: string[];
  aiSummary: string;
  capturedAtMs: number;
  locked: boolean;
}

export interface Complaint {
  id: string;
  ownerUid: string;
  category: ComplaintCategory;
  description: string;
  photoUrl?: string;
  reportedAtMs: number;
  status: ComplaintStatus;
  fixedAtMs?: number;
}

export interface Deduction {
  id: string;
  ownerUid: string;
  reason: string;
  amount: number;
  aiVerdict: DeductionVerdict;
  aiReason: string;
  matchedPhotoId?: string;
  createdAtMs: number;
}

export interface NoticeDraft {
  id: string;
  ownerUid: string;
  stage: NoticeStage;
  content: string;
  createdAtMs: number;
}

export interface AppDataState {
  profile: UserProfile | null;
  pg: PgStay | null;
  photos: MoveInPhoto[];
  complaints: Complaint[];
  deductions: Deduction[];
  notices: NoticeDraft[];
}
