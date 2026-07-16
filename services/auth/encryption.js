// services/auth/encryption.js
// Cifrado reversible para contraseñas (XOR cipher + Base64)
// Solo el admin puede descifrar desde el panel de administración

var Encryption = (function () {
    // Clave maestra para XOR (en producción estaría oculta/ofuscada)
    var SECRET_KEY = 'PHub_2024_S3cur3_K3y!';
    var PREFIX = 'PHENC:';

    function xorEncrypt(text, key) {
        var result = '';
        for (var i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    }

    function toBase64(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) {
            return btoa(str);
        }
    }

    function fromBase64(str) {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (e) {
            return atob(str);
        }
    }

    function encrypt(plainText) {
        if (!plainText) return '';
        var xored = xorEncrypt(plainText, SECRET_KEY);
        var encoded = toBase64(xored);
        return PREFIX + encoded;
    }

    function decrypt(cipherText) {
        if (!cipherText) return '';
        if (cipherText.indexOf(PREFIX) !== 0) return cipherText;
        var encoded = cipherText.substring(PREFIX.length);
        var xored = fromBase64(encoded);
        return xorEncrypt(xored, SECRET_KEY);
    }

    function isEncrypted(text) {
        return text && typeof text === 'string' && text.indexOf(PREFIX) === 0;
    }

    return {
        encrypt: encrypt,
        decrypt: decrypt,
        isEncrypted: isEncrypted
    };
})();

if (typeof window !== 'undefined') {
    window.Encryption = Encryption;
}
