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
    const { transformations = [], ...otherOptions } = options;

    return cloudinary.uploader.upload(filePath, {
        resource_type: 'video',
        folder: 'travelpod/videos',
        // Merge auto transformations with custom ones (e.g. trimming)
        transformation: [
            { quality: "auto" },
            { fetch_format: "mp4" },
            { aspect_ratio: "9:16", crop: "fill", gravity: "auto" },
            { width: 720, height: 1280, crop: "limit" },
            ...transformations
        ],
        eager: [
            { format: 'mp4', video_codec: 'h264', quality: 'auto' },
        ],
        eager_async: true,
        ...otherOptions,
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
 * Generate 3 smart thumbnail options
 * @param {string} publicId 
 * @param {number} duration 
 * @returns {string[]} URLs for 10%, 50%, and 90% frames
 */
const generateSmartThumbnails = (publicId, duration) => {
    const offsets = [0.1, 0.5, 0.9].map(p => Math.floor(duration * p));
    return offsets.map(offset =>
        cloudinary.url(publicId, {
            resource_type: 'video',
            format: 'jpg',
            transformation: [
                { start_offset: offset, width: 720, height: 1280, crop: 'fill', gravity: 'auto' },
                { quality: 'auto' }
            ]
        })
    );
};

/**
 * Generate a video thumbnail URL
 * @param {string} publicId - Cloudinary public ID
 * @param {number} offset - specific timestamp
 * @returns {string} thumbnail URL
 */
const getVideoThumbnail = (publicId, offset = 0) => {
    return cloudinary.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
            { start_offset: offset, width: 720, height: 1280, crop: 'fill', gravity: 'auto' },
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

module.exports = { cloudinary, uploadVideo, uploadImage, generateSmartThumbnails, getVideoThumbnail, deleteResource };
