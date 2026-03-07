import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Safe wrapper for setting/getting items
export const secureStorage = {
    async setItem(key, value) {
        if (Capacitor.isNativePlatform()) {
            await Preferences.set({ key, value });
        } else {
            // Web: secure HTTP cookie for 1 year
            document.cookie = `${key}=${value}; max-age=31536000; path=/; secure; SameSite=Strict`;
        }
    },

    async getItem(key) {
        if (Capacitor.isNativePlatform()) {
            const { value } = await Preferences.get({ key });
            return value;
        } else {
            // Web: parse from cookies
            const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
            if (match) {
                return match[2];
            }
            return null;
        }
    },

    async removeItem(key) {
        if (Capacitor.isNativePlatform()) {
            await Preferences.remove({ key });
        } else {
            // Web: expire cookie immediately
            document.cookie = `${key}=; max-age=0; path=/; secure; SameSite=Strict`;
        }
    }
};
