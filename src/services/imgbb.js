// Helper to format bytes per second
const formatSpeed = (bytes, seconds) => {
  if (seconds === 0) return '0 KB/s';
  const bps = bytes / seconds;
  if (bps > 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
};

export const uploadToImgBB = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    // Try env var, fallback to the user provided key if missing (for debugging)
    const apiKey = import.meta.env.VITE_IMGBB_API_KEY || '5c1c5b7cae2edd508a2f35f98c4eec96';

    if (!apiKey) {
      reject(new Error('ImgBB API key is missing'));
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    // Optional: expiration
    // formData.append('expiration', 600);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.imgbb.com/1/upload?key=${apiKey}`);

    const startTime = Date.now();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        
        // Calculate average speed from start
        const timeElapsed = (Date.now() - startTime) / 1000;
        const currentSpeed = formatSpeed(e.loaded, timeElapsed);
        
        if (onProgress) {
          onProgress(percentComplete, currentSpeed);
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            resolve(data.data.url);
          } else {
            reject(new Error(data.error?.message || 'Failed to upload image'));
          }
        } catch (err) {
          reject(new Error('Invalid response from ImgBB'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    xhr.send(formData);
  });
};
