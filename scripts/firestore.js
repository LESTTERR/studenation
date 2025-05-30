import { db, auth } from './firebase.js';
import {
  collection, addDoc, getDocs, orderBy, where, query, setDoc, doc, getDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';

const itemRef = collection(db, 'items');

export async function addItem(item) {
  return await setDoc(doc(db, 'items', item.id), item); // Use custom ID
}


export async function getRecentItems() {
  const q = query(itemRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function getItemsByCategory(category) {
  const ref = collection(db, 'items');
  const q = query(ref, where('category', '==', category), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

export async function saveUserProfile(uid, data) {
  return await setDoc(doc(db, 'users', uid), data);
}

export async function getUserProfile(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function sendRequestToOwner(itemId, ownerId, requesterId, message = '') {
  const ref = collection(db, 'requests');
  return await addDoc(ref, {
    itemId,
    ownerId,
    requesterId,
    message,
    status: 'pending',
    createdAt: Date.now()
  });
}

export async function getRequestsForOwner(ownerId) {
  const ref = collection(db, 'requests');
  const q = query(ref, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateRequestStatus(requestId, status, responseMessage = '') {
  const ref = doc(db, 'requests', requestId);
  return await setDoc(ref, { status, responseMessage }, { merge: true });
}

export async function cancelRequest(requestId) {
  const ref = doc(db, 'requests', requestId);
  await deleteDoc(ref);
}

export async function markItemAsTaken(itemId) {
  const ref = doc(db, 'items', itemId);
  return await setDoc(ref, { status: 'taken' }, { merge: true });
}

export async function sendTradeOffer(requestId, imageUrl, description) {
  const ref = doc(db, 'requests', requestId);
  return await setDoc(ref, {
    tradeOffer: {
      imageUrl,
      description,
      status: 'pending'
    }
  }, { merge: true });
}

export async function updateTradeOfferStatus(requestId, status, message = '') {
  const ref = doc(db, 'requests', requestId);
  return await setDoc(ref, {
    tradeOffer: { status, message }
  }, { merge: true });
}


// Update the sendTradeOfferToOwner function
export async function sendTradeOfferToOwner(itemId, imageUrl, description) {
  const itemDoc = await getDoc(doc(db, 'items', itemId));
  if (!itemDoc.exists()) throw new Error('Item not found');
  
  const itemData = itemDoc.data();
  if (!itemData.owner) throw new Error('Item has no owner specified');

  // CORRECTED: Store trade offer directly in the request
  const requestData = {
    itemId,
    ownerId: itemData.owner,
    requesterId: auth.currentUser.uid,
    status: 'pending',
    createdAt: new Date().toISOString(),
    tradeOffer: {
      imageUrl: imageUrl || null,
      description: description || 'No description provided',
      status: 'pending'
    }
  };

  const ref = collection(db, 'requests');
  return await addDoc(ref, requestData);
}
export async function deleteItem(itemId) {
  const ref = doc(db, 'items', itemId);
  return await deleteDoc(ref);
}
export async function getItemsByOwner(uid) {
  const q = query(itemRef, where('owner', '==', uid), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}
