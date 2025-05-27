export function handleLocalUpload(file, onSuccess) {
  const reader = new FileReader();
  reader.onload = () => {
    onSuccess(file.name, reader.result);
  };
  reader.readAsDataURL(file);
}
