import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getRecentItems, sendRequestToOwner } from './firestore.js';

function getFavorites() {
  return JSON.parse(localStorage.getItem('favorites') || '[]');
}

function setFavorites(favs) {
  localStorage.setItem('favorites', JSON.stringify(favs));
}

let currentUser = null;
let allItems = [];

function showItemDetails(item) {
  // Use Cloudinary URL directly from the item object
  const image = item.imageUrl || '';
  
  document.getElementById('detailsTitle').textContent = item.title;
  document.getElementById('detailsImage').src = image;
  document.getElementById('detailsCategory').textContent = item.category;
  document.getElementById('detailsType').textContent = item.type === 'exchange' ? 'For Exchange' : 'Free Donation';
  document.getElementById('detailsDescription').textContent = item.description;

  // Show buttons only if not owner
  const actionsDiv = document.getElementById('detailsActions');
  actionsDiv.innerHTML = '';
  if (currentUser && item.owner !== currentUser.uid) {
    actionsDiv.innerHTML = `
      <button class="btn btn-primary btn-modal request-btn" data-id="${item.id}"><i class="fas fa-paper-plane"></i> Request</button>
      <button class="btn btn-favorite btn-modal favorite-btn" data-id="${item.id}" title="Remove from Favorites"><i class="fas fa-heart"></i> Favorite</button>
    `;
    
    // Add event listeners
    actionsDiv.querySelector('.request-btn').onclick = async (e) => {
      e.stopPropagation();
      await sendRequest(item.id);
      alert('Request sent!');
    };
    
    actionsDiv.querySelector('.favorite-btn').onclick = (e) => {
      e.stopPropagation();
      let favs = getFavorites();
      if (favs.includes(item.id)) {
        favs = favs.filter(id => id !== item.id);
        e.currentTarget.classList.remove('active');
      } else {
        favs.push(item.id);
        e.currentTarget.classList.add('active');
      }
      setFavorites(favs);
      renderFavorites(getFavoriteItems());
      document.getElementById('itemDetailsModal').classList.remove('active');
    };
    
    // Highlight if already favorite
    if (getFavorites().includes(item.id)) {
      actionsDiv.querySelector('.favorite-btn').classList.add('active');
    }
  }
  document.getElementById('itemDetailsModal').classList.add('active');
}

function getFavoriteItems() {
  const favoriteIds = getFavorites();
  return allItems.filter(item => favoriteIds.includes(item.id));
}

function renderFavorites(items) {
  const favoritesList = document.getElementById('favoritesList');
  favoritesList.innerHTML = '';
  
  if (items.length === 0) {
    favoritesList.innerHTML = '<div style="padding:2rem;text-align:center;color:#888;">No favorites yet.</div>';
    return;
  }
  
  items.forEach(item => {
    // Use Cloudinary URL directly from the item object
    const image = item.imageUrl || '';
    
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-badge">${item.type === 'exchange' ? 'For Exchange' : 'Free'}</div>
      <div class="item-image"><img src="${image}" alt="${item.title}" onerror="this.onerror=null;this.src='./assets/placeholder-image.png';"></div>
      <div class="item-info">
        <div class="item-category">${item.category}</div>
        <h3 class="item-title">${item.title}</h3>
        <div class="item-location"><i class="fas fa-map-marker-alt"></i> <span>StudentNation</span></div>
      </div>
    `;
    
    card.addEventListener('click', () => showItemDetails(item));
    favoritesList.appendChild(card);
  });
}

// Modal close logic
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('closeDetailsModal');
  const modal = document.getElementById('itemDetailsModal');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.classList.remove('active');
    });
  }
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = 'login.html';
  
  currentUser = user;
  
  try {
    allItems = await getRecentItems();
    renderFavorites(getFavoriteItems());
  } catch (error) {
    console.error('Error loading favorites:', error);
    alert('Error loading favorite items. Please try again.');
  }
});

// Allow request from modal
async function sendRequest(itemId) {
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;
  
  try {
    await sendRequestToOwner(itemId, item.owner, currentUser.uid, '');
    alert('Request sent!');
  } catch (error) {
    console.error('Error sending request:', error);
    alert('Failed to send request. Please try again.');
  }
}