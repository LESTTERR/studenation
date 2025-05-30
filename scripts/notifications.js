import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getRequestsForOwner, updateRequestStatus, getUserProfile, getRecentItems, markItemAsTaken, updateTradeOfferStatus } from './firestore.js';

// Add modal close functionality
document.getElementById('closeViewTradeModal').onclick = () => {
  document.getElementById('viewTradeModal').classList.remove('active');
};

// Close modal when clicking outside
document.getElementById('viewTradeModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('viewTradeModal')) {
    document.getElementById('viewTradeModal').classList.remove('active');
  }
});

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
    
    // Create notification card
    const notifCard = document.createElement('div');
    notifCard.className = 'notif-card';
    notifCard.style = 'background:#fff;padding:1.2rem 1.5rem;margin-bottom:1.5rem;border-radius:10px;box-shadow:0 2px 8px #0001;';
    
    // Use HTML string to ensure consistent button container structure
    notifCard.innerHTML = `
      <div>
        <strong>${requester ? requester.email : req.requesterId}</strong>
        ${item?.type === 'exchange' ? 'wants to trade for your item' : 'has requested your item'}
        <strong>${item ? item.title : 'an item'}</strong>
      </div>
      <div class="button-container" style="margin-top:10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
        <input type="text" class="meetup-message" id="msg-${req.id}" 
               placeholder="Message (e.g. Meetup time/place)" 
               style="width:100%;padding:6px;margin-bottom:8px;">
        <button class="btn btn-primary btn-xs accept-btn" data-id="${req.id}">Accept</button>
        <button class="btn btn-outline btn-xs decline-btn" data-id="${req.id}">Decline</button>
      </div>
    `;

    // Add "Mark as Taken" button for accepted free items
    if (item && item.type === 'free' && req.status === 'accepted') {
      const buttonContainer = notifCard.querySelector('.button-container');
      buttonContainer.innerHTML += `
        <button class="btn btn-success btn-xs mark-taken-btn" data-id="${item.id}" style="margin-left:8px;">
          <i class="fas fa-check"></i> Mark as Taken
        </button>
      `;
    }

    // Add "View Trade Offer" button for exchange items
    if (item?.type === 'exchange' && req.tradeOffer) {
      const buttonContainer = notifCard.querySelector('.button-container');
      buttonContainer.innerHTML += `
        <button class="btn btn-primary btn-xs view-trade-btn" data-id="${req.id}" style="margin-left:8px;">
          <i class="fas fa-eye"></i> View Trade Offer
        </button>
      `;
    }

    notifDiv.appendChild(notifCard);
  });

  // Event listeners for buttons
  notifDiv.querySelectorAll('.accept-btn').forEach(btn => {
    btn.onclick = async () => {
      const reqId = btn.dataset.id;
      const msg = document.getElementById(`msg-${reqId}`).value;
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
      if (!req?.tradeOffer) {
        alert('No trade offer found');
        return;
      }

      const trade = req.tradeOffer;
      const modalBody = document.getElementById('tradeOfferBody');
      
      modalBody.innerHTML = `
        <div class="trade-offer-container">
          ${trade.imageUrl ? `
            <div class="trade-image-container">
              <img src="${trade.imageUrl}" alt="Trade Offer" class="trade-image">
            </div>
          ` : ''}
          <div class="trade-details">
            <h4>Trade Offer Details</h4>
            <p>${trade.description || 'No description provided'}</p>
            <div class="trade-actions">
              <textarea id="tradeMsg-${reqId}" 
                      placeholder="Your response message..." 
                      class="trade-message"></textarea>
              <div class="action-buttons">
                <button class="btn btn-success accept-trade-btn" data-id="${reqId}">
                  Accept Trade
                </button>
                <button class="btn btn-danger decline-trade-btn" data-id="${reqId}">
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Show the modal
      document.getElementById('viewTradeModal').classList.add('active');

      // Handle accept/decline
      document.querySelector('.accept-trade-btn').onclick = async () => {
        const msg = document.getElementById(`tradeMsg-${reqId}`).value;
        await updateTradeOfferStatus(reqId, 'accepted', msg);
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
  
  try {
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

    // Filter and render only pending requests
    renderNotifications(requests.filter(r => r.status === 'pending'), itemsMap, usersMap);
    
  } catch (error) {
    console.error('Error loading notifications:', error);
    alert('Error loading notifications. Please try again.');
  }
});