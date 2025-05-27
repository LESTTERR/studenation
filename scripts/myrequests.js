import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getDocs, collection, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';
import { db } from './firebase.js';
import { getRecentItems, cancelRequest, sendTradeOffer } from './firestore.js';

async function getRequestsByRequester(requesterId) {
  const ref = collection(db, 'requests');
  const q = query(ref, where('requesterId', '==', requesterId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function renderMyRequests(requests, itemsMap) {
  const list = document.getElementById('myRequestsList');
  list.innerHTML = '';
  if (requests.length === 0) {
    list.innerHTML = '<div style="color:#888;text-align:center;padding:2rem;">No requests yet.</div>';
    return;
  }
  requests.forEach(req => {
    let actions = '';
    if (req.status === 'pending') {
      actions = `
        <button class="btn btn-outline btn-xs cancel-btn" data-id="${req.id}" style="margin-left:8px;">
          <i class="fas fa-times"></i> Cancel Request
        </button>
      `;
    }
    if (req.status === 'accepted') {
      actions = `
        <button class="btn btn-danger btn-xs delete-btn" data-id="${req.id}" style="margin-left:8px;">
          <i class="fas fa-trash"></i> Delete
        </button>
      `;
    }
    let html = `
      <div class="notif-card" style="background:#fff;padding:1.2rem 1.5rem;margin-bottom:1.5rem;border-radius:10px;box-shadow:0 2px 8px #0001;overflow:auto;">
        <div>
          <strong>Item:</strong> ${itemsMap[req.itemId] ? itemsMap[req.itemId].title : req.itemId}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
          <div>
            <span style="font-weight:700;font-size:1.1rem;letter-spacing:0.5px;">
              Status: <span style="text-transform:capitalize;">${req.status}</span>
            </span>
            ${req.status === 'accepted' && req.responseMessage ? `
              <div style="margin-top:6px;">
                <span style="font-weight:700;font-size:1.05rem;color:#4361ee;">
                  Message from owner:
                </span>
                <span style="font-size:1.05rem;">${req.responseMessage}</span>
              </div>
            ` : ''}
            ${req.tradeOffer && req.tradeOffer.status === 'accepted' && req.tradeOffer.message ? `
              <div style="margin-top:8px;">
                <strong>Meetup Message:</strong> ${req.tradeOffer.message}
              </div>
            ` : ''}
          </div>
          <div>
            ${actions}
          </div>
        </div>
      </div>
    `;
    list.innerHTML += html;
  });

  // Cancel button
  document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('Are you sure you want to cancel this request?')) {
        await cancelRequest(btn.dataset.id);
        alert('Request cancelled.');
        location.reload();
      }
    };
  });

  // Delete button
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('Are you sure you want to delete this request?')) {
        await cancelRequest(btn.dataset.id);
        alert('Request deleted.');
        location.reload();
      }
    };
  });
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('trade-btn')) {
    const reqId = e.target.dataset.id;
    document.getElementById('tradeModal').classList.add('active');
    document.getElementById('sendTradeBtn').onclick = async () => {
      const file = document.getElementById('tradeImage').files[0];
      const desc = document.getElementById('tradeDesc').value;
      // You need to upload the image to storage and get a URL, or use base64 for demo:
      let imageUrl = '';
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          imageUrl = reader.result;
          await sendTradeOffer(reqId, imageUrl, desc);
          alert('Trade offer sent!');
          document.getElementById('tradeModal').classList.remove('active');
        };
        reader.readAsDataURL(file);
      } else {
        await sendTradeOffer(reqId, '', desc);
        alert('Trade offer sent!');
        document.getElementById('tradeModal').classList.remove('active');
      }
    };
    document.getElementById('closeTradeModal').onclick = () => {
      document.getElementById('tradeModal').classList.remove('active');
    };
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = 'login.html';
  const requests = await getRequestsByRequester(user.uid);
  const items = await getRecentItems();
  const itemsMap = {};
  items.forEach(item => { itemsMap[item.id] = item; });
  renderMyRequests(requests, itemsMap);
});