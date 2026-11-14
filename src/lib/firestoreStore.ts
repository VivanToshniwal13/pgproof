import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, handleFirestoreError, OperationType, storage } from "./firebase";
import {
  Complaint,
  ComplaintCategory,
  Deduction,
  DeductionVerdict,
  MoveInPhoto,
  NoticeDraft,
  NoticeStage,
  PgStay,
  RoomArea,
  UserProfile,
} from "../types";

function tsToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === "number") return val;
  return Date.now();
}

export async function ensureUserProfile(
  uid: string,
  defaults: { name: string; phone?: string; city?: string }
): Promise<UserProfile> {
  const userPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const d = snap.data();
      return {
        name: String(d.name || defaults.name || "Tenant"),
        phone: String(d.phone || ""),
        city: String(d.city || "Bengaluru"),
        createdAtMs: tsToMs(d.createdAt),
      };
    }
    const payload = {
      name: (defaults.name || "Tenant").slice(0, 100),
      phone: (defaults.phone || "").slice(0, 20),
      city: (defaults.city || "Bengaluru").slice(0, 80),
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", uid), payload);
    return {
      name: payload.name,
      phone: payload.phone,
      city: payload.city,
      createdAtMs: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserProfile(
  uid: string,
  data: { name: string; phone: string; city: string }
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, "users", uid), {
      name: data.name.trim().slice(0, 100),
      phone: data.phone.trim().slice(0, 20),
      city: data.city.trim().slice(0, 80),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (err: unknown) => void
) {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        name: String(d.name || "Tenant"),
        phone: String(d.phone || ""),
        city: String(d.city || "Bengaluru"),
        createdAtMs: tsToMs(d.createdAt),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeUserPg(
  uid: string,
  onData: (pg: PgStay | null) => void,
  onError: (err: unknown) => void
) {
  const path = "pgs";
  const q = query(collection(db, "pgs"), where("ownerUid", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(null);
        return;
      }
      const docs = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ownerUid: String(d.ownerUid),
            pgName: String(d.pgName),
            ownerName: String(d.ownerName),
            ownerPhone: String(d.ownerPhone),
            address: String(d.address),
            roomNumber: String(d.roomNumber),
            monthlyRent: Number(d.monthlyRent),
            depositAmount: Number(d.depositAmount),
            moveInDate: String(d.moveInDate),
            moveOutDate: d.moveOutDate ? String(d.moveOutDate) : undefined,
            createdAtMs: tsToMs(d.createdAt),
          } as PgStay;
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(docs[0]);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function savePgStay(
  uid: string,
  pgId: string | null,
  input: {
    pgName: string;
    ownerName: string;
    ownerPhone: string;
    address: string;
    roomNumber: string;
    monthlyRent: number;
    depositAmount: number;
    moveInDate: string;
    moveOutDate?: string;
  }
): Promise<string> {
  const cleanPayload: Record<string, unknown> = {
    pgName: input.pgName.trim().slice(0, 120),
    ownerName: input.ownerName.trim().slice(0, 100),
    ownerPhone: input.ownerPhone.trim().slice(0, 20),
    address: input.address.trim().slice(0, 300),
    roomNumber: input.roomNumber.trim().slice(0, 30),
    monthlyRent: Number(input.monthlyRent),
    depositAmount: Number(input.depositAmount),
    moveInDate: input.moveInDate.trim().slice(0, 30),
  };

  if (input.moveOutDate && input.moveOutDate.trim()) {
    cleanPayload.moveOutDate = input.moveOutDate.trim().slice(0, 30);
  }

  if (pgId) {
    const path = `pgs/${pgId}`;
    try {
      await updateDoc(doc(db, "pgs", pgId), cleanPayload);
      return pgId;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    const newId = doc(collection(db, "pgs")).id;
    const path = `pgs/${newId}`;
    try {
      await setDoc(doc(db, "pgs", newId), {
        ...cleanPayload,
        ownerUid: uid,
        createdAt: serverTimestamp(),
      });
      return newId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function uploadUserImageToStorage(params: {
  uid: string;
  pgId: string;
  folder: "moveIn" | "complaints";
  fileId: string;
  blob: Blob;
  mimeType: string;
}): Promise<string> {
  const storagePath = `users/${params.uid}/pgs/${params.pgId}/${params.folder}/${params.fileId}.jpg`;
  const storageRef = ref(storage, storagePath);

  const uploadPromise = uploadBytes(storageRef, params.blob, {
    contentType: params.mimeType,
  }).then(() => getDownloadURL(storageRef));

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Photo upload timed out. Please check your connection and retry.")), 25000)
  );

  return Promise.race([uploadPromise, timeoutPromise]);
}

export function subscribeMoveInPhotos(
  uid: string,
  pgId: string,
  onData: (photos: MoveInPhoto[]) => void,
  onError: (err: unknown) => void
) {
  const path = `pgs/${pgId}/moveInPhotos`;
  const q = query(
    collection(db, "pgs", pgId, "moveInPhotos"),
    where("ownerUid", "==", uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: MoveInPhoto[] = snap.docs
        .map((dSnap) => {
          const d = dSnap.data();
          return {
            id: dSnap.id,
            ownerUid: String(d.ownerUid),
            roomArea: d.roomArea as RoomArea,
            photoUrl: String(d.photoUrl),
            aiDamageTags: Array.isArray(d.aiDamageTags) ? d.aiDamageTags.map(String) : [],
            aiSummary: String(d.aiSummary || ""),
            capturedAtMs: tsToMs(d.capturedAt),
            locked: Boolean(d.locked),
          };
        })
        .sort((a, b) => b.capturedAtMs - a.capturedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function createMoveInPhotoDoc(params: {
  uid: string;
  pgId: string;
  photoId: string;
  roomArea: RoomArea;
  photoUrl: string;
  aiDamageTags: string[];
  aiSummary: string;
}): Promise<void> {
  const path = `pgs/${params.pgId}/moveInPhotos/${params.photoId}`;
  try {
    await setDoc(doc(db, "pgs", params.pgId, "moveInPhotos", params.photoId), {
      ownerUid: params.uid,
      roomArea: params.roomArea,
      photoUrl: params.photoUrl.slice(0, 2000),
      aiDamageTags: params.aiDamageTags.slice(0, 20).map((t) => t.slice(0, 80)),
      aiSummary: params.aiSummary.slice(0, 500),
      capturedAt: serverTimestamp(),
      locked: false,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteUnlockedMoveInPhoto(pgId: string, photoId: string): Promise<void> {
  const path = `pgs/${pgId}/moveInPhotos/${photoId}`;
  try {
    await deleteDoc(doc(db, "pgs", pgId, "moveInPhotos", photoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function lockAllMoveInPhotos(pgId: string, unlockedPhotoIds: string[]): Promise<void> {
  const path = `pgs/${pgId}/moveInPhotos`;
  if (unlockedPhotoIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of unlockedPhotoIds) {
      batch.update(doc(db, "pgs", pgId, "moveInPhotos", id), {
        locked: true,
        capturedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeComplaints(
  uid: string,
  pgId: string,
  onData: (complaints: Complaint[]) => void,
  onError: (err: unknown) => void
) {
  const path = `pgs/${pgId}/complaints`;
  const q = query(
    collection(db, "pgs", pgId, "complaints"),
    where("ownerUid", "==", uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: Complaint[] = snap.docs
        .map((dSnap) => {
          const d = dSnap.data();
          return {
            id: dSnap.id,
            ownerUid: String(d.ownerUid),
            category: d.category as ComplaintCategory,
            description: String(d.description),
            photoUrl: d.photoUrl ? String(d.photoUrl) : undefined,
            reportedAtMs: tsToMs(d.reportedAt),
            status: d.status as "open" | "fixed",
            fixedAtMs: d.fixedAt ? tsToMs(d.fixedAt) : undefined,
          };
        })
        .sort((a, b) => b.reportedAtMs - a.reportedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function createComplaintDoc(params: {
  uid: string;
  pgId: string;
  complaintId: string;
  category: ComplaintCategory;
  description: string;
  photoUrl?: string;
}): Promise<void> {
  const path = `pgs/${params.pgId}/complaints/${params.complaintId}`;
  const payload: Record<string, unknown> = {
    ownerUid: params.uid,
    category: params.category,
    description: params.description.trim().slice(0, 1000),
    reportedAt: serverTimestamp(),
    status: "open",
  };
  if (params.photoUrl) {
    payload.photoUrl = params.photoUrl.slice(0, 2000);
  }
  try {
    await setDoc(doc(db, "pgs", params.pgId, "complaints", params.complaintId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markComplaintFixedDoc(pgId: string, complaintId: string): Promise<void> {
  const path = `pgs/${pgId}/complaints/${complaintId}`;
  try {
    await updateDoc(doc(db, "pgs", pgId, "complaints", complaintId), {
      status: "fixed",
      fixedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteComplaintDoc(pgId: string, complaintId: string): Promise<void> {
  const path = `pgs/${pgId}/complaints/${complaintId}`;
  try {
    await deleteDoc(doc(db, "pgs", pgId, "complaints", complaintId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeDeductions(
  uid: string,
  pgId: string,
  onData: (deductions: Deduction[]) => void,
  onError: (err: unknown) => void
) {
  const path = `pgs/${pgId}/deductions`;
  const q = query(
    collection(db, "pgs", pgId, "deductions"),
    where("ownerUid", "==", uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: Deduction[] = snap.docs
        .map((dSnap) => {
          const d = dSnap.data();
          return {
            id: dSnap.id,
            ownerUid: String(d.ownerUid),
            reason: String(d.reason),
            amount: Number(d.amount),
            aiVerdict: d.aiVerdict as DeductionVerdict,
            aiReason: String(d.aiReason),
            matchedPhotoId: d.matchedPhotoId ? String(d.matchedPhotoId) : undefined,
            createdAtMs: tsToMs(d.createdAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function createDeductionDoc(params: {
  uid: string;
  pgId: string;
  reason: string;
  amount: number;
  aiVerdict: DeductionVerdict;
  aiReason: string;
  matchedPhotoId?: string;
}): Promise<string> {
  const id = doc(collection(db, "pgs", params.pgId, "deductions")).id;
  const path = `pgs/${params.pgId}/deductions/${id}`;
  const payload: Record<string, unknown> = {
    ownerUid: params.uid,
    reason: params.reason.trim().slice(0, 400),
    amount: Number(params.amount),
    aiVerdict: params.aiVerdict,
    aiReason: params.aiReason.trim().slice(0, 800),
    createdAt: serverTimestamp(),
  };
  if (params.matchedPhotoId) {
    payload.matchedPhotoId = params.matchedPhotoId.slice(0, 128);
  }
  try {
    await setDoc(doc(db, "pgs", params.pgId, "deductions", id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDeductionEvaluationDoc(params: {
  pgId: string;
  deductionId: string;
  aiVerdict: DeductionVerdict;
  aiReason: string;
  matchedPhotoId?: string;
}): Promise<void> {
  const path = `pgs/${params.pgId}/deductions/${params.deductionId}`;
  try {
    await updateDoc(doc(db, "pgs", params.pgId, "deductions", params.deductionId), {
      aiVerdict: params.aiVerdict,
      aiReason: params.aiReason.trim().slice(0, 800),
      matchedPhotoId: (params.matchedPhotoId || "").slice(0, 128),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDeductionDoc(pgId: string, deductionId: string): Promise<void> {
  const path = `pgs/${pgId}/deductions/${deductionId}`;
  try {
    await deleteDoc(doc(db, "pgs", pgId, "deductions", deductionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeNotices(
  uid: string,
  pgId: string,
  onData: (notices: NoticeDraft[]) => void,
  onError: (err: unknown) => void
) {
  const path = `pgs/${pgId}/notices`;
  const q = query(
    collection(db, "pgs", pgId, "notices"),
    where("ownerUid", "==", uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: NoticeDraft[] = snap.docs
        .map((dSnap) => {
          const d = dSnap.data();
          return {
            id: dSnap.id,
            ownerUid: String(d.ownerUid),
            stage: d.stage as NoticeStage,
            content: String(d.content),
            createdAtMs: tsToMs(d.createdAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function saveNoticeDrafts(params: {
  uid: string;
  pgId: string;
  drafts: Record<NoticeStage, string>;
}): Promise<void> {
  const path = `pgs/${params.pgId}/notices`;
  const stages: NoticeStage[] = ["reminder", "formal_notice", "consumer_complaint_draft"];
  try {
    const batch = writeBatch(db);
    for (const stage of stages) {
      const docRef = doc(db, "pgs", params.pgId, "notices", stage);
      const snap = await getDoc(docRef);
      const content = params.drafts[stage].trim().slice(0, 10000);
      if (snap.exists()) {
        batch.update(docRef, { content });
      } else {
        batch.set(docRef, {
          ownerUid: params.uid,
          stage,
          content,
          createdAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateNoticeContent(
  pgId: string,
  noticeId: string,
  content: string
): Promise<void> {
  const path = `pgs/${pgId}/notices/${noticeId}`;
  try {
    await updateDoc(doc(db, "pgs", pgId, "notices", noticeId), {
      content: content.trim().slice(0, 10000),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
