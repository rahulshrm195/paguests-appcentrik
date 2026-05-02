// ============================================================
// firebase.js — Firebase config + Firestore/Auth helpers
// PA Guest Tracker
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Config ───────────────────────────────────────────
// Replace these values with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyDFv6P4tf7695y2_aaZ7x9tT6DlVrpOAZ8",
  authDomain: "pa-guest-tracker.firebaseapp.com",
  projectId: "pa-guest-tracker",
  storageBucket: "pa-guest-tracker.firebasestorage.app",
  messagingSenderId: "856716716643",
  appId: "1:856716716643:web:f05bf047510a83c158e656",
};

/* 
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDFv6P4tf7695y2_aaZ7x9tT6DlVrpOAZ8",
  authDomain: "pa-guest-tracker.firebaseapp.com",
  projectId: "pa-guest-tracker",
  storageBucket: "pa-guest-tracker.firebasestorage.app",
  messagingSenderId: "856716716643",
  appId: "1:856716716643:web:f05bf047510a83c158e656"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
*/

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ── Auth Helpers ──────────────────────────────────────────────
export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logoutUser = () => signOut(auth);

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

// ── User Profile ──────────────────────────────────────────────
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createUserProfile = async (uid, data) => {
  await setDoc(doc(db, "users", uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

// ── Chapters ──────────────────────────────────────────────────
export const getChapters = async () => {
  const snap = await getDocs(query(collection(db, "chapters"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getChapter = async (id) => {
  const snap = await getDoc(doc(db, "chapters", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createChapter = async (data) => {
  return await addDoc(collection(db, "chapters"), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const updateChapter = async (id, data) => {
  await updateDoc(doc(db, "chapters", id), { ...data, updatedAt: serverTimestamp() });
};

export const deleteChapter = async (id) => {
  await deleteDoc(doc(db, "chapters", id));
};

// Get chapters assigned to a specific admin
export const getChaptersByAdmin = async (uid) => {
  const snap = await getDocs(
    query(collection(db, "chapters"), where("adminUids", "array-contains", uid))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── Meetings ──────────────────────────────────────────────────
export const getMeetings = async (chapterId) => {
  const snap = await getDocs(
    query(
      collection(db, "meetings"),
      where("chapterId", "==", chapterId),
      orderBy("date", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getUpcomingMeetings = async (chapterId) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const snap = await getDocs(
    query(
      collection(db, "meetings"),
      where("chapterId", "==", chapterId),
      orderBy("date", "asc")
    )
  );
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return all.filter((m) => {
    const mDate = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return mDate >= now;
  });
};

export const getMeeting = async (id) => {
  const snap = await getDoc(doc(db, "meetings", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createMeeting = async (data) => {
  return await addDoc(collection(db, "meetings"), {
    ...data,
    attendees: [],
    createdAt: serverTimestamp(),
  });
};

export const updateMeeting = async (id, data) => {
  await updateDoc(doc(db, "meetings", id), { ...data, updatedAt: serverTimestamp() });
};

export const markGuestAttendance = async (meetingId, guestId, present) => {
  const meetingRef = doc(db, "meetings", meetingId);
  const meetingSnap = await getDoc(meetingRef);
  if (!meetingSnap.exists()) return;

  let attendees = meetingSnap.data().attendees || [];
  if (present && !attendees.includes(guestId)) {
    attendees.push(guestId);
  } else if (!present) {
    attendees = attendees.filter((id) => id !== guestId);
  }
  await updateDoc(meetingRef, { attendees, updatedAt: serverTimestamp() });

  // Update guest meetingsAttended array
  const guestRef = doc(db, "guests", guestId);
  const guestSnap = await getDoc(guestRef);
  if (!guestSnap.exists()) return;

  let meetingsAttended = guestSnap.data().meetingsAttended || [];
  if (present && !meetingsAttended.includes(meetingId)) {
    meetingsAttended.push(meetingId);
    // Auto-upgrade status to Attending if still New
    const currentStatus = guestSnap.data().status;
    const updates = { meetingsAttended, updatedAt: serverTimestamp() };
    if (currentStatus === "New") updates.status = "Attending";
    await updateDoc(guestRef, updates);
  } else if (!present) {
    meetingsAttended = meetingsAttended.filter((id) => id !== meetingId);
    await updateDoc(guestRef, { meetingsAttended, updatedAt: serverTimestamp() });
  }
};

// ── Guests ────────────────────────────────────────────────────
export const getGuests = async (chapterId) => {
  const snap = await getDocs(
    query(
      collection(db, "guests"),
      where("chapterId", "==", chapterId),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getGuest = async (id) => {
  const snap = await getDoc(doc(db, "guests", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Public guest registration (no auth required)
export const registerGuestPublic = async (data) => {
  return await addDoc(collection(db, "guests"), {
    ...data,
    status: "New",
    meetingsAttended: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateGuest = async (id, data) => {
  await updateDoc(doc(db, "guests", id), { ...data, updatedAt: serverTimestamp() });
};

export const deleteGuest = async (id) => {
  await deleteDoc(doc(db, "guests", id));
};

// ── Follow-ups ────────────────────────────────────────────────
export const getFollowups = async (guestId) => {
  const snap = await getDocs(
    query(
      collection(db, "followups"),
      where("guestId", "==", guestId),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addFollowup = async (data) => {
  return await addDoc(collection(db, "followups"), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

// ── Users (admin management) ──────────────────────────────────
export const getUsers = async () => {
  const snap = await getDocs(query(collection(db, "users"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateUserProfile = async (uid, data) => {
  await updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
};

// ── Super Admin Stats ─────────────────────────────────────────
export const getAllGuests = async () => {
  const snap = await getDocs(
    query(collection(db, "guests"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAllMeetings = async () => {
  const snap = await getDocs(
    query(collection(db, "meetings"), orderBy("date", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── Exports ───────────────────────────────────────────────────
export {
  serverTimestamp,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
};
