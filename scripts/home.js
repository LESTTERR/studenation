import { auth } from './firebase.js'; 
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { addItem, getItemsByCategory, getRecentItems, sendRequestToOwner, sendTradeOfferToOwner } from './firestore.js';
import { handleLocalUpload } from './upload.js';
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-ai.js";
import { app } from "./firebase.js";

const itemList = document.getElementById('itemList');
const categoryCards = document.querySelectorAll('.category-card');
const postForm = document.getElementById('itemForm');

let currentUser = null;

// Initialize AI
const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: "gemini-2.0-flash" });

// Create global loading spinner
const createLoadingSpinner = () => {
  const spinner = document.createElement('div');
  spinner.id = 'globalLoadingSpinner';
  spinner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  spinner.innerHTML = `
    <div class="spinner" style="
      width: 50px;
      height: 50px;
      border: 5px solid #f3f3f3;
      border-top: 5px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    "></div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  document.body.appendChild(spinner);
  return spinner;
};

const loadingSpinner = createLoadingSpinner();

// Show/hide loading spinner
const showLoading = () => loadingSpinner.style.display = 'flex';
const hideLoading = () => loadingSpinner.style.display = 'none';

onAuthStateChanged(auth, (user) => {
  if (!user) return location.href = 'login.html';
  currentUser = user;
  loadItems();
});

function showItemDetails(item) {
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
        if (tradeOfferModal) {
          tradeOfferModal.setAttribute('data-current-item-id', item.id);
        } else {
          console.error('tradeOfferModal element not found!');
          return;
        }
        tradeOfferModal.classList.add('active');
        console.log('Opening trade modal for item:', item.id, 'and setting data-current-item-id.'); 
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
    const image = item.imageUrl || '';
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
    categoryCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const category = card.getAttribute('data-category');
    console.log('Filtering by category:', category);
    loadItems(category);
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

  // Show loading spinner
  showLoading();

  handleLocalUpload(file, async (filename, base64) => {
    const id = 'item_' + Date.now() + '_' + Math.floor(Math.random() * 100000);

    const item = {
      id,
      title,
      category,
      type,
      description,
      createdAt: Date.now(),
      owner: currentUser.uid,
      status: 'available',
      imageUrl: base64
    };

    try {
      await addItem(item);
      alert('Item posted!');
      document.getElementById('postItemModal').classList.remove('active');
      postForm.reset();
      if (fileUpload) {
        fileUpload.querySelector('.file-upload-text').innerHTML =
          'Drag & drop photos here or <span>browse</span>';
      }
      loadItems();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Error posting item. Please try again.');
    } finally {
      // Hide loading spinner regardless of success/error
      hideLoading();
    }
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

if (closeTradeOfferModal) {
  closeTradeOfferModal.onclick = () => {
    tradeOfferModal.classList.remove('active');
    document.getElementById('tradeOfferImage').value = '';
    document.getElementById('tradeOfferDesc').value = '';
  };
}

if (sendTradeOfferBtn) {
  sendTradeOfferBtn.onclick = async () => {
    const itemIdForOffer = tradeOfferModal.getAttribute('data-current-item-id');

    if (!itemIdForOffer) {
      alert("No item selected for trade or item ID is missing. Please close the modal and try again.");
      return;
    }

    // Show loading spinner
    showLoading();

    try {
      const fileInput = document.getElementById('tradeOfferImage');
      const desc = document.getElementById('tradeOfferDesc').value;
      const file = fileInput.files[0];

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'studenation');

        try {
          const cloudinaryRes = await fetch('https://api.cloudinary.com/v1_1/dfcluenzc/image/upload', {
            method: 'POST',
            body: formData,
          });

          const cloudinaryData = await cloudinaryRes.json();

          if (!cloudinaryData.secure_url) {
            throw new Error('Image upload failed. No URL returned.');
          }

          const offerImageUrl = cloudinaryData.secure_url;

          console.log('Calling sendTradeOfferToOwner with (uploaded image):', {
            itemId: itemIdForOffer,
            imageUrl: offerImageUrl,
            description: desc || 'No description',
          });

          await sendTradeOfferToOwner(itemIdForOffer, offerImageUrl, desc || 'No description');
          alert('Trade offer sent successfully!');
          tradeOfferModal.classList.remove('active');
          fileInput.value = '';
          document.getElementById('tradeOfferDesc').value = '';
          tradeOfferModal.removeAttribute('data-current-item-id');
        } catch (error) {
          console.error('Image upload or trade offer failed:', error);
          alert('Failed to send trade offer: ' + error.message);
        }
      } else {
        console.log('Calling sendTradeOfferToOwner with (no file):', {
          itemId: itemIdForOffer,
          imageUrl: '',
          description: desc || 'No description'
        });

        await sendTradeOfferToOwner(itemIdForOffer, '', desc || 'No description');
        alert('Trade offer sent successfully!');
        tradeOfferModal.classList.remove('active');
        document.getElementById('tradeOfferDesc').value = '';
        tradeOfferModal.removeAttribute('data-current-item-id');
      }
    } catch (error) {
      console.error('Error in trade offer process (sendTradeOfferBtn.onclick):', error);
      alert('An error occurred: ' + error.message);
    } finally {
      // Hide loading spinner regardless of success/error
      hideLoading();
    }
  };
}

const filterCategory = document.getElementById('filterCategory');
if (filterCategory) {
  filterCategory.addEventListener('change', () => {
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

function renderItems(items) {
  itemList.innerHTML = '';
  if (items.length === 0) {
    itemList.innerHTML = '<div style="padding:2rem;text-align:center;color:#888;">No items found.</div>';
    return;
  }
  for (const item of items) {
    const image = item.imageUrl || '';
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-badge">${item.type === 'exchange' ? 'For Exchange' : 'Free'}</div>
      <div class="item-image"><img src="${image}" alt="${item.title}"></div>
      <div class="item-info">
        <div class="item-category">${item.category}</div>
        <h3 class="item-title">${item.title}</h3>
        <div class="item-location"><i class="fas fa-map-marker-alt"></i> <span>Gordon college</span></div>
      </div>`;
    card.addEventListener('click', () => showItemDetails(item));
    itemList.appendChild(card);
  }
}

// Chatbot functionality
const icon = document.getElementById("chatbot-icon");
const box = document.getElementById("chatbox");
const sendBtn = document.getElementById("send");
const promptInput = document.getElementById("prompt");
const messages = document.getElementById("messages");

if (icon && box && sendBtn && promptInput && messages) {
  icon.onclick = () => {
    box.style.display = box.style.display === "flex" ? "none" : "flex";
  };

  sendBtn.onclick = async () => {
    const prompt = promptInput.value;
    if (!prompt.trim()) return;
    messages.innerHTML += `<div><b>You:</b> ${prompt}</div>`;
    promptInput.value = "";
    
    // Show loading for AI response
    const loadingMsg = document.createElement('div');
    loadingMsg.innerHTML = '<div><b>Gemini:</b> Thinking...</div>';
    messages.appendChild(loadingMsg);
    messages.scrollTop = messages.scrollHeight;
    
    try {
      const result = await model.generateContent(prompt);
      const reply = result.response.text();
      loadingMsg.remove();
      messages.innerHTML += `<div><b>Gemini:</b> ${reply}</div>`;
    } catch (error) {
      loadingMsg.remove();
      messages.innerHTML += `<div><b>Gemini:</b> Sorry, I encountered an error. Please try again.</div>`;
    }
    
    messages.scrollTop = messages.scrollHeight;
  };
}