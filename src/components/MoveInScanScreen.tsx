import React, { useRef, useState } from "react";
import {
  Camera,
  Lock,
  Trash2,
  AlertCircle,
  Loader2,
  RotateCw,
  ShieldCheck,
  ImageOff,
} from "lucide-react";
import { MoveInPhoto, PgStay, RoomArea } from "../types";
import { formatDateTime, validateAndPrepareImage } from "../lib/utils";
import { analyzeMoveInPhotoAI } from "../lib/ai";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const ROOM_AREAS: Array<{ value: RoomArea; label: string }> = [
  { value: "bed", label: "Bed" },
  { value: "wall", label: "Wall" },
  { value: "bathroom", label: "Bathroom" },
  { value: "wardrobe", label: "Wardrobe" },
  { value: "floor", label: "Floor" },
];

interface PendingUpload {
  id: string;
  roomArea: RoomArea;
  previewUrl: string;
  base64: string;
  mimeType: string;
  blob: Blob;
  status: "uploading" | "analyzing" | "error";
  errorMessage?: string;
}

interface MoveInScanScreenProps {
  pg: PgStay;
  photos: MoveInPhoto[];
  isDemo: boolean;
  onUploadAndSavePhoto: (params: {
    photoId: string;
    roomArea: RoomArea;
    blob: Blob;
    mimeType: string;
    previewUrl: string;
    aiDamageTags: string[];
    aiSummary: string;
  }) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onLockAllPhotos: (unlockedIds: string[]) => Promise<void>;
}

export function MoveInScanScreen({
  pg,
  photos,
  isDemo,
  onUploadAndSavePhoto,
  onDeletePhoto,
  onLockAllPhotos,
}: MoveInScanScreenProps) {
  const [selectedArea, setSelectedArea] = useState<RoomArea>("wall");
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<MoveInPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const unlockedPhotos = photos.filter((p) => !p.locked);
  const lockedPhotos = photos.filter((p) => p.locked);
  const latestLockedAt = lockedPhotos.length
    ? Math.max(...lockedPhotos.map((p) => p.capturedAtMs))
    : null;

  async function processPendingUpload(item: PendingUpload) {
    setPending((prev) =>
      prev.map((p) =>
        p.id === item.id ? { ...p, status: "analyzing", errorMessage: undefined } : p
      )
    );

    try {
      const aiResult = await analyzeMoveInPhotoAI({
        imageBase64: item.base64,
        mimeType: item.mimeType,
        roomArea: item.roomArea,
      });

      setPending((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: "uploading" } : p))
      );

      await onUploadAndSavePhoto({
        photoId: item.id,
        roomArea: item.roomArea,
        blob: item.blob,
        mimeType: item.mimeType,
        previewUrl: item.previewUrl,
        aiDamageTags: aiResult.aiDamageTags,
        aiSummary: aiResult.aiSummary,
      });

      setPending((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload or AI inspection failed.";
      setPending((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, status: "error", errorMessage: msg } : p
        )
      );
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setFormError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const prepared = await validateAndPrepareImage(file);
      const previewUrl = URL.createObjectURL(prepared.blob);
      const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const item: PendingUpload = {
        id,
        roomArea: selectedArea,
        previewUrl,
        base64: prepared.base64,
        mimeType: prepared.mimeType,
        blob: prepared.blob,
        status: "analyzing",
      };

      setPending((prev) => [item, ...prev]);
      await processPendingUpload(item);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid image file.");
    }
  }

  async function handleConfirmLock() {
    setLocking(true);
    setFormError(null);
    try {
      await onLockAllPhotos(unlockedPhotos.map((p) => p.id));
      setLockConfirmOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not lock move-in photos.");
    } finally {
      setLocking(false);
    }
  }

  async function handleDelete(photoId: string) {
    setDeletingId(photoId);
    setFormError(null);
    try {
      await onDeletePhoto(photoId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not delete photo.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Move-in room scan
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {pg.pgName} · {pg.roomNumber} · Scan every area before unpacking.
          </p>
        </div>

        {unlockedPhotos.length > 0 && (
          <Button
            variant="accent"
            size="lg"
            onClick={() => setLockConfirmOpen(true)}
          >
            <Lock className="h-4 w-4" />
            Lock move-in record ({unlockedPhotos.length})
          </Button>
        )}
      </div>

      {/* Record Lock Status Banner */}
      {lockedPhotos.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                Locked on {formatDateTime(latestLockedAt || undefined)}
              </p>
              <p className="text-xs text-emerald-800">
                {lockedPhotos.length} move-in {lockedPhotos.length === 1 ? "photo is" : "photos are"}{" "}
                permanently timestamped and read-only.
              </p>
            </div>
          </div>
          {unlockedPhotos.length > 0 && (
            <span className="text-xs font-medium text-amber-800">
              {unlockedPhotos.length} new photo(s) pending lock
            </span>
          )}
        </div>
      )}

      {/* Upload / Capture Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Add room area photo</CardTitle>
          <CardDescription>
            Choose an area below, then upload or take a photo (images only, max 5 MB). Gemini will
            tag any pre-existing stains, cracks, or broken fittings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">Select room area</p>
            <div className="flex flex-wrap gap-2">
              {ROOM_AREAS.map((area) => {
                const count = photos.filter((p) => p.roomArea === area.value).length;
                const active = selectedArea === area.value;
                return (
                  <button
                    key={area.value}
                    type="button"
                    onClick={() => setSelectedArea(area.value)}
                    className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? "border-indigo-900 bg-indigo-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {area.label}
                    {count > 0 && (
                      <span
                        className={`ml-2 font-mono text-xs tabular-nums ${
                          active ? "text-indigo-200" : "text-slate-500"
                        }`}
                      >
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              <Camera className="h-4 w-4" />
              Capture or upload {selectedArea} photo
            </Button>
            {isDemo && (
              <span className="text-xs text-slate-500">
                Demo mode: uploaded photos use real Gemini inspection in your current session.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending / Failed Uploads */}
      {pending.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((item) => (
            <Card key={item.id} className="overflow-hidden border-amber-200">
              <div className="relative aspect-[4/3] bg-slate-100">
                <img
                  src={item.previewUrl}
                  alt={`Pending ${item.roomArea} scan`}
                  className="h-full w-full object-cover"
                />
                {item.status !== "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/55 p-4 text-center text-white">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
                    <p className="mt-2 text-sm font-medium">
                      {item.status === "analyzing"
                        ? "Analyzing defects with Gemini..."
                        : "Saving photo to Storage..."}
                    </p>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <p className="text-sm font-semibold capitalize text-slate-900">{item.roomArea}</p>
                {item.status === "error" && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-red-700">{item.errorMessage}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void processPendingUpload(item)}
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPending((prev) => prev.filter((p) => p.id !== item.id))
                        }
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Saved Move-in Photos */}
      {photos.length === 0 && pending.length === 0 ? (
        <Card className="p-10 text-center">
          <Camera className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">
            No move-in photos yet
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Start with the bedroom wall, bathroom fittings, and wardrobe hinges. Upload at least 3
            photos, then lock the record so it cannot be disputed later.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <Card key={photo.id} className="flex flex-col overflow-hidden">
              <button
                type="button"
                onClick={() => setZoomPhoto(photo)}
                className="group relative aspect-[4/3] w-full overflow-hidden bg-slate-100 text-left cursor-pointer"
              >
                <MoveInImg src={photo.photoUrl} alt={`${photo.roomArea} condition`} />
              </button>

              <CardContent className="flex flex-1 flex-col justify-between gap-3 p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-semibold capitalize text-slate-950">
                      {photo.roomArea}
                    </h3>
                    {photo.locked ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 whitespace-nowrap shrink-0">
                        <Lock className="h-3 w-3" />
                        Locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap shrink-0">
                        Unlocked
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {photo.locked
                      ? `Locked on ${formatDateTime(photo.capturedAtMs)}`
                      : `Captured ${formatDateTime(photo.capturedAtMs)}`}
                  </p>

                  <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
                    {photo.aiSummary}
                  </p>

                  {photo.aiDamageTags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {photo.aiDamageTags.map((tag, idx) => (
                        <span
                          key={`${photo.id}-tag-${idx}`}
                          className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">No pre-existing defects flagged</p>
                  )}
                </div>

                {!photo.locked && (
                  <div className="border-t border-slate-100 pt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      disabled={deletingId === photo.id}
                      onClick={() => void handleDelete(photo.id)}
                    >
                      {deletingId === photo.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove before lock
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Lock Confirmation Dialog */}
      <Dialog open={lockConfirmOpen} onOpenChange={setLockConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock move-in record?</DialogTitle>
            <DialogDescription>
              Locking stamps the server date and time on {unlockedPhotos.length} photo(s) and makes
              them permanently read-only under security rules. You can still scan additional areas
              later, but locked photos cannot be modified or deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLockConfirmOpen(false)}
              disabled={locking}
            >
              Cancel
            </Button>
            <Button type="button" variant="accent" onClick={handleConfirmLock} disabled={locking}>
              {locking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Confirm &amp; lock record
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Zoom Dialog */}
      <Dialog open={Boolean(zoomPhoto)} onOpenChange={(o) => !o && setZoomPhoto(null)}>
        <DialogContent className="max-w-2xl">
          {zoomPhoto && (
            <>
              <DialogHeader>
                <DialogTitle className="capitalize">
                  {zoomPhoto.roomArea} move-in photo
                </DialogTitle>
                <DialogDescription>
                  {zoomPhoto.locked
                    ? `Locked on ${formatDateTime(zoomPhoto.capturedAtMs)}`
                    : `Captured ${formatDateTime(zoomPhoto.capturedAtMs)}`}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <MoveInImg src={zoomPhoto.photoUrl} alt={zoomPhoto.roomArea} />
              </div>
              <p className="text-sm text-slate-700">{zoomPhoto.aiSummary}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoveInImg({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full min-h-[180px] w-full flex-col items-center justify-center bg-slate-100 p-4 text-center text-slate-500">
        <ImageOff className="h-7 w-7" />
        <span className="mt-1.5 text-xs">Photo unavailable offline</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
    />
  );
}
