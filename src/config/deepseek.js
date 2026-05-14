export const MODEL_CONFIG = {
    stream: true,
    max_tokens: 8192,
    temperature: 0.6,
}

export const STORAGE_KEYS = {
    sessionList: "aiwebchat_sessions",
    activeIndex: "aiwebchat_active_index"
};

const _token = typeof __API_ACCESS_TOKEN__ !== 'undefined' ? __API_ACCESS_TOKEN__ : ''
export const API_HEADERS = _token ? { 'X-Api-Token': _token } : {}
