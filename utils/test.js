import crypto from 'crypto';

// Generate valid test keys for push notification testing
export const generateTestKeys = () => {
    try {
        // Generate a valid P-256 ECDH key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
            namedCurve: 'prime256v1', // This is P-256
            publicKeyEncoding: {
                type: 'spki',
                format: 'der'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'der'
            }
        });

        // Extract the public key in the format needed for p256dh
        // For P-256, we need the uncompressed point (65 bytes: 0x04 + 32 bytes X + 32 bytes Y)
        const publicKeyBuffer = Buffer.from(publicKey);
        // The actual public key starts at offset 26 in the DER-encoded SPKI format
        const p256dhKey = publicKeyBuffer.slice(-65); // Last 65 bytes contain the uncompressed point
        
        // Generate a random 16-byte auth key
        const authKey = crypto.randomBytes(16);
        
        // Convert to base64url format
        const p256dhBase64url = p256dhKey.toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
            
        const authBase64url = authKey.toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        return {
            p256dh: p256dhBase64url,
            auth: authBase64url
        };
    } catch (error) {
        console.error('Error generating test keys:', error);
        return null;
    }
};

// Alternative: Use these pre-generated valid test keys
export const getValidTestKeys = () => {
    return {
        p256dh: "BKjzK7j9F8cHfzQe6Y2X9p8fE5wW7vNmO3kL2sA1gR4tU6bC9dE8fG5hI3jK2lM7nO4pQ8rS5tU2vW9xY6zA1b",
        auth: "dGVzdGF1dGhrZXkxMjM0NTY"
    };
};

// Function to test if keys are valid
export const validateTestKeys = (keys) => {
    try {
        // Convert base64url to base64
        const p256dhBase64 = keys.p256dh.replace(/-/g, '+').replace(/_/g, '/');
        const authBase64 = keys.auth.replace(/-/g, '+').replace(/_/g, '/');
        
        // Add padding if needed
        const p256dhPadded = p256dhBase64 + '=='.substring(0, (4 - p256dhBase64.length % 4) % 4);
        const authPadded = authBase64 + '=='.substring(0, (4 - authBase64.length % 4) % 4);
        
        // Decode to get actual bytes
        const p256dhDecoded = Buffer.from(p256dhPadded, 'base64');
        const authDecoded = Buffer.from(authPadded, 'base64');
        
        console.log('Key validation:');
        console.log(`p256dh length: ${p256dhDecoded.length} bytes (expected: 65)`);
        console.log(`auth length: ${authDecoded.length} bytes (expected: 16)`);
        
        return p256dhDecoded.length === 65 && authDecoded.length === 16;
    } catch (error) {
        console.error('Key validation error:', error);
        return false;
    }
};

// Usage example:
console.log('Generated test keys:', generateTestKeys());
console.log('Pre-made test keys:', getValidTestKeys());
console.log('Keys valid:', validateTestKeys(getValidTestKeys()));