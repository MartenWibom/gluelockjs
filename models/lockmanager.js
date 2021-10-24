const createRequest = require('./glue-api')
// const dayjs = require('dayjs')
// const LOCK = require('../constants/lock.constants')
const GlueLock = require('./lock')

class GlueLockManager {
    #requestHandler
    #apiKey
    #locks = []

    constructor({ apiKey }) {
        this.#apiKey = apiKey
        this.#requestHandler = createRequest({ apiKey: this.#apiKey })
    }

    /**
     * @description Loads all locks
     * @returns {Array} Lock objects
     */
    async init() {
        const locksData = await this.#requestHandler.get(`v1/locks`)
        for (const lockData of locksData) {
            const lockId = lockData.id
            const lock = new GlueLock({ lockId, apiKey: this.#apiKey })
            this.#locks.push(lock)
        }

        return this.locks
    }

    get locks() {
        return this.#locks
    }
}

module.exports = GlueLockManager
