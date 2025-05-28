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

export async function sendTradeOfferToOwner(itemId, imageUrl, description) {
  console.log('sendTradeOfferToOwner called with:', { itemId, imageUrl, description });
  
  const itemDoc = await getDoc(doc(db, 'items', itemId));
  const itemData = itemDoc.exists() ? itemDoc.data() : null;
  if (!itemData) {
    console.error('Item not found:', itemId);
    throw new Error('Item not found');
  }

  if (!itemData.owner) {
    console.error('Item has no owner field:', itemData);
    throw new Error('Item has no owner specified');
  }

  console.log('Creating trade offer from', auth.currentUser.uid, 'to', itemData.owner);
  
  const ref = collection(db, 'requests');
  const result = await addDoc(ref, {
    itemId,
    ownerId: itemData.owner,
    requesterId: auth.currentUser.uid,
    type: 'exchange',
    status: 'pending',
    createdAt: Date.now(),
    tradeOfferImageUrl: imageUrl || null,
    tradeOfferDescription: description || 'No description',
    tradeOfferStatus: 'pending'
  });

  console.log('Trade offer created with ID:', result.id);
  return result;
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
