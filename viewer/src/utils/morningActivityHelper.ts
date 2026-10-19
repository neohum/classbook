export const DEFAULT_MORNING_TOPIC = '아침 독서 및 자율활동';
export const MORNING_ACTIVITY_STORAGE_KEY = 'classbook_morning_activity_v1';

export interface MorningActivityConfig {
    subject: string;
    topic: string;
    updatedAt: string;
}

/**
 * Gets the current unified morning activity configuration from localStorage
 */
export function getStoredMorningActivity(): MorningActivityConfig {
    try {
        const raw = localStorage.getItem(MORNING_ACTIVITY_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.topic === 'string' && parsed.topic.trim()) {
                return {
                    subject: parsed.subject?.trim() || '아침활동',
                    topic: parsed.topic.trim(),
                    updatedAt: parsed.updatedAt || ''
                };
            }
        }
    } catch (e) {
        console.error("Failed to read stored morning activity:", e);
    }

    return {
        subject: '아침활동',
        topic: DEFAULT_MORNING_TOPIC,
        updatedAt: ''
    };
}

/**
 * Saves the unified morning activity configuration to localStorage and dispatches an event
 */
export function saveStoredMorningActivity(topic: string, subject: string = '아침활동'): MorningActivityConfig {
    const config: MorningActivityConfig = {
        subject: subject.trim() || '아침활동',
        topic: topic.trim() || DEFAULT_MORNING_TOPIC,
        updatedAt: new Date().toISOString()
    };
    try {
        localStorage.setItem(MORNING_ACTIVITY_STORAGE_KEY, JSON.stringify(config));
        window.dispatchEvent(new CustomEvent('classbook_morning_activity_updated', { detail: config }));
    } catch (e) {
        console.error("Failed to save stored morning activity:", e);
    }
    return config;
}
