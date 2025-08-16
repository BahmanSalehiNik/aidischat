export default {
    webpack: (config) => {
        return {
            ...config,
            watchOptions: {
                ...config.watchOptions,
                poll: 300
            }
        };
    },
    allowedDevOrigins: ['aichatwar-games.com']
}