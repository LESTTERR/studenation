export async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/dfcluenzc/image/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'studenation'); // Your preset name

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Cloudinary upload failed');
  }

  const data = await response.json();
  return data.secure_url; // Cloud-hosted image URL
}
