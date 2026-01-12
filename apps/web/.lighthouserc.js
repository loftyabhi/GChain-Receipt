module.exports = {
    ci: {
        collect: {
            startServerCommand: 'npm run start',
            url: ['http://localhost:3000'],
            numberOfRuns: 3,
        },
        assert: {
            assertions: {
                'categories:performance': ['error', { minScore: 0.95 }],
                'categories:accessibility': ['error', { minScore: 0.95 }],
                'categories:best-practices': ['error', { minScore: 1 }],
                'categories:seo': ['error', { minScore: 1 }],
                'largest-contentful-paint': ['error', { maxNumericValue: 1800 }],
                'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],

                // [Enterprise] Resource Budgets
                'resource-summary:script:size': ['error', { maxNumericValue: 170000 }], // < 170KB JS
                'resource-summary:total:count': ['error', { maxNumericValue: 60 }],     // < 60 requests (initial navigation only)
                'resource-summary:image:size': ['error', { maxNumericValue: 120000 }],  // < 120KB per image
            },
        },
        upload: {
            target: 'temporary-public-storage',
        },
    },
};
