
// Helper to format bytes per second
const formatSpeed = (bytes, seconds) => {
  if (seconds === 0) return '0 KB/s';
  const bps = bytes / seconds;
  if (bps > 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
};

// Helper to determine Cloudinary resource type
const getResourceType = (file) => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'video'; // Cloudinary treats audio as 'video' resource type often, or 'auto'
  return 'auto'; // 'auto' lets Cloudinary decide (usually 'raw' for content-files)
};

export const uploadToCloudinary = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      reject(new Error('Cloudinary configuration is missing. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file.'));
      return;
    }

    // Determine endpoint based on resource type
    // usage: https://api.cloudinary.com/v1_1/<cloud_name>/<resource_type>/upload
    const resourceType = getResourceType(file);
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    
    // 'use_filename' and 'unique_filename' are NOT allowed for unsigned uploads.
    // However, 'public_id' IS allowed (based on the error message).
    // We will set public_id to the filename (without extension) to preserve the name in the URL.
    // Cloudinary adds the extension automatically for media, but for raw files it might need care.
    // Let's try sending just the name part as public_id.
    
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    formData.append('public_id', fileNameWithoutExt); 

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

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
          // secure_url is the HTTPS version
          // public_id is also useful
          // resource_type might be different than requested if we used 'auto'
          resolve({
            url: data.secure_url,
            name: data.original_filename || file.name,
            type: data.resource_type,
            format: data.format,
            bytes: data.bytes
          });
        } catch (err) {
          reject(new Error('Invalid response from Cloudinary'));
        }
      } else {
        try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.error?.message || `Upload failed with status ${xhr.status}`));
        } catch(e) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    xhr.send(formData);
  });
};
