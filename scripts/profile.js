import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getUserProfile, getRecentItems } from './firestore.js';
import { deleteItem } from './firestore.js';
import { getItemsByOwner } from './firestore.js';


function getImageLocally(id) {
  return localStorage.getItem('item_image_' + id);
}

function renderMyListings(items) {
  const myListings = document.getElementById('myListings');
  myListings.innerHTML = '';
  items.forEach(item => {
    const image = getImageLocally(item.id) || '';
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-image"><img src="${image}" alt="${item.title}"></div>
      <div class="item-info">
        <h3 class="item-title">${item.title}</h3>
        <div class="item-category">${item.category}</div>
        <div class="item-actions">
          <span class="item-status">${item.status || 'Available'}</span>
        </div>
      </div>
    `;
    myListings.appendChild(card);
  });


  // 🔥 Setup delete buttons
  const deleteButtons = document.querySelectorAll('.delete-btn');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const itemId = e.target.dataset.id;
      if (confirm('Are you sure you want to delete this item?')) {
        await deleteItem(itemId);
        e.target.closest('.item-card').remove();
        localStorage.removeItem('item_image_' + itemId);
      }
    });
  });
}
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = 'login.html';

  const profile = await getUserProfile(user.uid);
  if (profile) {
    document.getElementById('profileName').textContent = profile.name;
    document.getElementById('profileEmail').textContent = profile.email;
    document.getElementById('profileJoined').textContent = new Date(profile.createdAt).toLocaleDateString();
  }

  // ✅ Add this to fetch and display user's own listings
  const myItems = await getItemsByOwner(user.uid);
   
  renderMyListings(myItems);

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    alert('Logging out...');
    window.location.href = 'login.html';
  });
});
