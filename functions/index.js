// ============================================================
// functions/index.js — Firebase Cloud Functions
// PA Guest Tracker
// Deploy: firebase deploy --only functions
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

// ── Create User (Super Admin only) ───────────────────────────
exports.createUser = onCall(async (request) => {
  // 1. Must be authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  // 2. Must be Super Admin
  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists || callerDoc.data().role !== "superAdmin") {
    throw new HttpsError("permission-denied", "Only Super Admins can create users.");
  }

  // 3. Validate input
  const { name, email, password, role, chapterIds } = request.data;

  if (!name || !email || !password || !role) {
    throw new HttpsError("invalid-argument", "Name, email, password and role are required.");
  }

  const validRoles = ["superAdmin", "chapterAdmin", "desk"];
  if (!validRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.");
  }

  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  // 4. Create Firebase Auth user
  let userRecord;
  try {
    userRecord = await getAuth().createUser({
      email,
      password,
      displayName: name,
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "A user with this email already exists.");
    }
    throw new HttpsError("internal", err.message);
  }

  // 5. Create Firestore profile
  await db.collection("users").doc(userRecord.uid).set({
    name,
    email,
    role,
    chapterIds: chapterIds || [],
    createdAt: FieldValue.serverTimestamp(),
    createdBy: callerUid,
  });

  return { uid: userRecord.uid, message: "User created successfully." };
});

// ── Delete User (Super Admin only) ───────────────────────────
exports.deleteUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists || callerDoc.data().role !== "superAdmin") {
    throw new HttpsError("permission-denied", "Only Super Admins can delete users.");
  }

  const { uid } = request.data;
  if (!uid) throw new HttpsError("invalid-argument", "UID is required.");
  if (uid === callerUid) throw new HttpsError("invalid-argument", "You cannot delete yourself.");

  // Delete from Auth
  await getAuth().deleteUser(uid);

  // Delete Firestore profile
  await db.collection("users").doc(uid).delete();

  return { message: "User deleted successfully." };
});
