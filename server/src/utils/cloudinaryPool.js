/**
 * Cloudinary Pool — 3-account load balancer (Race-Condition Safe)
 *
 * Instead of switching global config (which creates race conditions in
 * concurrent Node.js environments), this module:
 *  1. Stores per-account credentials in an array
 *  2. Configures globally only at the moment of upload (synchronous init)
 *  3. Passes credentials EXPLICITLY for all URL generation (sign_url)
 *
 * This ensures that signed URLs always use the correct account's secret,
 * even if multiple uploads happen concurrently.
 */
const cloudinary = require('cloudinary');

// ─── Account Registry ────────────────────────────────────────
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
].filter(a => a.cloud_name && a.api_key && a.api_secret);

/**
 * Find the account that owns a given Cloudinary URL.
 * Falls back to account index 0 if not found.
 */
function getAccountForUrl(url) {
    if (!url || !url.includes('cloudinary.com')) return ACCOUNTS[0];
    const match = url.match(/res\.cloudinary\.com\/([^\/]+)\//);
    if (match) {
        const found = ACCOUNTS.find(a => a.cloud_name === match[1]);
        if (found) return found;
    }
    return ACCOUNTS[0];
}

/**
 * Configure the global singleton to a specific account.
 * Only used immediately before upload calls.
 */
function configureForAccount(accountIndex) {
    const account = ACCOUNTS[accountIndex] || ACCOUNTS[0];
    cloudinary.v2.config({
        cloud_name: account.cloud_name,
        api_key: account.api_key,
        api_secret: account.api_secret,
    });
    return { cld: cloudinary.v2, credentials: account };
}

/**
 * Generate a signed URL using explicit credentials (RACE-SAFE).
 * This never touches the global config.
 */
function signedUrl(publicId, credentials, options = {}) {
    return cloudinary.v2.url(publicId, {
        cloud_name: credentials.cloud_name,
        api_key: credentials.api_key,
        api_secret: credentials.api_secret,
        sign_url: true,
        ...options,
    });
}

// ─── Account Selection ───────────────────────────────────────

/**
 * Get the first available account under 80% storage usage.
 * Falls back to first account if all are above threshold.
 */
async function getAvailableAccountIndex() {
    if (!ACCOUNTS || ACCOUNTS.length === 0) {
        console.error('☁️ Cloudinary Pool: No accounts configured!');
        return -1;
    }

    for (let i = 0; i < ACCOUNTS.length; i++) {
        try {
            configureForAccount(i);
            const usage = await cloudinary.v2.api.usage();
            const usedPercent = (usage.storage?.used_percent) || 0;
            console.log(`☁️ Account ${i + 1} (${ACCOUNTS[i].cloud_name}): ${usedPercent.toFixed(1)}% used`);
            if (usedPercent < 80) return i;
        } catch (err) {
            console.warn(`☁️ Account ${i + 1} usage check failed:`, err.message);
            continue;
        }
    }
    console.warn('⚠️ All accounts above 80% or checks failed. Using Account 1.');
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
    const { cld, credentials } = configureForAccount(accountIndex);

    const { transformations = [], ...otherOptions } = options;

    const result = await cld.uploader.upload_large(filePath, {
        resource_type: 'video',
        folder: 'travelpod/videos',
        chunk_size: 6000000,
        transformation: [...VIDEO_TRANSFORMS, ...transformations],
        eager: [{ format: 'mp4', video_codec: 'h264' }],
        eager_async: true,
        ...otherOptions,
    });

    // Generate signed URL using EXPLICIT credentials (race-safe)
    const videoSignedUrl = signedUrl(result.public_id, credentials, {
        resource_type: 'video',
        format: 'mp4',
    });

    return {
        result,
        accountIndex: accountIndex + 1,
        signedUrl: videoSignedUrl,
        credentials, // Pass credentials so thumbnail gen uses the SAME account
    };
}

// ─── Image Upload ────────────────────────────────────────────
const IMAGE_TRANSFORMS = [
    { width: 1080, crop: 'limit' },
    { quality: 'auto', fetch_format: 'auto' },
];

async function uploadImage(filePath, folder = 'travelpod/images') {
    const accountIndex = await getAvailableAccountIndex();
    const { cld, credentials } = configureForAccount(accountIndex);

    const result = await cld.uploader.upload(filePath, {
        resource_type: 'image',
        folder,
        transformation: IMAGE_TRANSFORMS,
    });

    const imageSignedUrl = signedUrl(result.public_id, credentials, {
        resource_type: 'image',
    });

    return {
        result,
        accountIndex: accountIndex + 1,
        signedUrl: imageSignedUrl,
        credentials,
    };
}

// ─── Thumbnail Generation (Race-Safe) ────────────────────────

/**
 * Generate a signed video thumbnail URL.
 * @param {string} publicId - Cloudinary public ID
 * @param {number} offset - Timestamp offset in seconds
 * @param {number|object} accountIdxOrCreds - Account index (1-based) OR credentials object
 */
function getVideoThumbnail(publicId, offset = 0, accountIdxOrCreds = 1) {
    // Accept either an account index (legacy) or credentials object (new)
    let credentials;
    if (typeof accountIdxOrCreds === 'object' && accountIdxOrCreds.cloud_name) {
        credentials = accountIdxOrCreds;
    } else {
        const idx = (typeof accountIdxOrCreds === 'number' ? accountIdxOrCreds : 1) - 1;
        credentials = ACCOUNTS[idx] || ACCOUNTS[0];
    }

    return signedUrl(publicId, credentials, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
            { start_offset: offset, width: 720, height: 1280, crop: 'fill', gravity: 'auto' },
            { quality: 'auto' },
        ],
    });
}

/**
 * Generate multiple smart thumbnail URLs at different points in a video.
 */
function generateSmartThumbnails(publicId, duration, accountIdxOrCreds = 1) {
    let credentials;
    if (typeof accountIdxOrCreds === 'object' && accountIdxOrCreds.cloud_name) {
        credentials = accountIdxOrCreds;
    } else {
        const idx = (typeof accountIdxOrCreds === 'number' ? accountIdxOrCreds : 1) - 1;
        credentials = ACCOUNTS[idx] || ACCOUNTS[0];
    }

    const offsets = [0.1, 0.5, 0.9].map(p => Math.floor(duration * p));
    return offsets.map(offset =>
        signedUrl(publicId, credentials, {
            resource_type: 'video',
            format: 'jpg',
            transformation: [
                { start_offset: offset, width: 720, height: 1280, crop: 'fill', gravity: 'auto' },
                { quality: 'auto' },
            ],
        })
    );
}

// ─── Delete ──────────────────────────────────────────────────
async function deleteResource(publicId, type = 'video', accountIdx = 1) {
    configureForAccount((accountIdx || 1) - 1);
    return cloudinary.v2.uploader.destroy(publicId, { resource_type: type });
}

// ─── Initialize ──────────────────────────────────────────────
if (ACCOUNTS.length > 0) {
    configureForAccount(0);
    console.log(`☁️ Cloudinary Pool: ${ACCOUNTS.length} account(s) configured`);
    ACCOUNTS.forEach((a, i) => console.log(`   Account ${i + 1}: ${a.cloud_name}`));
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
    configureForAccount,
    signedUrl,
    getAccountForUrl,
    ACCOUNTS,
    cloudinary: cloudinary.v2,
};
