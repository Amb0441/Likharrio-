import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { createNotification } from "../utils/notifications";

export async function approveVerification(requestId: string, artistUid: string) {
  await updateDoc(doc(db, "verificationRequests", requestId), {
    status: "approved",
    reviewedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", artistUid), {
    artistStatus: "approved",
    verified: true,
  });
  await createNotification({
    userId: artistUid,
    type: "system",
    title: "Artist verification approved",
    body: "Your verification was approved. Verified artist features are now open.",
  });
}

export async function rejectVerification(
  requestId: string,
  artistUid: string,
  note: string
) {
  await updateDoc(doc(db, "verificationRequests", requestId), {
    status: "rejected",
    reviewNote: note.trim() || null,
    reviewedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", artistUid), {
    artistStatus: "rejected",
    verified: false,
    verificationNote: note.trim() || null,
  });
  await createNotification({
    userId: artistUid,
    type: "system",
    title: "Artist verification needs changes",
    body: note.trim()
      ? note.trim()
      : "Your verification was not approved. You can submit it again from your profile.",
  });
}

export async function setUserSuspended(uid: string, suspended: boolean) {
  await updateDoc(doc(db, "users", uid), {
    suspended,
    ...(suspended ? {} : { pendingDelete: false, disabled: false }),
  });
}

export async function setUserPendingDelete(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    pendingDelete: true,
    disabled: true,
  });
}

export async function setUserRole(
  uid: string,
  role: "artist" | "enthusiast" | "admin"
) {
  await updateDoc(doc(db, "users", uid), { role });
}

export async function resolveReport(
  reportId: string,
  status: "reviewed" | "dismissed"
) {
  await updateDoc(doc(db, "reports", reportId), {
    status,
    reviewedAt: serverTimestamp(),
  });
}
