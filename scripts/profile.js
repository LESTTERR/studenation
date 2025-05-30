import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getUserProfile, getRecentItems, deleteItem, getItemsByOwner } from './firestore.js';

function renderMyListings(items) {
  const myListings = document.getElementById('myListings');
  myListings.innerHTML = '';
  
  if (items.length === 0) {
    myListings.innerHTML = '<div class="no-items">You haven\'t posted any items yet.</div>';
    return;
  }

  items.forEach(item => {
    // Use the Cloudinary URL directly from the item object
    const image = item.imageUrl || ''; // Default empty string if no image
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-image"><img src="${image}" alt="${item.title}" onerror="this.src='./assets/placeholder-image.png'"></div>
      <div class="item-info">
        <h3 class="item-title">${item.title}</h3>
        <div class="item-category">${item.category}</div>
        <div class="item-actions">
          <span class="item-status">${item.status || 'Available'}</span>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${item.id}">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
    myListings.appendChild(card);
  });

  // Setup delete buttons
  const deleteButtons = document.querySelectorAll('.delete-btn');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemId = e.target.closest('button').dataset.id;
      if (confirm('Are you sure you want to delete this item?')) {
        try {
          await deleteItem(itemId);
          e.target.closest('.item-card').remove();
          
          // Show success message
          const successMsg = document.createElement('div');
          successMsg.className = 'alert alert-success';
          successMsg.textContent = 'Item deleted successfully!';
          document.querySelector('.profile-container').prepend(successMsg);
          setTimeout(() => successMsg.remove(), 3000);
          
          // Refresh the listings if any are left
          const remainingItems = await getItemsByOwner(auth.currentUser.uid);
          if (remainingItems.length === 0) {
            myListings.innerHTML = '<div class="no-items">You haven\'t posted any items yet.</div>';
          }
        } catch (error) {
          console.error('Error deleting item:', error);
          alert('Failed to delete item. Please try again.');
        }
      }
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const profile = await getUserProfile(user.uid);
    if (profile) {
      document.getElementById('profileName').textContent = profile.name || 'User';
      document.getElementById('profileEmail').textContent = user.email;
      document.getElementById('profileJoined').textContent = new Date(profile.createdAt || user.metadata.creationTime).toLocaleDateString();
    }

    // Fetch and display user's own listings
    const myItems = await getItemsByOwner(user.uid);
    renderMyListings(myItems);

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
      auth.signOut().then(() => {
        window.location.href = 'login.html';
      });
    });

  } catch (error) {
    console.error('Error loading profile:', error);
    alert('Error loading profile data. Please try again.');
  }
});