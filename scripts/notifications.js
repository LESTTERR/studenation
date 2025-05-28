import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getRequestsForOwner, updateRequestStatus, getUserProfile, getRecentItems, markItemAsTaken, updateTradeOfferStatus } from './firestore.js';

function renderNotifications(requests, itemsMap, usersMap) {
  const notifDiv = document.getElementById('notificationsList');
  notifDiv.innerHTML = '';
  if (requests.length === 0) {
    notifDiv.innerHTML = '<div style="color:#888;text-align:center;padding:2rem;">No new requests.</div>';
    return;
  }
  requests.forEach(req => {
    const item = itemsMap[req.itemId];
    const requester = usersMap[req.requesterId];
    notifDiv.innerHTML += `
      <div class="notif-card" style="background:#fff;padding:1.2rem 1.5rem;margin-bottom:1.5rem;border-radius:10px;box-shadow:0 2px 8px #0001;">
        <div>
          <strong>${requester ? requester.email : req.requesterId}</strong>
         ${item?.type === 'exchange' ? 'wants to trade for your item' : 'has requested your item'}
<strong>${item ? item.title : 'an item'}</strong>

        </div>
        <div style="margin-top:10px;">
          <input type="text" class="meetup-message" id="msg-${req.id}" placeholder="Message (e.g. Meetup time/place)" style="width:70%;padding:6px;margin-bottom:8px;">
          <br>
          <button class="btn btn-primary btn-xs accept-btn" data-id="${req.id}">Accept</button>
          <button class="btn btn-outline btn-xs decline-btn" data-id="${req.id}">Decline</button>
        </div>
      </div>
    `;

    // For donation items, add a "Mark as Taken" button after accept
    if (item && item.type === 'free' && req.status === 'accepted') {
      notifDiv.innerHTML += `
        <button class="btn btn-success btn-xs mark-taken-btn" data-id="${item.id}" style="margin-left:8px;">
          <i class="fas fa-check"></i> Mark as Taken
        </button>
      `;
    }

    // If request has a trade offer, show view trade button
   if (req.tradeOffer && req.tradeOffer.imageUrl && req.tradeOffer.description) {

      notifDiv.innerHTML += `
        <button class="btn btn-primary btn-xs view-trade-btn" data-id="${req.id}" style="margin-left:8px;">
          <i class="fas fa-eye"></i> Show Item
        </button>
      `;
    }
  });

  notifDiv.querySelectorAll('.accept-btn').forEach(btn => {
    btn.onclick = async () => {
      const reqId = btn.dataset.id;
      const msg = document.getElementById('msg-' + reqId).value;
      await updateRequestStatus(reqId, 'accepted', msg);
      alert('Request accepted and message sent!');
      location.reload();
    };
  });
  notifDiv.querySelectorAll('.decline-btn').forEach(btn => {
    btn.onclick = async () => {
      await updateRequestStatus(btn.dataset.id, 'declined');
      alert('Request declined.');
      location.reload();
    };
  });
  notifDiv.querySelectorAll('.mark-taken-btn').forEach(btn => {
    btn.onclick = async () => {
      await markItemAsTaken(btn.dataset.id);
      alert('Item marked as taken!');
      location.reload();
    };
  });
 notifDiv.querySelectorAll('.view-trade-btn').forEach(btn => {
  btn.onclick = () => {
    const reqId = btn.dataset.id;
    const req = requests.find(r => r.id === reqId);
    const trade = req.tradeOffer || {};
    const image = trade.imageUrl || '';
    const desc = trade.description || 'No description provided.';
    const body = document.getElementById('tradeOfferBody');

body.innerHTML = `
  <img src="${image}" style="max-width:100%;border-radius:8px;">
  <p style="margin-top:10px;"><strong>Description:</strong> ${desc}</p>
  <input type="text" id="tradeMsg-${reqId}" class="meetup-message" placeholder="Message (e.g. Meetup place/time)" style="width:100%;padding:6px;margin-top:10px;">
  <div style="margin-top:10px;">
    <button class="btn btn-success btn-xs accept-trade-btn" data-id="${reqId}">Accept</button>
    <button class="btn btn-danger btn-xs decline-trade-btn" data-id="${reqId}">Decline</button>
  </div>
`;

    

    document.getElementById('viewTradeModal').classList.add('active');
    document.getElementById('closeViewTradeModal').onclick = () => {
      document.getElementById('viewTradeModal').classList.remove('active');
    };

   document.querySelector('.accept-trade-btn').onclick = async () => {
  const msg = document.getElementById(`tradeMsg-${reqId}`).value;
  await updateTradeOfferStatus(reqId, 'accepted', msg || '');
 


      alert('Trade accepted!');
      document.getElementById('viewTradeModal').classList.remove('active');
      location.reload();
    };

    document.querySelector('.decline-trade-btn').onclick = async () => {
      await updateTradeOfferStatus(reqId, 'declined');
      alert('Trade declined.');
      document.getElementById('viewTradeModal').classList.remove('active');
      location.reload();
    };
  };
});

}

onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = 'login.html';
  // Get all requests for this user
  const requests = await getRequestsForOwner(user.uid);
  // Get all items (to show item titles)
  const items = await getRecentItems();
  const itemsMap = {};
  items.forEach(item => { itemsMap[item.id] = item; });

  // Get all unique requesterIds
  const requesterIds = [...new Set(requests.map(r => r.requesterId))];
  // Fetch user profiles for all requesterIds
  const usersMap = {};
  for (const uid of requesterIds) {
    usersMap[uid] = await getUserProfile(uid);
  }

  renderNotifications(requests.filter(r => r.status === 'pending'), itemsMap, usersMap);
});

