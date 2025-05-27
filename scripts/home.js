import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { addItem, getItemsByCategory, getRecentItems, sendRequestToOwner, sendTradeOfferToOwner } from './firestore.js';
import { handleLocalUpload } from './upload.js';

const itemList = document.getElementById('itemList');
const categoryCards = document.querySelectorAll('.category-card');
const postForm = document.getElementById('itemForm');
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (!user) return location.href = 'login.html';
  currentUser = user;
  loadItems();
});

// Store image in localStorage with a unique key
function saveImageLocally(id, base64) {
  localStorage.setItem('item_image_' + id, base64);
}

// Get image from localStorage by id
function getImageLocally(id) {
  return localStorage.getItem('item_image_' + id);
}

// Show item details in modal
function showItemDetails(item) {
  const image = getImageLocally(item.id) || '';
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
      ${item.type === 'exchange'
        ? `<button class="btn btn-primary btn-sm trade-btn" data-id="${item.id}"><i class="fas fa-exchange-alt"></i> Trade</button>`
        : `<button class="btn btn-primary btn-sm request-btn" data-id="${item.id}"><i class="fas fa-paper-plane"></i> Request</button>`
      }
      <button class="btn btn-favorite btn-xs favorite-btn" data-id="${item.id}" title="Add to Favorites">
        <i class="fas fa-heart"></i>
      </button>
    `;
    // Add event listeners
    const requestBtn = actionsDiv.querySelector('.request-btn');
    if (requestBtn) {
      requestBtn.onclick = async (e) => {
        e.stopPropagation();
        await sendRequest(item.id);
        alert('Request sent!');
      };
    }

    const tradeBtn = actionsDiv.querySelector('.trade-btn');
    if (tradeBtn) {
      tradeBtn.onclick = (e) => {
        e.stopPropagation();
        currentTradeItemId = item.id;
        tradeOfferModal.classList.add('active');
      };
    }

    const favoriteBtn = actionsDiv.querySelector('.favorite-btn');
    if (favoriteBtn) {
      favoriteBtn.onclick = (e) => {
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
      };
      // Highlight if already favorite
      if (getFavorites().includes(item.id)) {
        favoriteBtn.classList.add('active');
      }
    }
  }
  document.getElementById('itemDetailsModal').classList.add('active');
}

// Close item details modal
document.getElementById('closeDetailsModal').addEventListener('click', function() {
  document.getElementById('itemDetailsModal').classList.remove('active');
});

// Also close when clicking outside modal content
document.getElementById('itemDetailsModal').addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('active');
  }
});

// Modify loadItems to accept a category parameter
async function loadItems(category = null) {
  let items;
  if (category) {
    items = await getItemsByCategory(category);
    console.log('Filtered items:', items);
  } else {
    items = await getRecentItems();
    console.log('All items:', items);
  }

  itemList.innerHTML = '';
  for (const item of items) {
    const image = getImageLocally(item.id) || '';
    const isOwner = currentUser && item.owner === currentUser.uid;
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-badge">${item.type === 'exchange' ? 'For Exchange' : 'Free'}</div>
      <div class="item-image"><img src="${image}" alt="${item.title}"></div>
      <div class="item-info">
        <div class="item-category">${item.category}</div>
        <h3 class="item-title">${item.title}</h3>
        <div class="item-location"><i class="fas fa-map-marker-alt"></i> <span>StudentNation</span></div>
      </div>`;
    // Add click event to show details
    card.addEventListener('click', () => showItemDetails(item));
    itemList.appendChild(card);
  }

  if (items.length === 0) {
    itemList.innerHTML = '<div style="padding:2rem;text-align:center;color:#888;">No items found in this category.</div>';
  }
}

// Add click event to each category card
categoryCards.forEach(card => {
  card.addEventListener('click', () => {
    // Remove 'active' class from all cards
    categoryCards.forEach(c => c.classList.remove('active'));
    // Add 'active' class to the clicked card
    card.classList.add('active');
    // Get the category and filter items
    const category = card.getAttribute('data-category');
    console.log('Filtering by category:', category);
    loadItems(category);
    // Also reset the filter dropdown to "All Categories"
    const filterCategory = document.getElementById('filterCategory');
    if (filterCategory) filterCategory.value = '';
  });
});

// Modal logic for posting items
const modal = document.getElementById('postItemModal');
const postItemBtn = document.getElementById('postItemBtn');
const closeModalBtns = document.querySelectorAll('.close-modal');

if (postItemBtn) {
  postItemBtn.addEventListener('click', function() {
    modal.classList.add('active');
  });
}
closeModalBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    modal.classList.remove('active');
  });
});
modal.addEventListener('click', function(e) {
  if (e.target === modal) {
    modal.classList.remove('active');
  }
});

// Handle file upload display
const fileUpload = document.querySelector('.file-upload');
const fileInput = document.getElementById('itemPhotos');
if (fileUpload && fileInput) {
  fileUpload.addEventListener('click', function() {
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
      fileUpload.querySelector('.file-upload-text').textContent =
        `${this.files.length} file(s) selected`;
    }
  });
}

// Handle form submission for posting items
postForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('title').value;
  const category = document.getElementById('category').value;
  const type = document.getElementById('type').value;
  const description = document.getElementById('description').value;
  const file = document.getElementById('itemPhotos').files[0];

  if (!file) return alert('Please upload an image');

  handleLocalUpload(file, async (filename, base64) => {
    // Generate a unique ID for this item
    const id = 'item_' + Date.now() + '_' + Math.floor(Math.random() * 100000);

    // Save image locally
    saveImageLocally(id, base64);

    // Save item data to Firestore (without image, but with id)
    const item = {
      id,
      title,
      category,
      type,
      description,
      createdAt: Date.now(),
      owner: currentUser.uid
    };

    await addItem(item);
    alert('Item posted!');
    document.getElementById('postItemModal').classList.remove('active');
    postForm.reset();
    if (fileUpload) {
      fileUpload.querySelector('.file-upload-text').innerHTML =
        'Drag & drop photos here or <span>browse</span>';
    }
    loadItems();
  });
});

async function sendRequest(itemId) {
  const item = (await getRecentItems()).find(i => i.id === itemId);
  if (!item) return;
  await sendRequestToOwner(itemId, item.owner, currentUser.uid, '');
}

// Trade Offer Modal logic
const tradeOfferModal = document.getElementById('tradeOfferModal');
const closeTradeOfferModal = document.getElementById('closeTradeOfferModal');
const sendTradeOfferBtn = document.getElementById('sendTradeOfferBtn');
let currentTradeItemId = null;

if (closeTradeOfferModal) {
  closeTradeOfferModal.onclick = () => {
    tradeOfferModal.classList.remove('active');
    document.getElementById('tradeOfferImage').value = '';
    document.getElementById('tradeOfferDesc').value = '';
  };
}

if (sendTradeOfferBtn) {
  sendTradeOfferBtn.onclick = async () => {
    const fileInput = document.getElementById('tradeOfferImage');
    const desc = document.getElementById('tradeOfferDesc').value;
    let imageUrl = '';
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        imageUrl = reader.result;
        await sendTradeOfferToOwner(currentTradeItemId, imageUrl, desc);
        alert('Trade offer sent!');
        tradeOfferModal.classList.remove('active');
        fileInput.value = '';
        document.getElementById('tradeOfferDesc').value = '';
      };
      reader.readAsDataURL(file);
    } else {
      await sendTradeOfferToOwner(currentTradeItemId, '', desc);
      alert('Trade offer sent!');
      tradeOfferModal.classList.remove('active');
      fileInput.value = '';
      document.getElementById('tradeOfferDesc').value = '';
    }
  };
}

const filterCategory = document.getElementById('filterCategory');
if (filterCategory) {
  filterCategory.addEventListener('change', () => {
    // Remove 'active' from all cards
    categoryCards.forEach(c => c.classList.remove('active'));
    loadItems(filterCategory.value);
  });
}

function getFavorites() {
  return JSON.parse(localStorage.getItem('favorites') || '[]');
}
function setFavorites(favs) {
  localStorage.setItem('favorites', JSON.stringify(favs));
}

const searchBar = document.querySelector('.search-bar');

if (searchBar) {
  searchBar.addEventListener('input', async function() {
    const query = searchBar.value.trim().toLowerCase();
    let items = await getRecentItems();
    if (query) {
      items = items.filter(item =>
        item.title && item.title.toLowerCase().includes(query)
      );
    }
    renderItems(items);
  });
}

// Helper function to render items (reuse your card rendering logic)
function renderItems(items) {
  itemList.innerHTML = '';
  if (items.length === 0) {
    itemList.innerHTML = '<div style="padding:2rem;text-align:center;color:#888;">No items found.</div>';
    return;
  }
  for (const item of items) {
    const image = getImageLocally(item.id) || '';
    const isOwner = currentUser && item.owner === currentUser.uid;
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-badge">${item.type === 'exchange' ? 'For Exchange' : 'Free'}</div>
      <div class="item-image"><img src="${image}" alt="${item.title}"></div>
      <div class="item-info">
        <div class="item-category">${item.category}</div>
        <h3 class="item-title">${item.title}</h3>
        <div class="item-location"><i class="fas fa-map-marker-alt"></i> <span>StudentNation</span></div>
      </div>`;
    // Add click event to show details
    card.addEventListener('click', () => showItemDetails(item));
    itemList.appendChild(card);
  }
}

// Only global handler for request button (for cards, not modal)
document.querySelectorAll('.request-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const itemId = btn.getAttribute('data-id');
    await sendRequest(itemId);
    alert('Request sent!');
  });
});

import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-ai.js";
import { app } from "./firebase.js"; // reuse your initialized app

const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: "gemini-2.0-flash" });

const icon = document.getElementById("chatbot-icon");
const box = document.getElementById("chatbox");
const send = document.getElementById("send");
const promptInput = document.getElementById("prompt");
const messages = document.getElementById("messages");

icon.onclick = () => {
  box.style.display = box.style.display === "flex" ? "none" : "flex";
};

send.onclick = async () => {
  const prompt = promptInput.value;
  if (!prompt.trim()) return;
  messages.innerHTML += `<div><b>You:</b> ${prompt}</div>`;
  promptInput.value = "";
  const result = await model.generateContent(prompt);
  const reply = result.response.text();
  messages.innerHTML += `<div><b>Gemini:</b> ${reply}</div>`;
  messages.scrollTop = messages.scrollHeight;
};
