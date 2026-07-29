const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const env = require('./env');

// Configure Cloudinary with environment variables
cloudinary.config({
    cloud_name: env.cloudinary?.cloudName || process.env.CLOUDINARY_CLOUD_NAME,
    api_key: env.cloudinary?.apiKey || process.env.CLOUDINARY_API_KEY,
    api_secret: env.cloudinary?.apiSecret || process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a file Buffer directly to Cloudinary using upload_stream & streamifier.
 *
 * @param {Buffer} buffer - File memory buffer from Multer
 * @param {Object} [options={}] - Additional Cloudinary upload options
 * @returns {Promise<Object>} Cloudinary upload response object (containing secure_url, public_id, etc.)
 */
const uploadToCloudinary = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const defaultOptions = {
            resource_type: 'auto', // 'auto' allows Cloudinary to handle raw PDFs or image formats
            folder: 'invoices'
        };

        const uploadStream = cloudinary.uploader.upload_stream(
            { ...defaultOptions, ...options },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};

module.exports = {
    cloudinary,
    uploadToCloudinary
};
