import React, { useState, useEffect } from "react";
import { AlertCircle, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { PgStay } from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface PgSetupScreenProps {
  existingPg: PgStay | null;
  onSavePg: (data: {
    pgName: string;
    ownerName: string;
    ownerPhone: string;
    address: string;
    roomNumber: string;
    monthlyRent: number;
    depositAmount: number;
    moveInDate: string;
    moveOutDate?: string;
  }) => Promise<void>;
  onDone: () => void;
}

export function PgSetupScreen({ existingPg, onSavePg, onDone }: PgSetupScreenProps) {
  const [pgName, setPgName] = useState(existingPg?.pgName || "");
  const [ownerName, setOwnerName] = useState(existingPg?.ownerName || "");
  const [ownerPhone, setOwnerPhone] = useState(existingPg?.ownerPhone || "");
  const [address, setAddress] = useState(existingPg?.address || "");
  const [roomNumber, setRoomNumber] = useState(existingPg?.roomNumber || "");
  const [monthlyRent, setMonthlyRent] = useState(
    existingPg?.monthlyRent ? String(existingPg.monthlyRent) : ""
  );
  const [depositAmount, setDepositAmount] = useState(
    existingPg?.depositAmount ? String(existingPg.depositAmount) : ""
  );
  const [moveInDate, setMoveInDate] = useState(
    existingPg?.moveInDate || new Date().toISOString().slice(0, 10)
  );
  const [moveOutDate, setMoveOutDate] = useState(existingPg?.moveOutDate || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingPg) {
      setPgName(existingPg.pgName);
      setOwnerName(existingPg.ownerName);
      setOwnerPhone(existingPg.ownerPhone);
      setAddress(existingPg.address);
      setRoomNumber(existingPg.roomNumber);
      setMonthlyRent(String(existingPg.monthlyRent));
      setDepositAmount(String(existingPg.depositAmount));
      setMoveInDate(existingPg.moveInDate);
      setMoveOutDate(existingPg.moveOutDate || "");
    }
  }, [existingPg]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pgName.trim().length < 2) {
      setError("PG name must be at least 2 characters.");
      return;
    }
    if (ownerName.trim().length < 2) {
      setError("Owner or warden name must be at least 2 characters.");
      return;
    }
    const phoneDigits = ownerPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      setError("Please enter a valid 10-digit owner phone number (e.g. 9845011223 or +91...).");
      return;
    }
    if (address.trim().length < 5) {
      setError("Please enter the PG address including locality (e.g. Koramangala 4th Block).");
      return;
    }
    if (!roomNumber.trim()) {
      setError("Please enter your room or bed number.");
      return;
    }

    const rentNum = Number(monthlyRent);
    const depositNum = Number(depositAmount);
    if (!Number.isFinite(rentNum) || rentNum <= 0 || rentNum > 1000000) {
      setError("Monthly rent must be a valid positive amount in ₹.");
      return;
    }
    if (!Number.isFinite(depositNum) || depositNum <= 0 || depositNum > 5000000) {
      setError("Deposit amount must be a valid positive amount in ₹.");
      return;
    }
    if (!moveInDate) {
      setError("Please select your move-in date.");
      return;
    }
    if (moveOutDate && new Date(moveOutDate) < new Date(moveInDate)) {
      setError("Move-out date cannot be earlier than your move-in date.");
      return;
    }

    setSaving(true);
    try {
      await onSavePg({
        pgName: pgName.trim(),
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim(),
        address: address.trim(),
        roomNumber: roomNumber.trim(),
        monthlyRent: rentNum,
        depositAmount: depositNum,
        moveInDate,
        moveOutDate: moveOutDate || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save PG details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {existingPg ? "Update your PG details" : "Add your PG"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          These exact facts anchor your move-in scans, deposit calculation, and formal notices.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-indigo-900" />
            <CardTitle>PG &amp; Deposit Details</CardTitle>
          </div>
          <CardDescription>
            Enter the details exactly as shown on your rent receipt or booking message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pg-name">PG name</Label>
                <Input
                  id="pg-name"
                  placeholder="e.g. Sunrise PG"
                  value={pgName}
                  onChange={(e) => setPgName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="room-number">Room / bed number</Label>
                <Input
                  id="room-number"
                  placeholder="e.g. Room 204"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="owner-name">Owner / warden name</Label>
                <Input
                  id="owner-name"
                  placeholder="e.g. Mahesh Gowda"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner-phone">Owner WhatsApp / phone</Label>
                <Input
                  id="owner-phone"
                  type="tel"
                  placeholder="e.g. +91 98450 11223"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pg-address">Full PG address (Bengaluru)</Label>
              <Input
                id="pg-address"
                placeholder="e.g. 18th Main, 4th Block, Koramangala, Bengaluru"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="monthly-rent">Monthly rent (₹)</Label>
                <Input
                  id="monthly-rent"
                  type="number"
                  min={1}
                  step="1"
                  placeholder="e.g. 11500"
                  className="tabular-nums"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deposit-amount">Security deposit paid (₹)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min={1}
                  step="1"
                  placeholder="e.g. 20000"
                  className="tabular-nums"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="move-in-date">Move-in date</Label>
                <Input
                  id="move-in-date"
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="move-out-date">Move-out date (optional)</Label>
                <Input
                  id="move-out-date"
                  type="date"
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              {existingPg && (
                <Button type="button" variant="outline" onClick={onDone}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {existingPg ? "Save PG changes" : "Save PG & start move-in scan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
