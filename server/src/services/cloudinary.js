/**
 * Cloudinary service — thin wrapper using the pool
 * Backward-compatible exports for existing code
 */
const pool = require('../utils/cloudinaryPool');

module.exports = {
    cloudinary: pool.cloudinary,
    uploadVideo: async (filePath, options = {}) => {
        const { result } = await pool.uploadVideo(filePath, options);
        return result;
    },
    uploadImage: async (filePath, folder) => {
        const { result } = await pool.uploadImage(filePath, folder);
        return result;
    },
    generateSmartThumbnails: pool.generateSmartThumbnails,
    getVideoThumbnail: pool.getVideoThumbnail,
    deleteResource: pool.deleteResource,
};
