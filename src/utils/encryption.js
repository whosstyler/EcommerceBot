const CryptoJS = require('crypto-js');

const encryptFile = (buffer) => {
    const wordArray = CryptoJS.lib.WordArray.create(buffer);
    return CryptoJS.AES.encrypt(wordArray, process.env.ENCRYPTION_KEY).toString();
};

const decryptFile = (encrypted) => {
    const decrypted = CryptoJS.AES.decrypt(encrypted, process.env.ENCRYPTION_KEY);
    return Buffer.from(decrypted.toString(CryptoJS.enc.Base64), 'base64');
};

module.exports = {
    encryptFile,
    decryptFile
};
