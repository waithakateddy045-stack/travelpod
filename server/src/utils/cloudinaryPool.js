/**
 * Cloudinary Pool — 3-account load balancer
 * Checks usage() on each account and routes uploads to the first under 80% capacity.
 */
const cloudinary = require('cloudinary');

const ACCOUNTS = [
    {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    },
    {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME_2,
        api_key: process.env.CLOUDINARY_API_KEY_2,
        api_secret: process.env.CLOUDINARY_API_SECRET_2,
    },
    {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME_3,
        api_key: process.env.CLOUDINARY_API_KEY_3,
        api_secret: process.env.CLOUDINARY_API_SECRET_3,
    },
].filter(a => a.cloud_name && a.api_key && a.api_secret); // Only include configured accounts

// Create configured instances
const instances = ACCOUNTS.map((config, idx) => {
    const instance = cloudinary.v2;
    // We can't create multiple v2 instances easily, so we use config switching
    return { config, index: idx + 1 };
});

/**
 * Switch active Cloudinary config to a specific account
 */
function switchToAccount(accountIndex) {
    const account = ACCOUNTS[accountIndex] || ACCOUNTS[0];
    cloudinary.v2.config({
        cloud_name: account.cloud_name,
        api_key: account.api_key,
        api_secret: account.api_secret,
    });
    return cloudinary.v2;
}

/**
 * Get the first available account under 80% storage usage.
 * Falls back to account 1 if all are above threshold or usage check fails.
 */
async function getAvailableAccountIndex() {
    for (let i = 0; i < ACCOUNTS.length; i++) {
        try {
            switchToAccount(i);
            const usage = await cloudinary.v2.api.usage();
            const usedPercent = (usage.storage?.used_percent) || 0;
            console.log(`☁️ Account ${i + 1} (${ACCOUNTS[i].cloud_name}): ${usedPercent.toFixed(1)}% used`);
            if (usedPercent < 80) {
                return i;
            }
        } catch (err) {
            console.warn(`☁️ Account ${i + 1} usage check failed:`, err.message);
            continue;
        }
    }
    // Fallback to first account
    console.warn('☁️ All accounts above 80% — falling back to account 1');
    return 0;
}

// ─── Video Upload ────────────────────────────────────────────
const VIDEO_TRANSFORMS = [
    { quality: 'auto' },
    { fetch_format: 'mp4' },
    { aspect_ratio: '9:16', crop: 'fill', gravity: 'auto' },
    { width: 720, height: 1280, crop: 'limit' },
];

async function uploadVideo(filePath, options = {}) {
    const accountIndex = await getAvailableAccountIndex();
    const cld = switchToAccount(accountIndex);

    const { transformations = [], ...otherOptions } = options;

    const result = await cld.uploader.upload(filePath, {
        resource_type: 'video',
        folder: 'travelpod/videos',
        transformation: [...VIDEO_TRANSFORMS, ...transformations],
        eager: [
            { format: 'mp4', video_codec: 'h264', quality: 'auto' },
        ],
        eager_async: true,
        ...otherOptions,
    });

    return { result, accountIndex: accountIndex + 1 };
}

// ─── Image Upload ────────────────────────────────────────────
const IMAGE_TRANSFORMS = [
    { width: 1080, crop: 'limit' },
    { quality: 'auto', fetch_format: 'auto' },
];

async function uploadImage(filePath, folder = 'travelpod/images') {
    const accountIndex = await getAvailableAccountIndex();
    const cld = switchToAccount(accountIndex);

    const result = await cld.uploader.upload(filePath, {
        resource_type: 'image',
        folder,
        transformation: IMAGE_TRANSFORMS,
    });

    return { result, accountIndex: accountIndex + 1 };
}

// ─── Thumbnail Generation ────────────────────────────────────
function generateSmartThumbnails(publicId, duration, accountIdx = 1) {
    // Ensure we're using the right account for URL generation
    switchToAccount((accountIdx || 1) - 1);
    const offsets = [0.1, 0.5, 0.9].map(p => Math.floor(duration * p));
    return offsets.map(offset =>
        cloudinary.v2.url(publicId, {
            resource_type: 'video',
            format: 'jpg',
            transformation: [
                { start_offset: offset, width: 720, height: 1280, crop: 'fill', gravity: 'auto' },
                { quality: 'auto' }
            ]
        })
    );
}

function getVideoThumbnail(publicId, offset = 0, accountIdx = 1) {
    switchToAccount((accountIdx || 1) - 1);
    return cloudinary.v2.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
            { start_offset: offset, width: 720, height: 1280, crop: 'fill', gravity: 'auto' },
            { quality: 'auto' },
        ],
    });
}

async function deleteResource(publicId, type = 'video', accountIdx = 1) {
    switchToAccount((accountIdx || 1) - 1);
    return cloudinary.v2.uploader.destroy(publicId, { resource_type: type });
}

// Initialize default account
if (ACCOUNTS.length > 0) {
    switchToAccount(0);
    console.log(`☁️ Cloudinary Pool: ${ACCOUNTS.length} account(s) configured`);
} else {
    console.warn('☁️ Cloudinary Pool: No accounts configured!');
}

module.exports = {
    uploadVideo,
    uploadImage,
    generateSmartThumbnails,
    getVideoThumbnail,
    deleteResource,
    getAvailableAccountIndex,
    switchToAccount,
    cloudinary: cloudinary.v2,
};
