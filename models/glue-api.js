// import { create } from 'domain'

// import got from 'got'
const got = require('got')

// export default ({ apiKey }) => got.extend({
const create = ({ apiKey }) => got.extend({
    prefixUrl: 'https://user-api.gluehome.com',
    headers: {
        'user-agent': 'got'
    },
    responseType: 'json',
    token: apiKey,
    resolveBodyOnly: true,
    handlers: [
        (options, next) => {
            // Authorization
            if (options.token && !options.headers.authorization) {
                options.headers.authorization = `Api-Key ${options.token}`
            }

            // `options.body` -> `options.json`
            if (options.body) {
                options.json = options.body
                delete options.body
            }

            // Don't touch streams
            if (options.isStream) {
                return next(options)
            }

            // Magic begins - transforms/extra handling I guess
            return (async () => {
                try {
                    const response = await next(options)

                    // Rate limit for the Response object
                    // response.rateLimit = getRateLimit(response.headers)

                    return response
                } catch (error) {
                    const { response } = error

                    // Nicer errors
                    if (response && response.body) {
                        error.name = 'GlueApiError';
                        error.message = `${response.body.message} (${error.response.statusCode})`
                    }

                    // Rate limit for errors
                    // if (response) {
                    // 	error.rateLimit = getRateLimit(response.headers)
                    // }

                    throw error
                }
            })()
        }
    ],
    hooks: {
        init: [
            options => {
                // Remove leading slashes
                if (typeof options.url === 'string' && options.url.startsWith('/')) {
                    options.url = options.url.slice(1)
                }
            }
        ]
    }
})

module.exports = create
