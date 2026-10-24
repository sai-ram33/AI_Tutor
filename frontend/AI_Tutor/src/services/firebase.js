import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBdJJAI_Pz5cqXcz7s1W4BzX7HQiDKAql8",
  authDomain: "ai-tutor-9db4e.firebaseapp.com",
  projectId: "ai-tutor-9db4e",
  storageBucket: "ai-tutor-9db4e.firebasestorage.app",
  messagingSenderId: "4963789676",
  appId: "1:4963789676:web:ca45310b0fbde1d1612149"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Custom error mapping for friendly user alerts
export const getFirebaseErrorMessage = (error) => {
  if (!error) return 'An unexpected error occurred.';
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please log in.';
    case 'auth/invalid-email':
      return 'The email address is invalid.';
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not activated yet in your Firebase Console. Go to Authentication > Sign-in method, click "Get Started", and enable Email/Password.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console. Go to Authentication > Sign-in method and enable Email/Password.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before finishing.';
    case 'auth/cancelled-popup-request':
      return 'Previous sign-in popup was cancelled.';
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Please allow popups for this site.';
    default:
      return error.message || 'Authentication failed. Please try again.';
  }
};

// ==========================================
// Authentication Functions
// ==========================================

/**
 * Sign up a new user with email and password
 */
export const firebaseSignUp = async ({ name, email, password, level = 'beginner', language = 'english' }) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Update Auth Profile Display Name
  if (name) {
    await updateProfile(user, { displayName: name.trim() }).catch(() => {});
  }

  const token = await user.getIdToken();

  const userProfile = {
    uid: user.uid,
    name: name.trim() || user.displayName || 'Learner',
    email: user.email,
    level,
    language,
    createdAt: new Date().toISOString(),
  };

  // Store user document in Firestore
  try {
    await setDoc(doc(db, 'users', user.uid), userProfile, { merge: true });
  } catch (fsErr) {
    console.warn('[Firestore] Error saving initial user profile:', fsErr.message);
  }

  return { user: userProfile, token, firebaseUser: user };
};

/**
 * Log in an existing user with email and password
 */
export const firebaseLogin = async ({ email, password }) => {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;
  const token = await user.getIdToken();

  // Try to load user profile from Firestore
  let userProfile = {
    uid: user.uid,
    name: user.displayName || 'Learner',
    email: user.email,
    level: 'intermediate',
    language: 'english',
  };

  try {
    const userDocSnap = await getDoc(doc(db, 'users', user.uid));
    if (userDocSnap.exists()) {
      userProfile = { ...userProfile, ...userDocSnap.data() };
    } else {
      // First time doc creation
      await setDoc(doc(db, 'users', user.uid), userProfile, { merge: true });
    }
  } catch (fsErr) {
    console.warn('[Firestore] Error fetching user profile on login:', fsErr.message);
  }

  return { user: userProfile, token, firebaseUser: user };
};

/**
 * Google Popup Sign-in
 */
export const firebaseGoogleLogin = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const token = await user.getIdToken();

  let userProfile = {
    uid: user.uid,
    name: user.displayName || 'Learner',
    email: user.email,
    level: 'intermediate',
    language: 'english',
    photoURL: user.photoURL || null,
  };

  try {
    const userDocSnap = await getDoc(doc(db, 'users', user.uid));
    if (userDocSnap.exists()) {
      userProfile = { ...userProfile, ...userDocSnap.data() };
    } else {
      await setDoc(doc(db, 'users', user.uid), {
        ...userProfile,
        createdAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (fsErr) {
    console.warn('[Firestore] Error fetching/saving Google user profile:', fsErr.message);
  }

  return { user: userProfile, token, firebaseUser: user };
};

/**
 * Log out
 */
export const firebaseLogout = async () => {
  await signOut(auth);
};

/**
 * Send Password Reset Email
 */
export const firebaseResetPassword = async (email) => {
  await sendPasswordResetEmail(auth, email.trim());
};

// ==========================================
// Firestore Data Fallback Storage Functions
// (Used when PostgreSQL is disconnected)
// ==========================================

export const firestoreService = {
  async saveUserProfile(uid, data) {
    try {
      await setDoc(doc(db, 'users', uid), data, { merge: true });
      return true;
    } catch (e) {
      console.warn('[Firestore] saveUserProfile error:', e.message);
      return false;
    }
  },

  async getUserProfile(uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      console.warn('[Firestore] getUserProfile error:', e.message);
      return null;
    }
  },

  async getConversations(userId) {
    try {
      const convsCol = collection(db, 'users', userId, 'conversations');
      const q = query(convsCol, orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      const convs = [];
      snap.forEach((d) => {
        convs.push({ id: d.id, ...d.data() });
      });
      return convs;
    } catch (e) {
      console.warn('[Firestore] getConversations error:', e.message);
      return [];
    }
  },

  async saveConversation(userId, conv) {
    try {
      const convRef = doc(db, 'users', userId, 'conversations', String(conv.id));
      await setDoc(convRef, {
        id: String(conv.id),
        title: conv.title || 'New Chat',
        pinned: !!conv.pinned,
        updatedAt: conv.updatedAt || new Date().toISOString(),
      }, { merge: true });

      // Save messages in subcollection if present
      if (conv.messages && Array.isArray(conv.messages)) {
        for (const msg of conv.messages) {
          const msgRef = doc(db, 'users', userId, 'conversations', String(conv.id), 'messages', String(msg.id));
          await setDoc(msgRef, {
            id: String(msg.id),
            role: msg.role,
            content: msg.content,
            mode: msg.mode || 'explain',
            timestamp: msg.timestamp || new Date().toISOString(),
            ...(msg.metadata ? { metadata: msg.metadata } : {}),
            ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}),
          }, { merge: true });
        }
      }
      return true;
    } catch (e) {
      console.warn('[Firestore] saveConversation error:', e.message);
      return false;
    }
  },

  async getMessages(userId, convId) {
    try {
      const msgsCol = collection(db, 'users', userId, 'conversations', String(convId), 'messages');
      const q = query(msgsCol, orderBy('timestamp', 'asc'));
      const snap = await getDocs(q);
      const msgs = [];
      snap.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() });
      });
      return msgs;
    } catch (e) {
      console.warn('[Firestore] getMessages error:', e.message);
      return [];
    }
  },

  async saveMessage(userId, convId, message) {
    try {
      const msgRef = doc(db, 'users', userId, 'conversations', String(convId), 'messages', String(message.id));
      await setDoc(msgRef, {
        id: String(message.id),
        role: message.role,
        content: message.content,
        mode: message.mode || 'explain',
        timestamp: message.timestamp || new Date().toISOString(),
        ...(message.metadata ? { metadata: message.metadata } : {}),
        ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
      }, { merge: true });

      // Touch parent conversation updatedAt
      const convRef = doc(db, 'users', userId, 'conversations', String(convId));
      await setDoc(convRef, { updatedAt: new Date().toISOString() }, { merge: true });
      return true;
    } catch (e) {
      console.warn('[Firestore] saveMessage error:', e.message);
      return false;
    }
  },

  async deleteConversation(userId, convId) {
    try {
      await deleteDoc(doc(db, 'users', userId, 'conversations', String(convId)));
      return true;
    } catch (e) {
      console.warn('[Firestore] deleteConversation error:', e.message);
      return false;
    }
  },

  async updateConversationTitle(userId, convId, title) {
    try {
      await setDoc(doc(db, 'users', userId, 'conversations', String(convId)), {
        title,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return true;
    } catch (e) {
      console.warn('[Firestore] updateConversationTitle error:', e.message);
      return false;
    }
  },

  async getUserStats(userId) {
    try {
      const convs = await this.getConversations(userId);
      let totalQuestions = 0;
      const dates = new Set();

      for (const conv of convs) {
        const msgs = await this.getMessages(userId, conv.id);
        const userMsgs = msgs.filter((m) => m.role === 'user');
        totalQuestions += userMsgs.length;
        userMsgs.forEach((m) => {
          if (m.timestamp) {
            dates.add(new Date(m.timestamp).toISOString().split('T')[0]);
          }
        });
      }

      return {
        questionsAsked: totalQuestions,
        subjectsExplored: convs.filter((c) => c.title && c.title !== 'New Chat').length || (totalQuestions > 0 ? 1 : 0),
        streakDays: dates.size > 0 ? Math.min(dates.size, 7) : 0,
      };
    } catch (e) {
      console.warn('[Firestore] getUserStats error:', e.message);
      return { questionsAsked: 0, subjectsExplored: 0, streakDays: 0 };
    }
  },
};
