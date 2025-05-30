import { uploadToCloudinary } from './cloudinary.js';

export async function handleLocalUpload(file, callback) {
  try {
    const cloudUrl = await uploadToCloudinary(file);
    callback(file.name, cloudUrl); // Send the cloud URL to the form handler
  } catch (error) {
    alert('Image upload failed: ' + error.message);
  }
}
