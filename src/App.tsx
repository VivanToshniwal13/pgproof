import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { AlertCircle, Loader2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import { auth, getFriendlyErrorMessage } from "./lib/firebase";
import {
  createComplaintDoc,
  createDeductionDoc,
  createMoveInPhotoDoc,
  deleteDeductionDoc,
  deleteUnlockedMoveInPhoto,
  ensureUserProfile,
  lockAllMoveInPhotos,
  markComplaintFixedDoc,
  saveNoticeDrafts,
  savePgStay,
  subscribeComplaints,
  subscribeDeductions,
  subscribeMoveInPhotos,
  subscribeNotices,
  subscribeUserPg,
  subscribeUserProfile,
  updateDeductionEvaluationDoc,
  updateNoticeContent,
  uploadUserImageToStorage,
} from "./lib/firestoreStore";
import { createInitialDemoState } from "./data/demoData";
import {
  AppDataState,
  AppScreen,
  ComplaintCategory,
  NoticeStage,
  RoomArea,
} from "./types";
import { EvaluatedDeductionResult } from "./lib/ai";
import { LandingAuthScreen } from "./components/LandingAuthScreen";
import { AppShell } from "./components/AppShell";
import { PgSetupScreen } from "./components/PgSetupScreen";
import { MoveInScanScreen } from "./components/MoveInScanScreen";
import { ComplaintsScreen } from "./components/ComplaintsScreen";
import { DepositClaimScreen } from "./components/DepositClaimScreen";
import { NoticesScreen } from "./components/NoticesScreen";
import { DashboardScreen } from "./components/DashboardScreen";

const EMPTY_STATE: AppDataState = {
  profile: null,
  pg: null,
  photos: [],
  complaints: [],
  deductions: [],
  notices: [],
};

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [isDemo, setIsDemo] = useState(false);
  const [demoState, setDemoState] = useState<AppDataState>(EMPTY_STATE);

  const [liveState, setLiveState] = useState<AppDataState>(EMPTY_STATE);
  const [pgLoading, setPgLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const [activeScreen, setActiveScreen] = useState<AppScreen>("dashboard");
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  // Network online/offline listeners
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setLiveState(EMPTY_STATE);
        setPgLoading(false);
        setFirestoreError(null);
      } else {
        setIsDemo(false);
        setPgLoading(true);
        void ensureUserProfile(user.uid, {
          name: user.displayName || user.email?.split("@")[0] || "Tenant",
          phone: user.phoneNumber || "",
          city: "Bengaluru",
        }).catch((err) => {
          console.error("Profile init warning:", err);
        });
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to User Profile & Active PG when authenticated
  useEffect(() => {
    if (!authReady || !authUser || isDemo) return;

    let initialPgResolved = false;

    const unsubProfile = subscribeUserProfile(
      authUser.uid,
      (profile) => setLiveState((prev) => ({ ...prev, profile })),
      (err) => setFirestoreError(getFriendlyErrorMessage(err))
    );

    const unsubPg = subscribeUserPg(
      authUser.uid,
      (pg) => {
        setLiveState((prev) => ({ ...prev, pg }));
        if (!initialPgResolved) {
          initialPgResolved = true;
          setPgLoading(false);
          if (!pg) {
            setActiveScreen("pg-setup");
          }
        }
      },
      (err) => {
        setFirestoreError(getFriendlyErrorMessage(err));
        setPgLoading(false);
      }
    );

    return () => {
      unsubProfile();
      unsubPg();
    };
  }, [authReady, authUser, isDemo]);

  // Subscribe to PG subcollections once PG exists
  const livePgId = liveState.pg?.id || null;
  useEffect(() => {
    if (!authReady || !authUser || !livePgId || isDemo) return;

    const handleSubError = (err: unknown) => {
      const msg = getFriendlyErrorMessage(err);
      setFirestoreError(msg);
      toast.error(msg);
    };

    const unsubPhotos = subscribeMoveInPhotos(
      authUser.uid,
      livePgId,
      (photos) => setLiveState((prev) => ({ ...prev, photos })),
      handleSubError
    );

    const unsubComplaints = subscribeComplaints(
      authUser.uid,
      livePgId,
      (complaints) => setLiveState((prev) => ({ ...prev, complaints })),
      handleSubError
    );

    const unsubDeductions = subscribeDeductions(
      authUser.uid,
      livePgId,
      (deductions) => setLiveState((prev) => ({ ...prev, deductions })),
      handleSubError
    );

    const unsubNotices = subscribeNotices(
      authUser.uid,
      livePgId,
      (notices) => setLiveState((prev) => ({ ...prev, notices })),
      handleSubError
    );

    return () => {
      unsubPhotos();
      unsubComplaints();
      unsubDeductions();
      unsubNotices();
    };
  }, [authReady, authUser, livePgId, isDemo]);

  const activeState = isDemo ? demoState : liveState;
  const tenantName =
    activeState.profile?.name ||
    authUser?.displayName ||
    authUser?.email?.split("@")[0] ||
    "Tenant";

  function handleStartDemo() {
    setDemoState(createInitialDemoState());
    setIsDemo(true);
    setActiveScreen("dashboard");
    toast.success("Loaded Riya's Sunrise PG demo record.");
  }

  async function handleSignOutOrExitDemo() {
    if (isDemo) {
      setIsDemo(false);
      setDemoState(EMPTY_STATE);
      return;
    }
    await signOut(auth);
  }

  // Action Handlers (routed to Demo state or Firestore)
  async function handleSavePg(input: {
    pgName: string;
    ownerName: string;
    ownerPhone: string;
    address: string;
    roomNumber: string;
    monthlyRent: number;
    depositAmount: number;
    moveInDate: string;
    moveOutDate?: string;
  }) {
    const isNewPg = !activeState.pg;
    if (isDemo) {
      setDemoState((prev) => ({
        ...prev,
        pg: {
          id: prev.pg?.id || "demo-pg",
          ownerUid: "demo-user",
          ...input,
          createdAtMs: prev.pg?.createdAtMs || Date.now(),
        },
      }));
      toast.success(isNewPg ? "PG added." : "PG details updated.");
      return;
    }

    if (!authUser) throw new Error("You must be signed in.");
    try {
      await savePgStay(authUser.uid, liveState.pg?.id || null, input);
      toast.success(isNewPg ? "PG added! Let's scan your room." : "PG details updated.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleUploadAndSavePhoto(params: {
    photoId: string;
    roomArea: RoomArea;
    blob: Blob;
    mimeType: string;
    previewUrl: string;
    aiDamageTags: string[];
    aiSummary: string;
  }) {
    if (isDemo) {
      setDemoState((prev) => ({
        ...prev,
        photos: [
          {
            id: params.photoId,
            ownerUid: "demo-user",
            roomArea: params.roomArea,
            photoUrl: params.previewUrl,
            aiDamageTags: params.aiDamageTags,
            aiSummary: params.aiSummary,
            capturedAtMs: Date.now(),
            locked: false,
          },
          ...prev.photos,
        ],
      }));
      toast.success("Photo scanned with Gemini.");
      return;
    }

    if (!authUser || !liveState.pg) throw new Error("PG record not found.");
    try {
      const downloadUrl = await uploadUserImageToStorage({
        uid: authUser.uid,
        pgId: liveState.pg.id,
        folder: "moveIn",
        fileId: params.photoId,
        blob: params.blob,
        mimeType: params.mimeType,
      });

      await createMoveInPhotoDoc({
        uid: authUser.uid,
        pgId: liveState.pg.id,
        photoId: params.photoId,
        roomArea: params.roomArea,
        photoUrl: downloadUrl,
        aiDamageTags: params.aiDamageTags,
        aiSummary: params.aiSummary,
      });
      toast.success("Photo uploaded and analyzed by Gemini.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (isDemo) {
      const target = demoState.photos.find((p) => p.id === photoId);
      if (target?.locked) {
        throw new Error("Locked move-in photos cannot be deleted.");
      }
      setDemoState((prev) => ({
        ...prev,
        photos: prev.photos.filter((p) => p.id !== photoId),
      }));
      toast.success("Photo removed.");
      return;
    }

    if (!liveState.pg) return;
    try {
      await deleteUnlockedMoveInPhoto(liveState.pg.id, photoId);
      toast.success("Photo removed.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleLockAllPhotos(unlockedIds: string[]) {
    if (isDemo) {
      const now = Date.now();
      setDemoState((prev) => ({
        ...prev,
        photos: prev.photos.map((p) =>
          unlockedIds.includes(p.id) ? { ...p, locked: true, capturedAtMs: now } : p
        ),
      }));
      toast.success("Move-in record locked with timestamp.");
      return;
    }

    if (!liveState.pg) return;
    try {
      await lockAllMoveInPhotos(liveState.pg.id, unlockedIds);
      toast.success("Move-in record locked permanently.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleAddComplaint(params: {
    complaintId: string;
    category: ComplaintCategory;
    description: string;
    photo?: { blob: Blob; mimeType: string; previewUrl: string };
  }) {
    if (isDemo) {
      setDemoState((prev) => ({
        ...prev,
        complaints: [
          {
            id: params.complaintId,
            ownerUid: "demo-user",
            category: params.category,
            description: params.description,
            photoUrl: params.photo?.previewUrl,
            reportedAtMs: Date.now(),
            status: "open",
          },
          ...prev.complaints,
        ],
      }));
      toast.success("Complaint logged.");
      return;
    }

    if (!authUser || !liveState.pg) throw new Error("PG record not found.");
    try {
      let photoUrl: string | undefined;
      if (params.photo) {
        photoUrl = await uploadUserImageToStorage({
          uid: authUser.uid,
          pgId: liveState.pg.id,
          folder: "complaints",
          fileId: params.complaintId,
          blob: params.photo.blob,
          mimeType: params.photo.mimeType,
        });
      }

      await createComplaintDoc({
        uid: authUser.uid,
        pgId: liveState.pg.id,
        complaintId: params.complaintId,
        category: params.category,
        description: params.description,
        photoUrl,
      });
      toast.success("Complaint logged with timestamp.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleMarkComplaintFixed(complaintId: string) {
    if (isDemo) {
      const now = Date.now();
      setDemoState((prev) => ({
        ...prev,
        complaints: prev.complaints.map((c) =>
          c.id === complaintId ? { ...c, status: "fixed", fixedAtMs: now } : c
        ),
      }));
      toast.success("Complaint marked fixed.");
      return;
    }

    if (!liveState.pg) return;
    try {
      await markComplaintFixedDoc(liveState.pg.id, complaintId);
      toast.success("Complaint marked fixed.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleAddEvaluatedDeduction(res: EvaluatedDeductionResult) {
    if (isDemo) {
      setDemoState((prev) => ({
        ...prev,
        deductions: [
          {
            id: `demo_ded_${Date.now()}`,
            ownerUid: "demo-user",
            reason: res.reason,
            amount: res.amount,
            aiVerdict: res.aiVerdict,
            aiReason: res.aiReason,
            matchedPhotoId: res.matchedPhotoId || undefined,
            createdAtMs: Date.now(),
          },
          ...prev.deductions,
        ],
      }));
      toast.success("Deduction audited by Gemini.");
      return;
    }

    if (!authUser || !liveState.pg) throw new Error("PG record not found.");
    try {
      await createDeductionDoc({
        uid: authUser.uid,
        pgId: liveState.pg.id,
        reason: res.reason,
        amount: res.amount,
        aiVerdict: res.aiVerdict,
        aiReason: res.aiReason,
        matchedPhotoId: res.matchedPhotoId || undefined,
      });
      toast.success("Deduction audited by Gemini.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleUpdateEvaluatedDeduction(
    deductionId: string,
    res: EvaluatedDeductionResult
  ) {
    if (isDemo) {
      setDemoState((prev) => ({
        ...prev,
        deductions: prev.deductions.map((d) =>
          d.id === deductionId
            ? {
                ...d,
                aiVerdict: res.aiVerdict,
                aiReason: res.aiReason,
                matchedPhotoId: res.matchedPhotoId || undefined,
              }
            : d
        ),
      }));
      return;
    }

    if (!liveState.pg) return;
    try {
      await updateDeductionEvaluationDoc({
        pgId: liveState.pg.id,
        deductionId,
        aiVerdict: res.aiVerdict,
        aiReason: res.aiReason,
        matchedPhotoId: res.matchedPhotoId || undefined,
      });
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleDeleteDeduction(deductionId: string) {
    if (isDemo) {
      setDemoState((prev) => ({
        ...prev,
        deductions: prev.deductions.filter((d) => d.id !== deductionId),
      }));
      toast.success("Deduction removed.");
      return;
    }

    if (!liveState.pg) return;
    try {
      await deleteDeductionDoc(liveState.pg.id, deductionId);
      toast.success("Deduction removed.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleSaveGeneratedNotices(drafts: Record<NoticeStage, string>) {
    if (isDemo) {
      const now = Date.now();
      setDemoState((prev) => ({
        ...prev,
        notices: (["reminder", "formal_notice", "consumer_complaint_draft"] as NoticeStage[]).map(
          (stage) => ({
            id: stage,
            ownerUid: "demo-user",
            stage,
            content: drafts[stage],
            createdAtMs: now,
          })
        ),
      }));
      toast.success("All 3 notice drafts generated.");
      return;
    }

    if (!authUser || !liveState.pg) throw new Error("PG record not found.");
    try {
      await saveNoticeDrafts({
        uid: authUser.uid,
        pgId: liveState.pg.id,
        drafts,
      });
      toast.success("All 3 notice drafts saved.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  async function handleSaveEditedNotice(stage: NoticeStage, content: string) {
    if (isDemo) {
      setDemoState((prev) => ({
        ...prev,
        notices: prev.notices.map((n) => (n.stage === stage ? { ...n, content } : n)),
      }));
      toast.success("Draft edits saved.");
      return;
    }

    if (!liveState.pg) return;
    try {
      await updateNoticeContent(liveState.pg.id, stage, content);
      toast.success("Draft edits saved.");
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      toast.error(msg);
      throw new Error(msg);
    }
  }

  if (!authReady && !isDemo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-900" />
          <p className="text-sm text-slate-600">Loading PGProof...</p>
        </div>
      </div>
    );
  }

  if (!authUser && !isDemo) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <LandingAuthScreen
          onStartDemo={handleStartDemo}
          onAuthComplete={() => setActiveScreen("dashboard")}
        />
      </>
    );
  }

  const currentPg = activeState.pg;

  return (
    <>
      <Toaster position="top-right" richColors />
      <AppShell
        activeScreen={currentPg ? activeScreen : "pg-setup"}
        onNavigate={setActiveScreen}
        pg={currentPg}
        tenantName={tenantName}
        isDemo={isDemo}
        isOffline={isOffline}
        onSignOutOrExitDemo={() => void handleSignOutOrExitDemo()}
      >
        {firestoreError && !isDemo && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <span>{firestoreError}</span>
          </div>
        )}

        {pgLoading && !isDemo ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-900" />
              <p className="text-sm text-slate-600">Syncing your PG records...</p>
            </div>
          </div>
        ) : !currentPg || activeScreen === "pg-setup" ? (
          <PgSetupScreen
            existingPg={currentPg}
            onSavePg={handleSavePg}
            onDone={() => setActiveScreen(currentPg ? "dashboard" : "scan")}
          />
        ) : activeScreen === "scan" ? (
          <MoveInScanScreen
            pg={currentPg}
            photos={activeState.photos}
            isDemo={isDemo}
            onUploadAndSavePhoto={handleUploadAndSavePhoto}
            onDeletePhoto={handleDeletePhoto}
            onLockAllPhotos={handleLockAllPhotos}
          />
        ) : activeScreen === "complaints" ? (
          <ComplaintsScreen
            pg={currentPg}
            complaints={activeState.complaints}
            onAddComplaint={handleAddComplaint}
            onMarkFixed={handleMarkComplaintFixed}
          />
        ) : activeScreen === "claim" ? (
          <DepositClaimScreen
            pg={currentPg}
            photos={activeState.photos}
            deductions={activeState.deductions}
            onAddEvaluatedDeduction={handleAddEvaluatedDeduction}
            onUpdateEvaluatedDeduction={handleUpdateEvaluatedDeduction}
            onDeleteDeduction={handleDeleteDeduction}
            onNavigate={setActiveScreen}
          />
        ) : activeScreen === "notices" ? (
          <NoticesScreen
            tenantName={tenantName}
            pg={currentPg}
            photos={activeState.photos}
            complaints={activeState.complaints}
            deductions={activeState.deductions}
            notices={activeState.notices}
            onSaveGeneratedNotices={handleSaveGeneratedNotices}
            onSaveEditedNotice={handleSaveEditedNotice}
          />
        ) : (
          <DashboardScreen
            tenantName={tenantName}
            pg={currentPg}
            photos={activeState.photos}
            complaints={activeState.complaints}
            deductions={activeState.deductions}
            onNavigate={setActiveScreen}
          />
        )}
      </AppShell>
    </>
  );
}
