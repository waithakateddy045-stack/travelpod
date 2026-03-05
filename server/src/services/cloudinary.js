const cloudinary = require('cloudinary').v2;

// Configure from environment
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload video to Cloudinary
 * @param {string} filePath - local file path
 * @param {object} options - upload options
 * @returns {Promise<object>} Cloudinary upload result
 */
const uploadVideo = async (filePath, options = {}) => {
    return cloudinary.uploader.upload(filePath, {
        resource_type: 'video',
        folder: 'travelpod/videos',
        eager: [
            { format: 'mp4', video_codec: 'h264', quality: 'auto' },
            { format: 'webm', video_codec: 'vp9', quality: 'auto' },
        ],
        eager_async: true,
        ...options,
    });
};

/**
 * Upload image to Cloudinary
 * @param {string} filePath - local file path
 * @param {string} folder - destination folder
 * @returns {Promise<object>} Cloudinary upload result
 */
const uploadImage = async (filePath, folder = 'travelpod/images') => {
    return cloudinary.uploader.upload(filePath, {
        resource_type: 'image',
        folder,
        transformation: [
            { width: 1080, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
        ],
    });
};

/**
 * Generate a video thumbnail URL
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} thumbnail URL
 */
const getVideoThumbnail = (publicId) => {
    return cloudinary.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
            { width: 480, height: 854, crop: 'fill', gravity: 'auto' },
            { quality: 'auto' },
        ],
    });
};

/**
 * Delete a resource from Cloudinary
 * @param {string} publicId
 * @param {string} type - 'video' or 'image'
 */
const deleteResource = async (publicId, type = 'video') => {
    return cloudinary.uploader.destroy(publicId, { resource_type: type });
};

module.exports = { cloudinary, uploadVideo, uploadImage, getVideoThumbnail, deleteResource };
