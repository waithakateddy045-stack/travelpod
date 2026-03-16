/**
 * Cloudinary service — thin wrapper using the pool
 * Backward-compatible exports for existing code
 */
const pool = require('../utils/cloudinaryPool');

module.exports = {
    cloudinary: pool.cloudinary,
    uploadVideo: async (filePath, options = {}) => {
        return await pool.uploadVideo(filePath, options);
    },
    uploadImage: async (filePath, folder) => {
        return await pool.uploadImage(filePath, folder);
    },
    generateSmartThumbnails: pool.generateSmartThumbnails,
    getVideoThumbnail: pool.getVideoThumbnail,
    deleteResource: pool.deleteResource,
};
